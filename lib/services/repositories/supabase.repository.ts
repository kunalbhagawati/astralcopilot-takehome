/**
 * Supabase Repository Implementations
 *
 * Concrete implementations of repository interfaces using Supabase client.
 * Using Supabase SSR client - https://supabase.com/docs/guides/auth/server-side
 */

import { createClient } from '@/lib/supabase/server';
import type { Lesson, LessonStatus } from '@/lib/types/lesson';
import type { LessonContent } from '@/lib/types/lesson-structure.types';
import { logger } from '../logger';
import type { LessonRepository } from './lesson.repository';

/**
 * Supabase implementation of LessonRepository
 *
 * Uses lesson_status_record table for status tracking (separate from lesson table).
 */
export class SupabaseLessonRepository implements LessonRepository {
  /**
   * Create a new lesson with content
   *
   * Note: Status is NOT stored on lesson table. Use createStatusRecord() separately.
   */
  async create(content: LessonContent): Promise<Lesson> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('lesson')
      .insert({
        content,
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

/**
 * Factory function to create Supabase repository instances
 * Makes it easy to inject repositories into services
 */
export const createSupabaseRepositories = () => {
  return {
    lessonRepository: new SupabaseLessonRepository(),
  };
};
