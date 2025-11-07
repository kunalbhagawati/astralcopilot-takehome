/**
 * Lesson Repository Interface
 *
 * Abstraction for lesson table operations.
 * Enables dependency injection and testability by decoupling from Supabase.
 */

import type { Lesson, LessonStatus } from '@/lib/types/lesson';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/services/logger';

/**
 * Repository for lesson_status_record table for status tracking (separate from lesson table).
 */
export class LessonRepository {
  /**
   * Create a new lesson with generated TSX code
   *
   * Note: Status is NOT stored on lesson table. Use createStatusRecord() separately.
   * Compiled code is added later after validation using updateCompiledCode().
   */
  async create(title: string, generatedCode: { tsxCode: string; componentName: string }): Promise<Lesson> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('lesson')
      .insert({
        title,
        generated_code: generatedCode, // JSONB column with { tsxCode, componentName }
        // compiled_code is null initially, added after validation
      })
      .select()
      .single();

    if (error || !data) {
      logger.error('Failed to create lesson:', error);
      throw new Error(`Failed to create lesson: ${error?.message || 'Unknown error'}`);
    }

    return data;
  }

  /**
   * Get number of validation attempts for a lesson
   *
   * Counts existing 'lesson.validating' status records to support retry logic
   * that survives process crashes.
   */
  async getValidationAttempts(lessonId: string): Promise<number> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('lesson_status_record')
      .select('id')
      .eq('lesson_id', lessonId)
      .eq('status', 'lesson.validating');

    if (error) {
      logger.error('Failed to get validation attempts:', error);
      throw new Error(`Failed to get validation attempts: ${error.message}`);
    }

    return data?.length || 0;
  }

  /**
   * Update lesson with compiled JavaScript code after validation
   *
   * Called after TSX validation and compilation succeed.
   */
  async updateCompiledCode(
    lessonId: string,
    compiledCode: { javascript: string; componentName: string },
  ): Promise<void> {
    const supabase = await createClient();

    const { error } = await supabase
      .from('lesson')
      .update({
        compiled_code: compiledCode, // JSONB column
      })
      .eq('id', lessonId);

    if (error) {
      logger.error('Failed to update compiled code:', error);
      throw new Error(`Failed to update compiled code: ${error.message}`);
    }
  }

  /**
   * Update lesson with regenerated TSX code during validation retry
   *
   * Called when LLM regenerates TSX code based on validation errors.
   * Updates the generated_code column with new TSX before next validation attempt.
   */
  async updateGeneratedCode(
    lessonId: string,
    generatedCode: { tsxCode: string; componentName: string },
  ): Promise<void> {
    const supabase = await createClient();

    const { error } = await supabase
      .from('lesson')
      .update({
        generated_code: generatedCode, // JSONB column with { tsxCode, componentName }
      })
      .eq('id', lessonId);

    if (error) {
      logger.error('Failed to update generated code:', error);
      throw new Error(`Failed to update generated code: ${error.message}`);
    }
  }

  /**
   * Create status record in lesson_status_record
   *
   * Records each status transition with optional metadata.
   * Status changes are append-only for audit trail.
   */
  async createStatusRecord(lessonId: string, status: LessonStatus, metadata?: unknown): Promise<void> {
    const supabase = await createClient();

    const statusData: {
      lesson_id: string;
      status: LessonStatus;
      metadata?: unknown;
    } = {
      lesson_id: lessonId,
      status,
    };

    if (metadata !== undefined) {
      statusData.metadata = metadata;
    }

    const { error: insertError } = await supabase.from('lesson_status_record').insert(statusData);

    if (insertError) {
      logger.error(`Failed to create lesson status record for ${status}:`, insertError);
      throw new Error(`Failed to create lesson status record: ${insertError.message}`);
    }
  }

  /**
   * Create mapping between outline request and lesson
   */
  async createMapping(outlineRequestId: string, lessonId: string): Promise<void> {
    const supabase = await createClient();

    const { error } = await supabase.from('mapping_outline_request_lesson').insert({
      outline_request_id: outlineRequestId,
      lesson_id: lessonId,
    });

    if (error) {
      logger.error('Failed to create mapping:', error);
      throw new Error(`Failed to create mapping: ${error.message}`);
    }
  }
}
