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
 */
export interface LessonRepository {
  /**
   * Create a new lesson with content
   *
   * @param content - Lesson content (actionables/teaching blocks)
   * @param status - Initial lesson status
   * @returns Created lesson record
   */
  create(content: LessonContent, status: LessonStatus): Promise<Lesson>;

  /**
   * Update lesson status
   *
   * @param id - Lesson ID
   * @param status - New status
   * @param error - Optional error data
   */
  updateStatus(id: string, status: LessonStatus, error?: { message: string }): Promise<void>;

  /**
   * Create mapping between outline request and lesson
   *
   * @param outlineRequestId - Outline request ID
   * @param lessonId - Lesson ID
   */
  createMapping(outlineRequestId: string, lessonId: string): Promise<void>;
}
