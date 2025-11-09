// Using Vercel Workflow DevKit v4 - https://useworkflow.dev
// Workflow functions cannot import Node.js modules - all work must be in steps
import type { Lesson } from '@/lib/types/actionable-blocks.types';

/**
 * Lesson processing workflow
 *
 * Flow:
 * 1. Generate TSX code for lesson using LLM
 * 2. Validate and compile TSX (with retry loop up to max attempts)
 *
 * Replaces: lib/services/machines/lesson.actor-machine.ts
 *
 * Note: Workflows cannot import Node.js modules (fs, path, http, etc.)
 * All actual work must be done in step functions.
 */
export async function processLessonWorkflow(input: {
  lessonId: string;
  outlineRequestId: string;
  lesson: Lesson;
  context: {
    topic: string;
    domains: string[];
    ageRange: [number, number];
    complexity: string;
  };
  maxValidationAttempts: number;
}) {
  'use workflow';

  const { lessonId, lesson, context, maxValidationAttempts } = input;

  // Step 1: Generate TSX
  const tsxCode = await generateTSXStep({
    lesson,
    context,
    lessonId,
  });

  // Step 2: Validate and compile (with retry loop)
  await validateAndCompileTSXStep({
    tsxCode,
    lessonId,
    lesson,
    maxValidationAttempts,
  });

  return { success: true, lessonId };
}

/**
 * Step 1: Generate TSX code for lesson
 */
async function generateTSXStep(input: {
  lesson: Lesson;
  context: {
    topic: string;
    domains: string[];
    ageRange: [number, number];
    complexity: string;
  };
  lessonId: string;
}): Promise<string> {
  'use step';

  // Import inside step to avoid workflow-level restrictions
  const { createContextForSingleLessonTSX, generateSingleLessonTSX } = await import(
    '../services/adapters/tsx-generator-core'
  );
  const { LessonRepository } = await import('../services/repositories/lesson.repository');
  const { logger } = await import('../services/logger');

  const { lesson, context, lessonId } = input;
  const lessonRepo = new LessonRepository();

  logger.info(`[Lesson ${lessonId}] Generating TSX code...`);

  const generationContext = createContextForSingleLessonTSX();

  const result = await generateSingleLessonTSX(generationContext, {
    title: lesson.title,
    blocks: lesson.blocks,
    context,
  });

  // Update database with generated code
  await lessonRepo.updateGeneratedCode(lessonId, result.tsxCode);
  await lessonRepo.updateStatus(lessonId, 'lesson.generated', undefined);

  logger.info(`[Lesson ${lessonId}] TSX code generated successfully`);

  return result.tsxCode;
}

/**
 * Step 2: Validate and compile TSX code with retry loop
 *
 * Validates TSX using TypeScript and import checks.
 * If validation fails, regenerates TSX with error feedback up to maxValidationAttempts.
 */
async function validateAndCompileTSXStep(input: {
  tsxCode: string;
  lessonId: string;
  lesson: Lesson;
  maxValidationAttempts: number;
}): Promise<void> {
  'use step';

  // Import inside step to avoid workflow-level restrictions
  const { validateTSX } = await import('../services/validation/tsx-validation-orchestrator');
  const { compileAndWriteTSX } = await import('../services/compilation/tsx-compiler');
  const { createContextForTSXRegeneration, regenerateTSX } = await import('../services/adapters/tsx-regenerator-core');
  const { LessonRepository } = await import('../services/repositories/lesson.repository');
  const { logger } = await import('../services/logger');

  const { tsxCode, lessonId, lesson, maxValidationAttempts } = input;
  const lessonRepo = new LessonRepository();

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

      // Update status to compiled
      await lessonRepo.updateStatus(lessonId, 'lesson.compiled', undefined);

      logger.info(`[Lesson ${lessonId}] TSX compiled and written successfully`);
      return;
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

    // If max attempts reached, update failed status and throw error
    if (attempts >= maxValidationAttempts) {
      const errorMessage = `Validation failed after ${maxValidationAttempts} attempts. Last errors: ${validationResult.errors.map((e) => e.message).join(', ')}`;

      await lessonRepo.updateStatus(lessonId, 'failed', {
        message: errorMessage,
        error: 'ValidationError',
      });

      throw new Error(errorMessage);
    }

    // Regenerate TSX with error feedback
    logger.info(`[Lesson ${lessonId}] Regenerating TSX with error feedback...`);

    const regenerationContext = createContextForTSXRegeneration();

    const regenerationResult = await regenerateTSX(regenerationContext, {
      originalCode: currentCode,
      validationErrors: validationResult.errors,
      lessonTitle: lesson.title,
      blocks: lesson.blocks,
      attemptNumber: attempts + 1,
    });

    currentCode = regenerationResult.tsxCode;

    // Update database with regenerated code
    await lessonRepo.updateGeneratedCode(lessonId, currentCode);

    logger.info(`[Lesson ${lessonId}] TSX regenerated, retrying validation...`);
  }

  // Should never reach here due to throw above, but TypeScript needs this
  throw new Error(`Validation failed after ${maxValidationAttempts} attempts`);
}
