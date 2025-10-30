import { createClient } from '@/lib/supabase/server';
import { OutlineRequestStatus, LessonStatus } from '@/lib/types/lesson';
import { getOutlineValidator } from './adapters/outline-validator';
import { getLessonStructurer } from './adapters/lesson-structurer';

/**
 * State machine for lesson generation
 * Manages the async background process of generating a lesson from an outline request
 */
export class LessonGenerator {
  private validator = getOutlineValidator();
  private structurer = getLessonStructurer();

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

      // State: VALIDATING_OUTLINE
      await this.updateOutlineRequestStatus(outlineRequestId, 'validating_outline');

      const validationResult = await this.validator.validate(outlineRequest.outline);

      if (!validationResult.valid) {
        await this.updateOutlineRequestStatus(outlineRequestId, 'error', {
          message: 'Validation failed',
          errors: validationResult.errors,
        });
        return;
      }

      // State: GENERATING_LESSON
      await this.updateOutlineRequestStatus(outlineRequestId, 'generating_lesson');

      await this.structurer.structure(outlineRequest.outline);

      // Create lesson record
      const { data: lesson, error: lessonError } = await supabase
        .from('lesson')
        .insert({
          status: 'generated' as LessonStatus,
        })
        .select()
        .single();

      if (lessonError || !lesson) {
        console.error('Failed to create lesson:', lessonError);
        await this.updateOutlineRequestStatus(outlineRequestId, 'error', { message: 'Failed to create lesson record' });
        return;
      }

      // Create mapping between outline request and lesson
      const { error: mappingError } = await supabase.from('mapping_outline_request_lesson').insert({
        outline_request_id: outlineRequestId,
        lesson_id: lesson.id,
      });

      if (mappingError) {
        console.error('Failed to create mapping:', mappingError);
        await this.updateOutlineRequestStatus(outlineRequestId, 'error', { message: 'Failed to create mapping' });
        return;
      }

      // State: VALIDATING_LESSONS
      await this.updateOutlineRequestStatus(outlineRequestId, 'validating_lessons');
      await this.updateLessonStatus(lesson.id, 'validating');

      // TODO: Add lesson validation logic here
      // For now, we'll just mark it as ready_to_use
      await this.updateLessonStatus(lesson.id, 'ready_to_use');

      // State: COMPLETED
      await this.updateOutlineRequestStatus(outlineRequestId, 'completed');
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
  private async updateLessonStatus(lessonId: string, status: LessonStatus): Promise<void> {
    const supabase = await createClient();

    const { error } = await supabase.from('lesson').update({ status }).eq('id', lessonId);

    if (error) {
      console.error(`Failed to update lesson status to ${status}:`, error);
    }
  }
}

/**
 * Triggers the lesson generation process in the background
 * This function returns immediately while processing continues
 */
export async function processOutline(outlineRequestId: string): Promise<void> {
  const generator = new LessonGenerator();

  // Run the process in the background (don't await)
  generator.processOutlineRequest(outlineRequestId).catch((error) => {
    console.error('Background lesson generation failed:', error);
  });
}
