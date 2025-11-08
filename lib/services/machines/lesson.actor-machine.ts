// Using XState v5.23.0 - https://statelyai.github.io/xstate/
import type { Lesson } from '@/lib/types/actionable-blocks.types';
import type { TSXValidationResult } from '@/lib/types/validation.types';
import { assign, fromPromise, setup } from 'xstate';
import { TSX_GENERATION_SYSTEM_PROMPT, buildSingleLessonTSXPrompt } from '../../prompts/tsx-generation.prompts';
import { TSX_REGENERATION_SYSTEM_PROMPT, buildTSXRegenerationUserPrompt } from '../../prompts/tsx-regeneration.prompts';
import { createAIModel } from '../adapters/llm-config';
import { generateSingleLessonTSX } from '../adapters/tsx-generator-core';
import { regenerateTSX } from '../adapters/tsx-regenerator-core';
import { compileAndWriteTSX } from '../compilation/tsx-compiler';
import { logger } from '../logger';
import type { LessonRepository } from '../repositories/lesson.repository';
import { validateTSX } from '../validation/tsx-validation-orchestrator';

/**
 * Context for the lesson state machine
 *
 * This machine orchestrates a single lesson's generation and validation flow:
 * 1. generating - Generate TSX code for lesson
 * 2. generated - Store generated code
 * 3. validating - Validate TSX, retry if errors (up to max attempts)
 * 4. compiled - Final state, TSX validated and compiled
 *
 * Error states:
 * - failed: Validation failed after max attempts (flow failure)
 * - error: System error (system failure)
 */
interface LessonActorContext {
  lessonId: string;
  outlineRequestId: string;

  // Lesson data
  lesson: Lesson;

  // Context metadata for TSX generation
  context: {
    topic: string;
    domains: string[];
    ageRange: [number, number];
    complexity: string;
  };

  // Injected dependencies
  lessonRepo: LessonRepository;

  // Configuration
  maxValidationAttempts: number;

  // Results from each stage
  generatedCode?: string;
  compiledCode?: string;
  filePaths?: { generatedFilePath: string; compiledFilePath: string };

  // Validation tracking
  validationAttempts?: number;
  lastValidationErrors?: TSXValidationResult['errors'];

  // Error metadata for failed/error states
  error?: unknown;
}

/**
 * Input type for initializing the machine
 */
type LessonActorInput = LessonActorContext;

/**
 * Events - Auto-generated from state transitions
 * The machine drives transitions via invoke onDone/onError
 */
type LessonActorEvent = { type: string };

/**
 * Actor-based state machine for lesson processing
 *
 * Uses XState v5's invoke pattern to embed business logic directly in states.
 * Each state invokes async actors (promise-based) to perform work.
 *
 * Flow:
 * generating → generated → validating → compiled (final)
 *
 * Validation retry loop:
 * - If validation fails, increment attempts counter
 * - If attempts < max, regenerate TSX with error feedback
 * - If attempts >= max, transition to 'failed' state
 *
 * Error handling via onError transitions to 'error' or 'failed' final states.
 */
export const lessonActorMachine = setup({
  types: {
    context: {} as LessonActorContext,
    input: {} as LessonActorInput,
    events: {} as LessonActorEvent,
  },
  actors: {
    /**
     * Stage 1: Generate TSX code for lesson
     *
     * Calls LLM to generate React/Next.js TSX from lesson blocks.
     */
    generateTSX: fromPromise<
      { tsxCode: string },
      {
        lesson: Lesson;
        context: LessonActorContext['context'];
        lessonRepo: LessonRepository;
        lessonId: string;
      }
    >(async ({ input }) => {
      logger.info(`[Lesson ${input.lessonId}] Generating TSX code...`);

      const modelName = process.env.CODE_GENERATION_MODEL || 'qwen2.5-coder';
      const model = createAIModel(modelName);

      const result = await generateSingleLessonTSX(
        {
          title: input.lesson.title,
          blocks: input.lesson.blocks,
          context: input.context,
        },
        {
          model,
          systemPrompt: TSX_GENERATION_SYSTEM_PROMPT,
          buildUserPrompt: buildSingleLessonTSXPrompt,
          temperature: 0.4,
        },
      );

      // Store generated code in database
      await input.lessonRepo.updateGeneratedCode(input.lessonId, result.tsxCode);

      logger.info(`[Lesson ${input.lessonId}] TSX code generated successfully`);

      return { tsxCode: result.tsxCode };
    }),

    /**
     * Stage 2: Validate and compile TSX code
     *
     * Validates TSX using TypeScript and import checks.
     * If validation passes:
     * - Compiles TSX to JavaScript
     * - Writes both TSX and JS files to disk
     * - Updates database with compiled code and file paths
     *
     * If validation fails:
     * - Increments validation attempts counter
     * - If attempts < max, regenerates TSX with error feedback
     * - If attempts >= max, throws error to transition to 'failed' state
     */
    validateAndCompile: fromPromise<
      { compiledCode: string; filePaths: { generatedFilePath: string; compiledFilePath: string } },
      {
        tsxCode: string;
        lessonId: string;
        lesson: Lesson;
        context: LessonActorContext['context'];
        lessonRepo: LessonRepository;
        maxValidationAttempts: number;
      }
    >(async ({ input }) => {
      const { tsxCode, lessonId, lesson, lessonRepo, maxValidationAttempts } = input;

      // Update status to validating
      await lessonRepo.updateStatus(lessonId, 'lesson.validating', undefined);
      logger.info(`[Lesson ${lessonId}] Validating TSX code...`);

      let currentCode = tsxCode;
      let attempts = 0;

      // Validation retry loop
      while (attempts < maxValidationAttempts) {
        attempts++;
        await lessonRepo.incrementValidationAttempts(lessonId);

        logger.info(`[Lesson ${lessonId}] Validation attempt ${attempts}/${maxValidationAttempts}`);

        // Validate TSX
        const validationResult = await validateTSX(currentCode);

        if (validationResult.valid) {
          logger.info(`[Lesson ${lessonId}] Validation passed on attempt ${attempts}`);

          // Compile and write files
          const filePaths = await compileAndWriteTSX(currentCode, lessonId);

          // Read compiled JavaScript from file
          const fs = await import('fs/promises');
          const compiledJS = await fs.readFile(filePaths.jsPath, 'utf-8');

          // Update database with compiled code and file paths
          await lessonRepo.updateCompiledCodeAndPaths(lessonId, {
            compiledCode: compiledJS,
            filePaths: {
              generatedFilePath: filePaths.tsxPath,
              compiledFilePath: filePaths.jsPath,
            },
          });

          // Update status to compiled (must happen before entering final state)
          await lessonRepo.updateStatus(lessonId, 'lesson.compiled', undefined);

          logger.info(`[Lesson ${lessonId}] TSX compiled and written successfully`);

          return {
            compiledCode: compiledJS,
            filePaths: {
              generatedFilePath: filePaths.tsxPath,
              compiledFilePath: filePaths.jsPath,
            },
          };
        }

        // Validation failed
        logger.warn(
          `[Lesson ${lessonId}] Validation failed (attempt ${attempts}): ${validationResult.errors.length} errors`,
        );

        // Update validating status with error details
        await lessonRepo.updateStatus(lessonId, 'lesson.validating', {
          attemptNumber: attempts,
          errors: validationResult.errors,
        });

        // If max attempts reached, throw error to transition to 'failed'
        if (attempts >= maxValidationAttempts) {
          throw new Error(
            `Validation failed after ${maxValidationAttempts} attempts. Last errors: ${validationResult.errors.map((e) => e.message).join(', ')}`,
          );
        }

        // Regenerate TSX with error feedback
        logger.info(`[Lesson ${lessonId}] Regenerating TSX with error feedback...`);

        const modelName = process.env.CODE_GENERATION_MODEL || 'qwen2.5-coder';
        const model = createAIModel(modelName);

        const regenerationResult = await regenerateTSX(
          {
            originalCode: currentCode,
            validationErrors: validationResult.errors,
            lessonTitle: lesson.title,
            blocks: lesson.blocks,
            attemptNumber: attempts + 1,
          },
          {
            model,
            systemPrompt: TSX_REGENERATION_SYSTEM_PROMPT,
            buildUserPrompt: buildTSXRegenerationUserPrompt,
            temperature: 0.3,
          },
        );

        currentCode = regenerationResult.tsxCode;

        // Update database with regenerated code
        await lessonRepo.updateGeneratedCode(lessonId, currentCode);

        logger.info(`[Lesson ${lessonId}] TSX regenerated, retrying validation...`);
      }

      // Should never reach here due to throw above, but TypeScript needs this
      throw new Error(`Validation failed after ${maxValidationAttempts} attempts`);
    }),
  },
}).createMachine({
  id: 'lessonActor',
  initial: 'generating',
  context: ({ input }) => input,
  states: {
    generating: {
      invoke: {
        src: 'generateTSX',
        input: ({ context }) => ({
          lesson: context.lesson,
          context: context.context,
          lessonRepo: context.lessonRepo,
          lessonId: context.lessonId,
        }),
        onDone: {
          target: 'generated',
          actions: assign({
            generatedCode: ({ event }) => event.output.tsxCode,
          }),
        },
        onError: {
          target: 'error',
          actions: assign({
            error: ({ event, context }) => ({
              message: event.error instanceof Error ? event.error.message : 'TSX generation system error',
              error: event.error instanceof Error ? event.error.name : 'UnknownError',
              context: { stage: 'tsx_generation', lessonId: context.lessonId },
            }),
          }),
        },
      },
    },

    generated: {
      invoke: {
        src: fromPromise(async ({ input }: { input: LessonActorContext }) => {
          // Update generated status
          await input.lessonRepo.updateStatus(input.lessonId, 'lesson.generated', undefined);
          logger.info(`[Lesson ${input.lessonId}] Status updated to lesson.generated`);
        }),
        input: ({ context }) => context,
        onDone: 'validating',
      },
    },

    validating: {
      invoke: {
        src: 'validateAndCompile',
        input: ({ context }) => ({
          tsxCode: context.generatedCode!,
          lessonId: context.lessonId,
          lesson: context.lesson,
          context: context.context,
          lessonRepo: context.lessonRepo,
          maxValidationAttempts: context.maxValidationAttempts,
        }),
        onDone: {
          target: 'compiled',
          actions: assign({
            compiledCode: ({ event }) => event.output.compiledCode,
            filePaths: ({ event }) => event.output.filePaths,
          }),
        },
        onError: [
          {
            // Check if this is a validation failure (flow failure) vs system error
            guard: ({ event }) => {
              const errorMessage = event.error instanceof Error ? event.error.message : String(event.error);
              return errorMessage.includes('Validation failed after');
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
              error: ({ event, context }) => ({
                message: event.error instanceof Error ? event.error.message : 'Validation system error',
                error: event.error instanceof Error ? event.error.name : 'UnknownError',
                context: { stage: 'tsx_validation', lessonId: context.lessonId },
              }),
            }),
          },
        ],
      },
    },

    compiled: {
      type: 'final',
      // Status already updated in validateAndCompile actor before reaching this state
    },

    failed: {
      type: 'final',
      invoke: {
        src: fromPromise(async ({ input }: { input: LessonActorContext }) => {
          // Update failed status with error metadata
          await input.lessonRepo.updateStatus(input.lessonId, 'failed', input.error);
          logger.error(`[Lesson ${input.lessonId}] Status updated to failed`);
        }),
        input: ({ context }) => context,
      },
    },

    error: {
      type: 'final',
      invoke: {
        src: fromPromise(async ({ input }: { input: LessonActorContext }) => {
          // Update error status with error metadata
          await input.lessonRepo.updateStatus(input.lessonId, 'error', input.error);
          logger.error(`[Lesson ${input.lessonId}] Status updated to error`);
        }),
        input: ({ context }) => context,
      },
    },
  },
});
