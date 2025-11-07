// Using XState v5.23.0 - https://statelyai.github.io/xstate/
import type { ActionableBlocksResult, BlockGenerationInput } from '@/lib/types/actionable-blocks.types';
import type { Database } from '@/lib/types/database.types';
import type { LessonTSX, TSXGenerationResult } from '@/lib/types/tsx-generation.types';
import type { EnhancedValidationResult } from '@/lib/types/validation.types';
import { assign, fromPromise, setup } from 'xstate';
import type { LLMClient } from '../adapters/llm-client';
import type { OutlineValidator } from '../adapters/outline-validator';
import { compileTSX } from '../compilation/tsx-compiler';
import { logger } from '../logger';
import { LessonRepository } from '../repositories/lesson.repository';
import type { OutlineRequestRepository } from '../repositories/outline-request.repository';
import { extractValidationFeedback } from '../validation-rules.service';
import { validateTSX } from '../validation/tsx-validation-orchestrator';

// Use database enum types directly
type OutlineRequestStatus = Database['public']['Enums']['outline_request_status'];
type LessonStatus = Database['public']['Enums']['lesson_status'];

/**
 * Context for the actor-based outline request state machine
 *
 * This machine orchestrates the full 4-stage LLM flow:
 * 1. Validation - LLM validates outline
 * 2. Blocks generation - Generate teaching points
 * 3. TSX generation - Generate TSX code
 * 4. Validation & Compilation - Validate, compile, store lessons
 */
interface OutlineRequestActorContext {
  outlineRequestId: string;
  outline: string;

  // Injected dependencies
  validator: OutlineValidator;
  llmClient: LLMClient;
  outlineRepo: OutlineRequestRepository;
  lessonRepo: LessonRepository;

  // Results from each stage (stored in context for subsequent stages)
  validationResult?: EnhancedValidationResult;
  blocksResult?: ActionableBlocksResult;
  tsxResult?: TSXGenerationResult;

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
 * submitted → validating → validated → blocks_generating → blocks_generated
 *          → lessons_generating → lessons_generated (final)
 *
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
      // Persist validating status
      await input.outlineRepo.createStatusRecord(input.outlineRequestId, 'outline.validating', undefined);

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

      // Persist validating status with result
      await input.outlineRepo.createStatusRecord(input.outlineRequestId, 'outline.validating', enhancedResult);

      return enhancedResult;
    }),

    /**
     * Stage 2: Generate actionable teaching blocks
     */
    generateBlocks: fromPromise<
      ActionableBlocksResult,
      {
        llmClient: LLMClient;
        outline: string;
        validationResult: EnhancedValidationResult;
        outlineRepo: OutlineRequestRepository;
        outlineRequestId: string;
      }
    >(async ({ input }) => {
      // Persist blocks generating status
      await input.outlineRepo.createStatusRecord(input.outlineRequestId, 'outline.blocks.generating', undefined);

      const feedback = extractValidationFeedback(input.validationResult);

      const blocksInput: BlockGenerationInput = {
        originalOutline: input.outline,
        validationFeedback: feedback,
      };

      const blocksResult = await input.llmClient.generateBlocks(blocksInput);

      // Update blocks in database
      await input.outlineRepo.updateBlocks(input.outlineRequestId, blocksResult);

      // Persist blocks generating status with metadata
      await input.outlineRepo.createStatusRecord(input.outlineRequestId, 'outline.blocks.generating', blocksResult);

      return blocksResult;
    }),

    /**
     * Stage 3: Generate TSX code for all lessons (sequential generation)
     *
     * Generates one lesson at a time to enable:
     * - Better error isolation per lesson
     * - Future parallelization support
     * - 1 prompt = 1 lesson = 1 table row
     */
    generateTSX: fromPromise<
      TSXGenerationResult,
      {
        llmClient: LLMClient;
        blocksResult: ActionableBlocksResult;
        outlineRepo: OutlineRequestRepository;
        outlineRequestId: string;
      }
    >(async ({ input }) => {
      // Persist lessons generating status
      await input.outlineRepo.createStatusRecord(input.outlineRequestId, 'lessons.generating', undefined);

      const { llmClient, blocksResult } = input;
      const { lessons, metadata } = blocksResult;

      // Extract context for single-lesson generation
      const context = {
        topic: metadata.topic,
        ageRange: metadata.ageRange,
        complexity: metadata.complexity,
        domains: metadata.domains,
      };

      // Generate TSX for each lesson sequentially
      const generatedLessons: LessonTSX[] = [];

      for (const lesson of lessons) {
        const singleLessonInput = {
          title: lesson.title,
          blocks: lesson.blocks,
          context,
        };

        const lessonResult = await llmClient.generateSingleLessonTSX(singleLessonInput);
        generatedLessons.push(lessonResult);
      }

      // Assemble final result in same format as batch generation
      const tsxResult: TSXGenerationResult = {
        lessons: generatedLessons,
        metadata: {
          lessonCount: generatedLessons.length,
          model: process.env.OLLAMA_GENERATION_MODEL || 'deepseek-coder-v2',
          generatedAt: new Date().toISOString(),
        },
      };

      // Persist lessons generating status with metadata
      await input.outlineRepo.createStatusRecord(input.outlineRequestId, 'lessons.generating', tsxResult);

      return tsxResult;
    }),

    /**
     * Stage 4: Validate and compile all lessons
     *
     * Returns summary indicating if all completed, any failed, or any errored
     */
    validateAndCompileLessons: fromPromise<
      { allCompleted: boolean; anyFailed: boolean; anyErrored: boolean; totalLessons: number },
      {
        lessonRepo: LessonRepository;
        llmClient: LLMClient;
        outlineRequestId: string;
        blocksResult: ActionableBlocksResult;
        tsxResult: TSXGenerationResult;
      }
    >(async ({ input }) => {
      const { lessonRepo, llmClient, outlineRequestId, blocksResult, tsxResult } = input;

      const maxRetries = Number(process.env.LLM_GENERATION_MAX_RETRIES || 3);
      const maxAttempts = maxRetries + 1;

      let completedCount = 0;
      let failedCount = 0;
      let errorCount = 0;

      // Process each lesson
      for (let i = 0; i < blocksResult.lessons.length; i++) {
        const lesson = blocksResult.lessons[i];
        const tsxLesson = tsxResult.lessons[i];

        try {
          // Step 1: Create lesson record with generated TSX code (lesson.generating implicitly)
          const generatedCode = {
            tsxCode: tsxLesson.tsxCode,
            componentName: tsxLesson.componentName,
          };

          const createdLesson = await lessonRepo.create(lesson.title, generatedCode);

          // Step 2: Mark as lesson.generated
          await lessonRepo.createStatusRecord(createdLesson.id, 'lesson.generated' as LessonStatus, {
            title: lesson.title,
            componentName: generatedCode.componentName,
            tsxCodeSize: generatedCode.tsxCode.length,
            blockCount: lesson.blocks.length,
          });

          // Create mapping between outline request and lesson
          await lessonRepo.createMapping(outlineRequestId, createdLesson.id);

          // Step 3: Validate TSX (lesson.validating)
          // Load existing validation attempts (for crash recovery)
          const existingAttempts = await lessonRepo.getValidationAttempts(createdLesson.id);
          let retryCount = existingAttempts;

          let validationResult;
          let validationPassed = false;

          while (retryCount < maxAttempts) {
            validationResult = await validateTSX(generatedCode.tsxCode);

            if (validationResult.valid) {
              await lessonRepo.createStatusRecord(createdLesson.id, 'lesson.validating' as LessonStatus, {
                attempt: retryCount + 1,
                errors: [],
                success: true,
              });
              validationPassed = true;
              break;
            }

            // Validation failed
            const validationMetadata = {
              attempt: retryCount + 1,
              errors: validationResult.errors,
              failureReason: 'TSX validation failed',
            };

            await lessonRepo.createStatusRecord(
              createdLesson.id,
              'lesson.validating' as LessonStatus,
              validationMetadata,
            );

            retryCount++;

            if (retryCount >= maxAttempts) {
              // Max validation retries exceeded - mark as failed (LLM input failure)
              await lessonRepo.createStatusRecord(createdLesson.id, 'failed' as LessonStatus, {
                ...validationMetadata,
                finalFailure: true,
                totalAttempts: retryCount,
                message: 'Max validation retries exceeded',
              });
              failedCount++;
              break; // Move to next lesson
            }

            // Regenerate TSX with LLM feedback
            try {
              logger.info(`Regenerating TSX for lesson ${createdLesson.id}, attempt ${retryCount + 1}`);

              const regenerationResult = await llmClient.regenerateTSXWithFeedback({
                originalCode: generatedCode.tsxCode,
                componentName: generatedCode.componentName,
                validationErrors: validationResult.errors,
                lessonTitle: lesson.title,
                blocks: lesson.blocks,
                attemptNumber: retryCount + 1,
              });

              // Update with regenerated code
              generatedCode.tsxCode = regenerationResult.tsxCode;
              generatedCode.componentName = regenerationResult.componentName;

              // Update database with regenerated code
              await lessonRepo.updateGeneratedCode(createdLesson.id, generatedCode);

              // Log fixes applied
              await lessonRepo.createStatusRecord(createdLesson.id, 'lesson.validating' as LessonStatus, {
                attempt: retryCount + 1,
                regenerated: true,
                fixedErrors: regenerationResult.fixedErrors,
              });
            } catch (regenerationError) {
              // LLM regeneration failed - mark as error (system failure)
              const errorMessage =
                regenerationError instanceof Error ? regenerationError.message : 'LLM regeneration failed';
              const errorName = regenerationError instanceof Error ? regenerationError.name : 'RegenerationError';

              // Detect schema validation failures (common issue)
              const isSchemaError =
                errorMessage.includes('did not match schema') ||
                errorMessage.includes('No object generated') ||
                errorMessage.includes('response did not match schema');

              if (isSchemaError) {
                logger.error(`LLM regeneration schema validation failed for lesson ${createdLesson.id}:`, {
                  message: errorMessage,
                  attempt: retryCount + 1,
                  hint: 'LLM may have returned invalid JSON structure or missing required fields',
                });
              } else {
                logger.error(`LLM regeneration failed for lesson ${createdLesson.id}:`, regenerationError);
              }

              await lessonRepo.createStatusRecord(createdLesson.id, 'error' as LessonStatus, {
                message: errorMessage,
                error: errorName,
                attempt: retryCount + 1,
                context: {
                  stage: 'tsx_regeneration',
                  isSchemaError,
                  validationErrorCount: validationResult?.errors?.length || 0,
                },
              });
              errorCount++;
              break; // Move to next lesson
            }
          }

          if (!validationPassed) {
            continue; // Skip compilation for failed lesson
          }

          // Step 4: Compile TSX to JavaScript (lesson.compiling)
          const compilationStartTime = Date.now();

          let compiledCode;
          try {
            compiledCode = compileTSX(generatedCode.tsxCode);

            await lessonRepo.createStatusRecord(createdLesson.id, 'lesson.compiling' as LessonStatus, {
              originalSize: generatedCode.tsxCode.length,
              compiledSize: compiledCode.length,
              compressionRatio: (compiledCode.length / generatedCode.tsxCode.length).toFixed(2),
              compilationTime: Date.now() - compilationStartTime,
            });
          } catch (error) {
            // Compilation error (system/technical error)
            const errorMetadata = {
              message: error instanceof Error ? error.message : 'Compilation error',
              error: error instanceof Error ? error.name : 'UnknownError',
              originalSize: generatedCode.tsxCode.length,
              compilationTime: Date.now() - compilationStartTime,
            };

            await lessonRepo.createStatusRecord(createdLesson.id, 'error' as LessonStatus, errorMetadata);
            errorCount++;
            continue; // Move to next lesson
          }

          // Step 5: Update lesson with compiled code
          await lessonRepo.updateCompiledCode(createdLesson.id, {
            javascript: compiledCode,
            componentName: generatedCode.componentName,
          });

          // Step 6: Mark as completed
          await lessonRepo.createStatusRecord(createdLesson.id, 'completed' as LessonStatus, {
            title: lesson.title,
            componentName: generatedCode.componentName,
            validationAttempts: retryCount + 1,
            tsxCodeSize: generatedCode.tsxCode.length,
            compiledCodeSize: compiledCode.length,
            totalBlocks: lesson.blocks.length,
          });

          completedCount++;
        } catch (error) {
          // Unexpected error during lesson processing
          logger.error('Error processing lesson:', error);
          errorCount++;
        }
      }

      const totalLessons = blocksResult.lessons.length;
      const allCompleted = completedCount === totalLessons;
      const anyFailed = failedCount > 0;
      const anyErrored = errorCount > 0;

      return {
        allCompleted,
        anyFailed,
        anyErrored,
        totalLessons,
      };
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
          // Persist validated status
          await input.outlineRepo.createStatusRecord(
            input.outlineRequestId,
            'outline.validated',
            input.validationResult,
          );
        }),
        input: ({ context }) => context,
        onDone: 'blocks_generating',
      },
    },

    blocks_generating: {
      invoke: {
        src: 'generateBlocks',
        input: ({ context }) => ({
          llmClient: context.llmClient,
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
      invoke: {
        src: fromPromise(async ({ input }: { input: OutlineRequestActorContext }) => {
          // Persist blocks generated status
          await input.outlineRepo.createStatusRecord(input.outlineRequestId, 'outline.blocks.generated', undefined);
        }),
        input: ({ context }) => context,
        onDone: 'lessons_generating',
      },
    },

    lessons_generating: {
      invoke: {
        src: 'generateTSX',
        input: ({ context }) => ({
          llmClient: context.llmClient,
          blocksResult: context.blocksResult!,
          outlineRepo: context.outlineRepo,
          outlineRequestId: context.outlineRequestId,
        }),
        onDone: {
          target: 'lessons_generated',
          actions: assign({
            tsxResult: ({ event }) => event.output,
          }),
        },
        onError: {
          target: 'error',
          actions: assign({
            error: ({ event }) => ({
              message: event.error instanceof Error ? event.error.message : 'TSX generation system error',
              error: event.error instanceof Error ? event.error.name : 'UnknownError',
              context: { stage: 'tsx_generation' },
            }),
          }),
        },
      },
    },

    lessons_generated: {
      invoke: {
        src: fromPromise(async ({ input }: { input: OutlineRequestActorContext }) => {
          // Persist lessons.generated status
          await input.outlineRepo.createStatusRecord(
            input.outlineRequestId,
            'lessons.generated' as OutlineRequestStatus,
            {
              totalLessons: input.blocksResult?.lessons.length || 0,
            },
          );
        }),
        input: ({ context }) => context,
        onDone: 'lessons_validating',
      },
    },

    lessons_validating: {
      invoke: {
        src: 'validateAndCompileLessons',
        input: ({ context }) => ({
          lessonRepo: context.lessonRepo,
          llmClient: context.llmClient,
          outlineRequestId: context.outlineRequestId,
          blocksResult: context.blocksResult!,
          tsxResult: context.tsxResult!,
        }),
        onDone: [
          {
            // All lessons completed successfully
            guard: ({ event }) => event.output.allCompleted,
            target: 'lessons_validated',
          },
          {
            // At least one lesson failed (LLM input failure)
            guard: ({ event }) => event.output.anyFailed,
            target: 'failed',
            actions: assign({
              error: ({ event }) => ({
                message: 'At least one lesson failed validation',
                failedLessons: event.output.totalLessons - (event.output.allCompleted ? event.output.totalLessons : 0),
              }),
            }),
          },
          {
            // At least one lesson had system/technical error
            guard: ({ event }) => event.output.anyErrored,
            target: 'error',
            actions: assign({
              error: () => ({
                message: 'At least one lesson encountered a system error',
                context: { stage: 'lesson_validation_compilation' },
              }),
            }),
          },
        ],
        onError: {
          target: 'error',
          actions: assign({
            error: ({ event }) => ({
              message: event.error instanceof Error ? event.error.message : 'Lesson validation/compilation error',
              error: event.error instanceof Error ? event.error.name : 'UnknownError',
              context: { stage: 'lesson_validation_compilation' },
            }),
          }),
        },
      },
    },

    lessons_validated: {
      invoke: {
        src: fromPromise(async ({ input }: { input: OutlineRequestActorContext }) => {
          // Persist lessons.validated status
          await input.outlineRepo.createStatusRecord(
            input.outlineRequestId,
            'lessons.validated' as OutlineRequestStatus,
            {
              totalLessons: input.blocksResult?.lessons.length || 0,
              allCompleted: true,
            },
          );
        }),
        input: ({ context }) => context,
        onDone: 'completed',
      },
    },

    completed: {
      type: 'final',
      invoke: {
        src: fromPromise(async ({ input }: { input: OutlineRequestActorContext }) => {
          // Persist completed status
          await input.outlineRepo.createStatusRecord(input.outlineRequestId, 'completed' as OutlineRequestStatus, {
            totalLessons: input.blocksResult?.lessons.length || 0,
            lessonsCompleted: input.blocksResult?.lessons.length || 0,
          });
        }),
        input: ({ context }) => context,
      },
    },

    failed: {
      type: 'final',
      invoke: {
        src: fromPromise(async ({ input }: { input: OutlineRequestActorContext }) => {
          // Persist failed status with error metadata
          await input.outlineRepo.createStatusRecord(input.outlineRequestId, 'failed', input.error);
        }),
        input: ({ context }) => context,
      },
    },

    error: {
      type: 'final',
      invoke: {
        src: fromPromise(async ({ input }: { input: OutlineRequestActorContext }) => {
          // Persist error status with error metadata
          await input.outlineRepo.createStatusRecord(input.outlineRequestId, 'error', input.error);
        }),
        input: ({ context }) => context,
      },
    },
  },
});
