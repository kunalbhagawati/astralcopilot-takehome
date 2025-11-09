// Using Vercel Workflow DevKit v4 - https://useworkflow.dev
// Workflow functions cannot import Node.js modules - all work must be in steps
import type { ActionableBlocksResult } from '@/lib/types/actionable-blocks.types';
import type { Lesson } from '@/lib/types/actionable-blocks.types';
import type { EnhancedValidationResult } from '@/lib/types/validation.types';

/**
 * Main outline processing workflow
 *
 * Flow:
 * 1. Validate outline using LLM
 * 2. Generate actionable teaching blocks
 * 3. Spawn parallel lesson workflows for each lesson
 *
 * Replaces: lib/services/machines/outline-request.actor-machine.ts
 *
 * Note: Workflows cannot import Node.js modules (fs, path, http, etc.)
 * All actual work must be done in step functions.
 */
export async function processOutlineWorkflow(input: { outlineRequestId: string; outline: string }) {
  'use workflow';

  const { outlineRequestId, outline } = input;

  // Step 1: Validate outline
  const validationResult = await validateOutlineStep({
    outline,
    outlineRequestId,
  });

  // Step 2: Generate blocks
  const blocksResult = await generateBlocksStep({
    outline,
    validationResult,
    outlineRequestId,
  });

  // Step 3: Spawn lesson workflows
  await spawnLessonWorkflowsStep({
    outlineRequestId,
    blocksResult,
  });

  return { success: true, outlineRequestId };
}

/**
 * Step 1: Validate outline using LLM
 */
async function validateOutlineStep(input: {
  outline: string;
  outlineRequestId: string;
}): Promise<EnhancedValidationResult> {
  'use step';

  // Import inside step to avoid workflow-level restrictions
  const { getOutlineValidator } = await import('../services/adapters/outline-validator');
  const { OutlineRequestRepository } = await import('../services/repositories/outline-request.repository');
  const { logger } = await import('../services/logger');

  const { outline, outlineRequestId } = input;
  const outlineRepo = new OutlineRequestRepository();

  logger.info(`[Workflow ${outlineRequestId}] Validating outline...`);
  await outlineRepo.updateStatus(outlineRequestId, 'outline.validating', undefined);

  const validator = getOutlineValidator();
  const result = await validator.validate(outline);

  logger.info(`[Workflow ${outlineRequestId}] Validation completed. Valid:`, result.valid);

  if (!result.valid) {
    logger.error(`[Workflow ${outlineRequestId}] Validation FAILED. Errors:`, result.errors);

    // Update failed status BEFORE throwing
    const errorMetadata = {
      message: 'Validation failed: ' + (result.errors?.join(', ') || 'Unknown error'),
      error: 'ValidationError',
      errors: result.errors,
    };
    await outlineRepo.updateStatus(outlineRequestId, 'failed', errorMetadata);
    logger.info(`[Workflow ${outlineRequestId}] Failed status updated in database`);

    throw new Error('Validation failed: ' + (result.errors?.join(', ') || 'Unknown error'));
  }

  // Extract enhanced result
  const enhancedResult = (result as { enhancedResult?: EnhancedValidationResult }).enhancedResult;

  if (!enhancedResult) {
    throw new Error('Validation failed: No enhanced result available');
  }

  // Update validated status
  await outlineRepo.updateStatus(outlineRequestId, 'outline.validated', enhancedResult);
  logger.info(`[Workflow ${outlineRequestId}] Outline validated successfully`);

  return enhancedResult;
}

/**
 * Step 2: Generate actionable teaching blocks
 */
async function generateBlocksStep(input: {
  outline: string;
  validationResult: EnhancedValidationResult;
  outlineRequestId: string;
}): Promise<ActionableBlocksResult> {
  'use step';

  // Import inside step to avoid workflow-level restrictions
  const { createContextForBlocksGeneration, generateBlocks } = await import(
    '../services/adapters/blocks-generator-core'
  );
  const { OutlineRequestRepository } = await import('../services/repositories/outline-request.repository');
  const { extractValidationFeedback } = await import('../services/validation-rules.service');
  const { logger } = await import('../services/logger');

  const { outline, validationResult, outlineRequestId } = input;
  const outlineRepo = new OutlineRequestRepository();

  logger.info(`[Workflow ${outlineRequestId}] Generating teaching blocks...`);
  await outlineRepo.updateStatus(outlineRequestId, 'outline.blocks.generating', undefined);

  const feedback = extractValidationFeedback(validationResult);
  logger.info(`[Workflow ${outlineRequestId}] Extracted validation feedback`);

  const context = createContextForBlocksGeneration();
  const blocksResult = await generateBlocks(context, {
    originalOutline: outline,
    validationFeedback: feedback,
  });

  logger.info(`[Workflow ${outlineRequestId}] Blocks generated:`, blocksResult.lessons.length, 'lessons');

  // Update blocks in database
  await outlineRepo.updateBlocks(outlineRequestId, blocksResult);
  await outlineRepo.updateStatus(outlineRequestId, 'outline.blocks.generated', undefined);
  await outlineRepo.updateNumLessons(outlineRequestId, blocksResult.lessons.length);

  logger.info(`[Workflow ${outlineRequestId}] Blocks generation completed`);
  return blocksResult;
}

/**
 * Step 3: Spawn lesson workflows in parallel
 */
async function spawnLessonWorkflowsStep(input: {
  outlineRequestId: string;
  blocksResult: ActionableBlocksResult;
}): Promise<void> {
  'use step';

  // Import inside step to avoid workflow-level restrictions
  const { LessonRepository } = await import('../services/repositories/lesson.repository');
  const { logger } = await import('../services/logger');

  const { outlineRequestId, blocksResult } = input;
  const lessonRepo = new LessonRepository();

  logger.info(`[Workflow ${outlineRequestId}] Creating lesson records and triggering workflows...`);

  // Create lesson records and trigger independent workflows in parallel
  const lessonWorkflowPromises = blocksResult.lessons.map(async (lesson: Lesson) => {
    try {
      // Create lesson record in database
      const lessonRecord = await lessonRepo.create(outlineRequestId, lesson.title, '');

      logger.info(`[Workflow ${outlineRequestId}] Created lesson record ${lessonRecord.id} for "${lesson.title}"`);

      // Trigger independent lesson workflow via API endpoint
      // Use VERCEL_URL (auto-set by Vercel) or localhost for local dev
      const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000';

      const response = await fetch(`${baseUrl}/api/lessons/${lessonRecord.id}/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lessonId: lessonRecord.id,
          outlineRequestId,
          lesson,
          context: {
            topic: blocksResult.metadata.topic,
            domains: blocksResult.metadata.domains,
            ageRange: blocksResult.metadata.ageRange,
            complexity: blocksResult.metadata.complexity,
          },
          maxValidationAttempts: 3,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to trigger lesson workflow: ${response.statusText}`);
      }

      const { runId } = await response.json();
      logger.info(`[Workflow ${outlineRequestId}] Triggered lesson workflow ${runId} for "${lesson.title}"`);

      return { runId };
    } catch (error) {
      logger.error(`[Workflow ${outlineRequestId}] Failed to spawn lesson workflow for "${lesson.title}":`, error);
      throw error;
    }
  });

  // Wait for all lesson workflows to be triggered
  await Promise.all(lessonWorkflowPromises);

  logger.info(`[Workflow ${outlineRequestId}] All lesson workflows triggered`);
}
