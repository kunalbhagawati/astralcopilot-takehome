import { createClient } from '@/lib/supabase/server';
import { LessonStatus, OutlineRequestStatus } from '@/lib/types/lesson';
import { createActor } from 'xstate';
import { getAILLMClient } from './adapters/ai-llm-client';
import { getLessonContentValidator } from './adapters/lesson-content-validator';
import { getOutlineValidator, type EnhancedOutlineValidationResult } from './adapters/outline-validator';
import { mapStateToStatus as mapOutlineStateToStatus, outlineRequestMachine } from './machines/outline-request.machine';

/**
 * State machine for lesson generation
 * Manages the async background process of generating a lesson from an outline request
 * Uses XState v5.23.0 for state management - https://statelyai.github.io/xstate/
 */
export class OutlineRequestPipeline {
  private validator = getOutlineValidator();
  private aiClient = getAILLMClient();
  private lessonValidator = getLessonContentValidator();

  /**
   * Processes an outline request through the state machine
   * This runs asynchronously in the background
   */
  async processOutlineRequest(outlineRequestId: string): Promise<void> {
    try {
      const supabase = await createClient();

      // Fetch the outline request
      const { data: outlineRequest, error: fetchError } = await supabase
        .from('outline_request')
        .select('*')
        .eq('id', outlineRequestId)
        .single();

      if (fetchError || !outlineRequest) {
        console.error('Failed to fetch outline request:', fetchError);
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
        this.updateOutlineRequestStatus(outlineRequestId, status, error).catch((err) => {
          console.error('Failed to update outline request status:', err);
        });
      });

      // Transition: submitted -> validating_outline
      outlineActor.send({ type: 'outline.validation.start' });

      // State: VALIDATING_OUTLINE
      const validationResult = await this.validator.validate(outlineRequest.outline);

      if (!validationResult.valid) {
        // Store detailed validation errors if using LLM validator
        const errorData: { message: string; errors?: string[]; validationDetails?: unknown } = {
          message: 'Validation failed',
          errors: validationResult.errors,
        };

        // Add enhanced validation details if available (from LLMOutlineValidator)
        const enhancedResult = validationResult as EnhancedOutlineValidationResult;
        if (enhancedResult.enhancedResult) {
          errorData.validationDetails = {
            intent: enhancedResult.enhancedResult.intent,
            specificity: enhancedResult.enhancedResult.specificity,
            actionability: enhancedResult.enhancedResult.actionability,
          };
        }

        outlineActor.send({
          type: 'outline.validation.failed',
          error: errorData,
        });
        return;
      }

      // Transition: validating_outline -> generating_lessons
      outlineActor.send({ type: 'outline.validation.success' });

      // State: GENERATING_LESSON - Use AI LLM client to generate lesson
      const lessonContent = await this.aiClient.generateLesson(outlineRequest.outline);

      // Create lesson record with content
      const { data: lesson, error: lessonError } = await supabase
        .from('lesson')
        .insert({
          status: 'generated' as LessonStatus,
          content: lessonContent,
        })
        .select()
        .single();

      if (lessonError || !lesson) {
        console.error('Failed to create lesson:', lessonError);
        outlineActor.send({
          type: 'outline.lesson.generation.failed',
          error: { message: 'Failed to create lesson record' },
        });
        return;
      }

      // Create mapping between outline request and lesson
      const { error: mappingError } = await supabase.from('mapping_outline_request_lesson').insert({
        outline_request_id: outlineRequestId,
        lesson_id: lesson.id,
      });

      if (mappingError) {
        console.error('Failed to create mapping:', mappingError);
        outlineActor.send({
          type: 'outline.lesson.generation.failed',
          error: { message: 'Failed to create mapping' },
        });
        return;
      }

      // Transition: generating_lessons -> validating_lessons (nested state: lesson_validating)
      outlineActor.send({ type: 'outline.lesson.generation.success', lessonId: lesson.id });

      // State: VALIDATING_LESSONS.LESSON_VALIDATING
      // Update lesson status to validating
      await this.updateLessonStatus(lesson.id, 'validating');

      // Validate lesson content structure
      const structureValidation = await this.lessonValidator.validate(lessonContent);

      if (!structureValidation.valid) {
        await this.updateLessonStatus(lesson.id, 'error', {
          message: 'Lesson content validation failed: ' + (structureValidation.errors?.join(', ') || 'Unknown error'),
        });
        outlineActor.send({
          type: 'outline.lesson.validation.failed',
          error: {
            message: 'Lesson content validation failed: ' + (structureValidation.errors?.join(', ') || 'Unknown error'),
          },
        });
        return;
      }

      // Validate lesson quality using AI
      const qualityValidation = await this.aiClient.validateLesson(lessonContent);

      if (!qualityValidation.valid) {
        await this.updateLessonStatus(lesson.id, 'error', {
          message: 'Lesson quality validation failed: ' + (qualityValidation.errors?.join(', ') || 'Unknown error'),
        });
        outlineActor.send({
          type: 'outline.lesson.validation.failed',
          error: {
            message: 'Lesson quality validation failed: ' + (qualityValidation.errors?.join(', ') || 'Unknown error'),
          },
        });
        return;
      }

      // Update lesson status to ready_to_use
      await this.updateLessonStatus(lesson.id, 'ready_to_use');

      // Transition: validating_lessons.lesson_validating -> validating_lessons.lesson_ready
      // Then automatically transitions to completed
      outlineActor.send({ type: 'outline.lesson.validation.success' });

      // Stop the actor after completion
      outlineActor.stop();
    } catch (error) {
      console.error('Error processing outline request:', error);
      await this.updateOutlineRequestStatus(outlineRequestId, 'error', {
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    }
  }

  /**
   * Updates the outline request status in the database
   */
  private async updateOutlineRequestStatus(
    outlineRequestId: string,
    status: OutlineRequestStatus,
    error?: { message: string; errors?: string[] },
  ): Promise<void> {
    const supabase = await createClient();

    const updateData: { status: OutlineRequestStatus; error?: { message: string; errors?: string[] } } = { status };
    if (error) {
      updateData.error = error;
    }

    const { error: updateError } = await supabase.from('outline_request').update(updateData).eq('id', outlineRequestId);

    if (updateError) {
      console.error(`Failed to update outline request status to ${status}:`, updateError);
    }
  }

  /**
   * Updates the lesson status in the database
   */
  private async updateLessonStatus(lessonId: string, status: LessonStatus, error?: { message: string }): Promise<void> {
    const supabase = await createClient();

    const updateData: { status: LessonStatus; error?: { message: string } } = { status };
    if (error) {
      updateData.error = error;
    }

    const { error: updateError } = await supabase.from('lesson').update(updateData).eq('id', lessonId);

    if (updateError) {
      console.error(`Failed to update lesson status to ${status}:`, updateError);
    }
  }
}

/**
 * Triggers the lesson generation process in the background
 * This function returns immediately while processing continues
 */
export async function processOutline(outlineRequestId: string): Promise<void> {
  const pipeline = new OutlineRequestPipeline();

  // Run the process in the background (don't await)
  pipeline.processOutlineRequest(outlineRequestId).catch((error) => {
    console.error('Background lesson generation failed:', error);
  });
}
