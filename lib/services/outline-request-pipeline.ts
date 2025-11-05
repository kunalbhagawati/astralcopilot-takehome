import { type BlockGenerationInput } from '@/lib/types/actionable-blocks.types';
import { createActor } from 'xstate';
import { type LLMClient, createLLMClient } from './adapters/llm-client';
import {
  type EnhancedOutlineValidationResult,
  type OutlineValidator,
  getOutlineValidator,
} from './adapters/outline-validator';
import { logger } from './logger';
import { outlineRequestMachine } from './machines/outline-request.machine';
import { OutlineRequestRepository } from './repositories/outline-request.repository';
import { extractValidationFeedback } from './validation-rules.service';

/**
 * Outline Request Pipeline
 *
 * Orchestrates the 2-stage LLM flow for generating actionable blocks:
 * 1. Validation stage: LLM validates outline, server applies thresholds
 * 2. Blocks generation stage: LLM generates teaching points
 *
 * State machine stops at `outline.blocks.generated` (lesson generation comes later).
 *
 * Uses new DB status enum values from database.types.ts:
 * - submitted → outline.validating → outline.validated → outline.blocks.generating → outline.blocks.generated
 *
 * Final states:
 * - 'failed': Flow can't proceed based on LLM output (outline validation fails, etc.)
 * - 'error': System/technical error (network error, LLM API down, etc.)
 *
 * Refactored with dependency injection for testability and loose coupling.
 * Uses XState v5.23.0 for state management - https://statelyai.github.io/xstate/
 */
export class OutlineRequestPipeline {
  constructor(
    private validator: OutlineValidator,
    private llmClient: LLMClient,
    private outlineRepo: OutlineRequestRepository,
  ) {}

  /**
   * Processes an outline request through the 2-stage LLM flow
   *
   * Stage 1: Validation
   * - LLM generates validation scores/feedback
   * - Server applies business rules (thresholds)
   * - If validation fails → 'failed' state (flow failure)
   *
   * Stage 2: Blocks Generation
   * - LLM generates actionable teaching blocks (teaching points)
   * - Store blocks in outline_request.content_blocks
   * - Mark as outline.blocks.generated
   * - STOP (no lesson generation yet)
   *
   * This runs asynchronously in the background
   */
  async processOutlineRequest(outlineRequestId: string): Promise<void> {
    try {
      // Fetch the outline request using repository
      const outlineRequest = await this.outlineRepo.findById(outlineRequestId);

      if (!outlineRequest) {
        logger.error('Outline request not found:', outlineRequestId);
        return;
      }

      // Initialize the outline request state machine
      const outlineActor = createActor(outlineRequestMachine, {
        input: {
          outlineRequestId,
          outline: outlineRequest.outline,
        },
      });

      outlineActor.start();

      // ========================================
      // STAGE 1: VALIDATION
      // ========================================

      // Transition: submitted -> outline.validating
      outlineActor.send({ type: 'outline.validation.start' });

      // Record validation started (no metadata yet)
      await this.outlineRepo.createStatusRecord(outlineRequestId, 'outline.validating', undefined);

      // Step 1: Validate outline (LLM + thresholds applied by validator)
      let validationResult;
      try {
        validationResult = await this.validator.validate(outlineRequest.outline);
      } catch (error) {
        // System/technical error during validation
        const errorMetadata = {
          message: error instanceof Error ? error.message : 'Validation system error',
          error: error instanceof Error ? error.name : 'UnknownError',
          context: {
            stage: 'outline_validation',
            outlineRequestId,
          },
        };

        await this.outlineRepo.createStatusRecord(outlineRequestId, 'error', errorMetadata);

        outlineActor.send({
          type: 'outline.validation.error',
          metadata: errorMetadata,
        });
        return;
      }

      // Extract enhanced result for blocks generation
      const enhancedResult = (validationResult as EnhancedOutlineValidationResult).enhancedResult;

      if (!validationResult.valid) {
        // Validation failed - LLM output indicates outline doesn't meet requirements
        // This is a FLOW FAILURE, not a system error → move to 'failed' state

        const failedMetadata = {
          llmOutput: enhancedResult || null,
          failureReason: 'Validation failed',
          details: validationResult.errors || [],
        };

        await this.outlineRepo.createStatusRecord(outlineRequestId, 'failed', failedMetadata);

        outlineActor.send({
          type: 'outline.validation.failed',
          metadata: failedMetadata,
        });
        return;
      }

      // Check if enhanced result exists (should always be present for valid LLM validation)
      if (!enhancedResult) {
        // System error - no AI output received (this shouldn't happen if valid=true)
        const errorMetadata = {
          message: 'Validation failed: No enhanced result available',
          error: 'MissingLLMOutput',
          context: {
            stage: 'outline_validation',
            outlineRequestId,
            validationResult,
          },
        };

        await this.outlineRepo.createStatusRecord(outlineRequestId, 'error', errorMetadata);

        outlineActor.send({
          type: 'outline.validation.error',
          metadata: errorMetadata,
        });
        return;
      }

      // Validation passed - store LLM output in metadata and transition to outline.validated
      await this.outlineRepo.createStatusRecord(outlineRequestId, 'outline.validating', enhancedResult);

      // Proceed to outline.validated state
      outlineActor.send({ type: 'outline.validation.success' });

      // Record outline.validated status (no additional metadata needed)
      await this.outlineRepo.createStatusRecord(outlineRequestId, 'outline.validated', undefined);

      // ========================================
      // STAGE 2: BLOCKS GENERATION
      // ========================================

      // Transition: outline.validated -> outline.blocks.generating
      outlineActor.send({ type: 'blocks.generation.start' });

      // Record blocks generation started (no metadata yet)
      await this.outlineRepo.createStatusRecord(outlineRequestId, 'outline.blocks.generating', undefined);

      // Prepare input for blocks generation
      const feedback = extractValidationFeedback(enhancedResult);

      const blocksInput: BlockGenerationInput = {
        originalOutline: outlineRequest.outline,
        validationFeedback: feedback,
      };

      // Step 2a: Generate actionable blocks (teaching points)
      let blocksResult;
      try {
        blocksResult = await this.llmClient.generateBlocks(blocksInput);
      } catch (error) {
        // System/technical error during blocks generation
        const errorMetadata = {
          message: error instanceof Error ? error.message : 'Blocks generation system error',
          error: error instanceof Error ? error.name : 'UnknownError',
          context: {
            stage: 'blocks_generation',
            outlineRequestId,
          },
        };

        await this.outlineRepo.createStatusRecord(outlineRequestId, 'error', errorMetadata);

        outlineActor.send({
          type: 'blocks.generation.error',
          metadata: errorMetadata,
        });
        return;
      }

      // Step 2b: Store blocks in outline_request.content_blocks
      await this.outlineRepo.updateBlocks(outlineRequestId, blocksResult);

      // Step 2c: Store blocks in metadata for audit trail
      await this.outlineRepo.createStatusRecord(outlineRequestId, 'outline.blocks.generating', blocksResult);

      // Transition: outline.blocks.generating -> outline.blocks.generated
      outlineActor.send({ type: 'blocks.generation.success' });

      // Record final outline.blocks.generated status
      await this.outlineRepo.createStatusRecord(outlineRequestId, 'outline.blocks.generated', undefined);

      // STOP HERE - no lesson generation yet
      // State machine should transition to outline.blocks.generated (final state)
      outlineActor.stop();
    } catch (error) {
      // Catch-all for unexpected errors not caught above
      logger.error('Error processing outline request:', error);

      const errorMetadata = {
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        error: error instanceof Error ? error.name : 'UnknownError',
        context: {
          outlineRequestId,
        },
      };

      await this.outlineRepo.createStatusRecord(outlineRequestId, 'error', errorMetadata);
    }
  }
}

/**
 * Create pipeline with default dependencies
 *
 * Factory function that wires up all dependencies.
 * For testing, construct OutlineRequestPipeline directly with mocks.
 *
 * @returns Configured pipeline instance
 */
export const createPipeline = (): OutlineRequestPipeline => {
  return new OutlineRequestPipeline(getOutlineValidator(), createLLMClient(), new OutlineRequestRepository());
};

/**
 * Triggers the blocks generation process in the background
 * This function returns immediately while processing continues
 *
 * @param outlineRequestId - ID of the outline request to process
 */
export async function processOutline(outlineRequestId: string): Promise<void> {
  const pipeline = createPipeline();

  // Run the process in the background (don't await)
  pipeline.processOutlineRequest(outlineRequestId).catch((error) => {
    logger.error('Background blocks generation failed:', error);
  });
}
