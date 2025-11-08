// Using XState v5.23.0 - https://statelyai.github.io/xstate/
import type { ActionableBlocksResult, BlockGenerationInput } from '@/lib/types/actionable-blocks.types';
import type { EnhancedValidationResult } from '@/lib/types/validation.types';
import { assign, createActor, fromPromise, setup } from 'xstate';
import { createContextForBlocksGeneration, generateBlocks } from '../adapters/blocks-generator-core';
import type { OutlineValidator } from '../adapters/outline-validator';
import { logger } from '../logger';
import { LessonRepository } from '../repositories/lesson.repository';
import type { OutlineRequestRepository } from '../repositories/outline-request.repository';
import { extractValidationFeedback } from '../validation-rules.service';
import { registerActor } from './actor-registry';
import { lessonActorMachine } from './lesson.actor-machine';

/**
 * Context for the actor-based outline request state machine
 *
 * This machine orchestrates the outline processing flow (stops at blocks.generated):
 * 1. Validation - LLM validates outline
 * 2. Blocks generation - Generate teaching points
 *
 * Lesson generation/validation happens separately after this machine completes.
 */
interface OutlineRequestActorContext {
  outlineRequestId: string;
  outline: string;

  // Injected dependencies
  validator: OutlineValidator;
  outlineRepo: OutlineRequestRepository;

  // Results from each stage (stored in context for subsequent stages)
  validationResult?: EnhancedValidationResult;
  blocksResult?: ActionableBlocksResult;

  // Error metadata for failed/error states
  error?: unknown;
}

/**
 * Input type for initializing the machine
 */
type OutlineRequestActorInput = OutlineRequestActorContext;

/**
 * Events - Auto-generated from state transitions
 * The machine drives transitions via invoke onDone/onError, not external events
 */
type OutlineRequestActorEvent = { type: string };

/**
 * Actor-based state machine for outline request processing
 *
 * Uses XState v5's invoke pattern to embed business logic directly in states.
 * Each state invokes async actors (promise-based) to perform work.
 *
 * Flow:
 * submitted → validating → validated → blocks_generating → blocks_generated (final)
 *
 * Lesson generation/validation happens separately after this machine completes.
 * Error handling via onError transitions to 'error' or 'failed' final states.
 */
export const outlineRequestActorMachine = setup({
  types: {
    context: {} as OutlineRequestActorContext,
    input: {} as OutlineRequestActorInput,
    events: {} as OutlineRequestActorEvent,
  },
  actors: {
    /**
     * Stage 1: Validate outline using LLM + thresholds
     */
    validateOutline: fromPromise<
      EnhancedValidationResult,
      {
        validator: OutlineValidator;
        outline: string;
        outlineRepo: OutlineRequestRepository;
        outlineRequestId: string;
      }
    >(async ({ input }) => {
      // Update validating status (timestamp only)
      await input.outlineRepo.updateStatus(input.outlineRequestId, 'outline.validating', undefined);

      const result = await input.validator.validate(input.outline);

      // Check validation result
      if (!result.valid) {
        throw new Error('Validation failed: ' + (result.errors?.join(', ') || 'Unknown error'));
      }

      // Extract enhanced result
      const enhancedResult = (result as { enhancedResult?: EnhancedValidationResult }).enhancedResult;

      if (!enhancedResult) {
        throw new Error('Validation failed: No enhanced result available');
      }

      // Update validating status with validation result metadata
      await input.outlineRepo.updateStatus(input.outlineRequestId, 'outline.validating', enhancedResult);

      return enhancedResult;
    }),

    /**
     * Stage 2: Generate actionable teaching blocks + spawn lesson machines
     *
     * Combined into one actor because final state invokes are unreliable (fire-and-forget).
     */
    generateBlocks: fromPromise<
      ActionableBlocksResult,
      {
        outline: string;
        validationResult: EnhancedValidationResult;
        outlineRepo: OutlineRequestRepository;
        outlineRequestId: string;
      }
    >(async ({ input }) => {
      // Update blocks generating status (timestamp only)
      await input.outlineRepo.updateStatus(input.outlineRequestId, 'outline.blocks.generating', undefined);

      const feedback = extractValidationFeedback(input.validationResult);

      const blocksInput: BlockGenerationInput = {
        originalOutline: input.outline,
        validationFeedback: feedback,
      };

      const context = createContextForBlocksGeneration();
      const blocksResult = await generateBlocks(context, blocksInput);

      // Update blocks in database
      await input.outlineRepo.updateBlocks(input.outlineRequestId, blocksResult);

      // Update blocks generating status with result metadata
      await input.outlineRepo.updateStatus(input.outlineRequestId, 'outline.blocks.generating', blocksResult);

      // Now do the blocks_generated work BEFORE returning (can't trust final state invokes)
      logger.info(`[Outline ${input.outlineRequestId}] Blocks generated, updating status...`);

      // Update blocks generated status
      await input.outlineRepo.updateStatus(input.outlineRequestId, 'outline.blocks.generated', undefined);

      // Set num_lessons for tracking
      const numLessons = blocksResult.lessons.length;
      await input.outlineRepo.updateNumLessons(input.outlineRequestId, numLessons);

      logger.info(`[Outline ${input.outlineRequestId}] Blocks generated, spawning ${numLessons} lesson machines...`);

      // Fire-and-forget: Spawn parallel lesson machines without blocking
      const lessonRepo = new LessonRepository();

      Promise.all(
        blocksResult.lessons.map(async (lesson) => {
          try {
            // Create lesson record in database
            const lessonRecord = await lessonRepo.create(input.outlineRequestId, lesson.title, '');

            logger.info(
              `[Outline ${input.outlineRequestId}] Created lesson record ${lessonRecord.id} for "${lesson.title}"`,
            );

            // Create and start lesson actor machine
            const lessonActor = createActor(lessonActorMachine, {
              input: {
                lessonId: lessonRecord.id,
                outlineRequestId: input.outlineRequestId,
                lesson,
                context: {
                  topic: blocksResult.metadata.topic,
                  domains: blocksResult.metadata.domains,
                  ageRange: blocksResult.metadata.ageRange,
                  complexity: blocksResult.metadata.complexity,
                },
                lessonRepo,
                maxValidationAttempts: 3,
              },
            });

            // Register actor to prevent garbage collection
            registerActor(lessonRecord.id, lessonActor, 'lesson');

            // Subscribe for logging
            lessonActor.subscribe({
              complete: () => logger.info(`[Lesson ${lessonRecord.id}] Machine completed`),
              error: (error) => logger.error(`[Lesson ${lessonRecord.id}] Machine failed:`, error),
            });

            // Start the machine (non-blocking)
            lessonActor.start();

            logger.info(`[Lesson ${lessonRecord.id}] Machine started for "${lesson.title}"`);
          } catch (error) {
            logger.error(
              `[Outline ${input.outlineRequestId}] Failed to spawn lesson machine for "${lesson.title}":`,
              error,
            );
          }
        }),
      ).catch((error) => {
        logger.error(`[Outline ${input.outlineRequestId}] Error spawning lesson machines:`, error);
      });

      logger.info(`[Outline ${input.outlineRequestId}] Lesson machine spawning initiated (non-blocking)`);

      return blocksResult;
    }),
  },
}).createMachine({
  id: 'outlineRequestActor',
  initial: 'submitted',
  context: ({ input }) => input,
  states: {
    submitted: {
      always: 'validating',
    },

    validating: {
      invoke: {
        src: 'validateOutline',
        input: ({ context }) => ({
          validator: context.validator,
          outline: context.outline,
          outlineRepo: context.outlineRepo,
          outlineRequestId: context.outlineRequestId,
        }),
        onDone: {
          target: 'validated',
          actions: assign({
            validationResult: ({ event }) => event.output,
          }),
        },
        onError: [
          {
            // Check if this is a validation failure (flow failure) vs system error
            guard: ({ event }) => {
              const errorMessage = event.error instanceof Error ? event.error.message : String(event.error);
              return errorMessage.includes('Validation failed');
            },
            target: 'failed',
            actions: assign({
              error: ({ event }) => ({
                message: event.error instanceof Error ? event.error.message : 'Validation failed',
                error: event.error instanceof Error ? event.error.name : 'ValidationError',
              }),
            }),
          },
          {
            // System error
            target: 'error',
            actions: assign({
              error: ({ event }) => ({
                message: event.error instanceof Error ? event.error.message : 'Validation system error',
                error: event.error instanceof Error ? event.error.name : 'UnknownError',
                context: { stage: 'outline_validation' },
              }),
            }),
          },
        ],
      },
    },

    validated: {
      invoke: {
        src: fromPromise(async ({ input }: { input: OutlineRequestActorContext }) => {
          // Update validated status with validation result
          await input.outlineRepo.updateStatus(input.outlineRequestId, 'outline.validated', input.validationResult);
        }),
        input: ({ context }) => context,
        onDone: 'blocks_generating',
      },
    },

    blocks_generating: {
      invoke: {
        src: 'generateBlocks',
        input: ({ context }) => ({
          outline: context.outline,
          validationResult: context.validationResult!,
          outlineRepo: context.outlineRepo,
          outlineRequestId: context.outlineRequestId,
        }),
        onDone: {
          target: 'blocks_generated',
          actions: assign({
            blocksResult: ({ event }) => event.output,
          }),
        },
        onError: {
          target: 'error',
          actions: assign({
            error: ({ event }) => ({
              message: event.error instanceof Error ? event.error.message : 'Blocks generation system error',
              error: event.error instanceof Error ? event.error.name : 'UnknownError',
              context: { stage: 'blocks_generation' },
            }),
          }),
        },
      },
    },

    blocks_generated: {
      type: 'final',
    },

    failed: {
      type: 'final',
      invoke: {
        src: fromPromise(async ({ input }: { input: OutlineRequestActorContext }) => {
          // Update failed status with error metadata
          await input.outlineRepo.updateStatus(input.outlineRequestId, 'failed', input.error);
        }),
        input: ({ context }) => context,
      },
    },

    error: {
      type: 'final',
      invoke: {
        src: fromPromise(async ({ input }: { input: OutlineRequestActorContext }) => {
          // Update error status with error metadata
          await input.outlineRepo.updateStatus(input.outlineRequestId, 'error', input.error);
        }),
        input: ({ context }) => context,
      },
    },
  },
});
