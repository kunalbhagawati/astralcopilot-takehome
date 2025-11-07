/**
 * Lesson Repository Interface
 *
 * Abstraction for lesson table operations.
 * Enables dependency injection and testability by decoupling from Supabase.
 */

import type { Lesson, LessonStatus } from '@/lib/types/lesson';

/**
 * Repository interface for lesson operations
 *
 * Uses lesson_status_record table for status tracking (separate from lesson table).
 */
export interface LessonRepository {
  /**
   * Create a new lesson with generated TSX code
   *
   * Note: Status is NOT stored on lesson table. Use createStatusRecord() separately.
   * Compiled code is added later after validation using updateCompiledCode().
   *
   * @param title - Lesson title (stored in lesson.title column)
   * @param generatedCode - Generated TSX code and component name
   * @returns Created lesson record
   */
  create(title: string, generatedCode: { tsxCode: string; componentName: string }): Promise<Lesson>;

  /**
   * Get number of validation attempts for a lesson
   *
   * Counts existing 'lesson.validating' status records to support retry logic
   * that survives process crashes.
   *
   * @param lessonId - Lesson ID
   * @returns Number of validation attempts already made
   */
  getValidationAttempts(lessonId: string): Promise<number>;

  /**
   * Update lesson with compiled JavaScript code after validation
   *
   * Called after TSX validation and compilation succeed.
   *
   * @param lessonId - Lesson ID
   * @param compiledCode - Compiled JavaScript code and component name
   */
  updateCompiledCode(lessonId: string, compiledCode: { javascript: string; componentName: string }): Promise<void>;

  /**
   * Create status record in lesson_status_record
   *
   * Records each status transition with optional metadata.
   * Status changes are append-only for audit trail.
   *
   * Metadata structure:
   * - For success states with LLM output: store LLM output directly
   * - For 'failed' state: { llmOutput?, failureReason, details? }
   * - For 'error' state: { message, error, context? } (no stack trace)
   *
   * @param lessonId - Lesson ID
   * @param status - New status (uses DB enum from database.types.ts)
   * @param metadata - Optional metadata (LLM output, error details, or failure reasons)
   */
  createStatusRecord(lessonId: string, status: LessonStatus, metadata?: unknown): Promise<void>;

  /**
   * Create mapping between outline request and lesson
   *
   * @param outlineRequestId - Outline request ID
   * @param lessonId - Lesson ID
   */
  createMapping(outlineRequestId: string, lessonId: string): Promise<void>;
}
