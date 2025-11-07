/**
 * Lesson Repository
 *
 * Abstraction for lesson table operations with consolidated status tracking.
 * Status is tracked using timestamp and metadata columns directly on the lesson table.
 */

import { logger } from '@/lib/services/logger';
import { createClient } from '@/lib/supabase/server';
import type { Lesson, LessonStatus } from '@/lib/types/lesson';

/**
 * Repository for lesson table operations
 */
export class LessonRepository {
  /**
   * Create a new lesson with generated TSX code
   *
   * Creates lesson with initial generated code linked to an outline request.
   * File paths and compiled code are added after file writing.
   * Status tracking is done via updateStatus() method.
   */
  async create(outlineRequestId: string, title: string, generatedCode: { tsxCode: string }): Promise<Lesson> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('lesson')
      .insert({
        outline_request_id: outlineRequestId,
        title,
        generated_code: generatedCode, // JSONB column with { tsxCode }
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
   * Reads the validation_attempts column to support retry logic
   * that survives process crashes.
   */
  async getValidationAttempts(lessonId: string): Promise<number> {
    const supabase = await createClient();

    const { data, error } = await supabase.from('lesson').select('validation_attempts').eq('id', lessonId).single();

    if (error) {
      logger.error('Failed to get validation attempts:', error);
      throw new Error(`Failed to get validation attempts: ${error.message}`);
    }

    return data?.validation_attempts || 0;
  }

  /**
   * Increment validation attempts counter
   *
   * Called each time a validation attempt is made.
   */
  async incrementValidationAttempts(lessonId: string): Promise<void> {
    const supabase = await createClient();

    // Read current value
    const { data: currentData, error: readError } = await supabase
      .from('lesson')
      .select('validation_attempts')
      .eq('id', lessonId)
      .single();

    if (readError) {
      logger.error('Failed to read validation attempts:', readError);
      throw new Error(`Failed to read validation attempts: ${readError.message}`);
    }

    const currentAttempts = currentData?.validation_attempts || 0;

    // Increment
    const { error: updateError } = await supabase
      .from('lesson')
      .update({ validation_attempts: currentAttempts + 1 })
      .eq('id', lessonId);

    if (updateError) {
      logger.error('Failed to increment validation attempts:', updateError);
      throw new Error(`Failed to increment validation attempts: ${updateError.message}`);
    }
  }

  /**
   * Update lesson with compiled JavaScript code after validation
   *
   * Called after TSX validation and compilation succeed.
   */
  async updateCompiledCode(lessonId: string, compiledCode: { javascript: string }): Promise<void> {
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
   * Update lesson with generated and compiled file paths
   *
   * Called after compileAndWriteTSX() writes files to disk.
   * Stores both TSX source path and compiled JS path for observability.
   */
  async updateFilePaths(
    lessonId: string,
    filePaths: { generatedFilePath: string; compiledFilePath: string },
  ): Promise<void> {
    const supabase = await createClient();

    const { error } = await supabase
      .from('lesson')
      .update({
        generated_file_path: filePaths.generatedFilePath,
        compiled_file_path: filePaths.compiledFilePath,
      })
      .eq('id', lessonId);

    if (error) {
      logger.error('Failed to update file paths:', error);
      throw new Error(`Failed to update file paths: ${error.message}`);
    }
  }

  /**
   * Update lesson with both compiled code and file paths
   *
   * Combined update to reduce database roundtrips.
   * Called after compileAndWriteTSX() when both code and paths are available.
   */
  async updateCompiledCodeAndPaths(
    lessonId: string,
    update: {
      compiledCode: { javascript: string };
      filePaths: { generatedFilePath: string; compiledFilePath: string };
    },
  ): Promise<void> {
    const supabase = await createClient();

    const { error } = await supabase
      .from('lesson')
      .update({
        compiled_code: update.compiledCode,
        generated_file_path: update.filePaths.generatedFilePath,
        compiled_file_path: update.filePaths.compiledFilePath,
      })
      .eq('id', lessonId);

    if (error) {
      logger.error('Failed to update compiled code and paths:', error);
      throw new Error(`Failed to update compiled code and paths: ${error.message}`);
    }
  }

  /**
   * Update lesson with regenerated TSX code during validation retry
   *
   * Called when LLM regenerates TSX code based on validation errors.
   * Updates the generated_code column with new TSX before next validation attempt.
   */
  async updateGeneratedCode(lessonId: string, generatedCode: { tsxCode: string }): Promise<void> {
    const supabase = await createClient();

    const { error } = await supabase
      .from('lesson')
      .update({
        generated_code: generatedCode, // JSONB column with { tsxCode }
      })
      .eq('id', lessonId);

    if (error) {
      logger.error('Failed to update generated code:', error);
      throw new Error(`Failed to update generated code: ${error.message}`);
    }
  }

  /**
   * Update lesson status
   *
   * Updates the timestamp and metadata columns for the given status.
   * Each status has its own timestamp column (e.g., lesson_generated_at, lesson_validating_at)
   * and metadata column (e.g., lesson_generated_metadata, lesson_validating_metadata).
   *
   * @param lessonId - Lesson ID
   * @param status - New status (uses DB enum from database.types.ts)
   * @param metadata - Optional metadata (validation results, error details, etc.)
   */
  async updateStatus(lessonId: string, status: LessonStatus, metadata?: unknown): Promise<void> {
    const supabase = await createClient();

    // Map status enum to column names
    const statusColumnMap: Record<LessonStatus, { timestamp: string; metadata: string }> = {
      'lesson.generated': { timestamp: 'lesson_generated_at', metadata: 'lesson_generated_metadata' },
      'lesson.validating': { timestamp: 'lesson_validating_at', metadata: 'lesson_validating_metadata' },
      'lesson.compiled': { timestamp: 'lesson_compiled_at', metadata: 'lesson_compiled_metadata' },
      'error': { timestamp: 'error_at', metadata: 'error_metadata' },
      'failed': { timestamp: 'failed_at', metadata: 'failed_metadata' },
    };

    const columns = statusColumnMap[status];
    if (!columns) {
      throw new Error(`Unknown status: ${status}`);
    }

    // Build update data with timestamp and optional metadata
    const updateData: Record<string, unknown> = {
      [columns.timestamp]: new Date().toISOString(),
    };

    if (metadata !== undefined) {
      updateData[columns.metadata] = metadata;
    }

    const { error } = await supabase.from('lesson').update(updateData).eq('id', lessonId);

    if (error) {
      logger.error(`Failed to update lesson status to ${status}:`, error);
      throw new Error(`Failed to update lesson status: ${error.message}`);
    }
  }
}
