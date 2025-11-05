/**
 * Lesson Repository Interface
 *
 * Abstraction for lesson table operations.
 * Enables dependency injection and testability by decoupling from Supabase.
 */

import type { Lesson, LessonStatus } from '@/lib/types/lesson';
import type { LessonContent } from '@/lib/types/lesson-structure.types';

/**
 * Repository interface for lesson operations
 *
 * Uses lesson_status_record table for status tracking (separate from lesson table).
 */
export interface LessonRepository {
  /**
   * Create a new lesson with content
   *
   * Note: Status is NOT stored on lesson table. Use createStatusRecord() separately.
   *
   * @param content - Lesson content (actionables/teaching blocks)
   * @returns Created lesson record
   */
  create(content: LessonContent): Promise<Lesson>;

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
