import { logger } from '@/lib/services/logger';
import { processLessonWorkflow } from '@/lib/workflows/lesson-workflow';
import { NextRequest, NextResponse } from 'next/server';
import { start } from 'workflow/api';

/**
 * API endpoint to trigger individual lesson workflow
 *
 * Triggered by the outline workflow after creating lesson records.
 * Each lesson runs as an independent workflow with full durability.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { lessonId, outlineRequestId, lesson, context, maxValidationAttempts } = body;

    logger.info(`[API] Triggering lesson workflow for lessonId: ${lessonId}`);

    // Trigger lesson workflow using Workflow DevKit's start() function
    const run = await start(processLessonWorkflow, [
      {
        lessonId,
        outlineRequestId,
        lesson,
        context,
        maxValidationAttempts,
      },
    ]);

    logger.info(`[API] Lesson workflow started with runId: ${run.runId}`);

    return NextResponse.json({
      success: true,
      runId: run.runId,
    });
  } catch (error) {
    logger.error('[API] Error triggering lesson workflow:', error);
    return NextResponse.json({ error: 'Failed to trigger lesson workflow' }, { status: 500 });
  }
}
