import { createActor } from 'xstate';
import { type BlockGenerationInput } from '@/lib/types/actionable-blocks.types';
import { type LLMClient, createLLMClient } from './adapters/llm-client';
import {
  type EnhancedOutlineValidationResult,
  type OutlineValidator,
  getOutlineValidator,
} from './adapters/outline-validator';
import { mapStateToStatus as mapOutlineStateToStatus, outlineRequestMachine } from './machines/outline-request.machine';
import { type OutlineRequestRepository } from './repositories/outline-request.repository';
import { createSupabaseRepositories } from './repositories/supabase.repository';
import { extractValidationFeedback } from './validation-rules.service';
import { logger } from './logger';

/**
 * Outline Request Pipeline
 *
 * Orchestrates the 2-stage LLM flow for generating actionable blocks:
 * 1. Validation stage: LLM validates outline, server applies thresholds
 * 2. Blocks generation stage: LLM generates teaching points
 *
 * State machine stops at `blocks_generated` (lesson generation comes later).
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
   * - If validation fails → STOP
   *
   * Stage 2: Blocks Generation
   * - LLM generates actionable teaching blocks (teaching points)
   * - Store blocks in outline_request.content_blocks
   * - Mark as blocks_generated
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

      // Subscribe to snapshot changes and sync with database
      outlineActor.subscribe((snapshot) => {
        const status = mapOutlineStateToStatus(snapshot.value);
        const error = snapshot.context.error;
        this.outlineRepo.updateStatus(outlineRequestId, status, error).catch((err) => {
          logger.error('Failed to update outline request status:', err);
        });
      });

      // ========================================
      // STAGE 1: VALIDATION
      // ========================================

      // Transition: submitted -> validating_outline
      outlineActor.send({ type: 'outline.validation.start' });

      // Step 1: Validate outline (LLM + thresholds applied by validator)
      const validationResult = await this.validator.validate(outlineRequest.outline);

      // Extract enhanced result for blocks generation
      const enhancedResult = (validationResult as EnhancedOutlineValidationResult).enhancedResult;

      if (!validationResult.valid) {
        // Validation failed - STOP
        const errorData: { message: string; errors?: string[]; validationDetails?: unknown } = {
          message: 'Validation failed',
          errors: validationResult.errors,
        };

        // Include validation details if enhanced result available
        if (enhancedResult) {
          errorData.validationDetails = {
            intent: enhancedResult.intent,
            specificity: enhancedResult.specificity,
            actionability: enhancedResult.actionability,
          };
        }

        outlineActor.send({
          type: 'outline.validation.failed',
          error: errorData,
        });
        return;
      }

      // Check if enhanced result exists (should always be present for valid LLM validation)
      if (!enhancedResult) {
        outlineActor.send({
          type: 'outline.validation.failed',
          error: {
            message: 'Validation failed: No enhanced result available',
            errors: ['Internal error: Enhanced validation result missing'],
          },
        });
        return;
      }

      // Validation passed - proceed to blocks generation
      outlineActor.send({ type: 'outline.validation.success' });

      // ========================================
      // STAGE 2: BLOCKS GENERATION
      // ========================================

      // Transition: validating_outline -> generating_blocks
      outlineActor.send({ type: 'blocks.generation.start' });

      // Prepare input for blocks generation
      const feedback = extractValidationFeedback(enhancedResult);

      const blocksInput: BlockGenerationInput = {
        originalOutline: outlineRequest.outline,
        validationFeedback: feedback,
      };

      // Step 2a: Generate actionable blocks (teaching points)
      const blocksResult = await this.llmClient.generateBlocks(blocksInput);

      // Step 2b: Store blocks in outline_request.content_blocks
      await this.outlineRepo.updateBlocks(outlineRequestId, blocksResult);

      // Transition: generating_blocks -> blocks_generated
      outlineActor.send({ type: 'blocks.generation.success' });

      // STOP HERE - no lesson generation yet
      // State machine should transition to blocks_generated (final state)
      outlineActor.stop();
    } catch (error) {
      logger.error('Error processing outline request:', error);
      await this.outlineRepo.updateStatus(outlineRequestId, 'error', {
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      });
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
  const { outlineRequestRepository } = createSupabaseRepositories();

  return new OutlineRequestPipeline(getOutlineValidator(), createLLMClient(), outlineRequestRepository);
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
