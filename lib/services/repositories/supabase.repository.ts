/**
 * Supabase Repository Implementations
 *
 * Concrete implementations of repository interfaces using Supabase client.
 * Using Supabase SSR client - https://supabase.com/docs/guides/auth/server-side
 */

import { createClient } from '@/lib/supabase/server';
import type { OutlineRequest, OutlineRequestStatus, Lesson, LessonStatus } from '@/lib/types/lesson';
import type { LessonContent } from '@/lib/types/lesson-structure.types';
import type { ActionableBlocksResult } from '@/lib/types/actionable-blocks.types';
import type { OutlineRequestRepository } from './outline-request.repository';
import type { LessonRepository } from './lesson.repository';

/**
 * Supabase implementation of OutlineRequestRepository
 */
export class SupabaseOutlineRequestRepository implements OutlineRequestRepository {
  /**
   * Find outline request by ID
   */
  async findById(id: string): Promise<OutlineRequest | null> {
    const supabase = await createClient();

    const { data, error } = await supabase.from('outline_request').select('*').eq('id', id).single();

    if (error) {
      console.error('Failed to fetch outline request:', error);
      return null;
    }

    return data;
  }

  /**
   * Update outline request status
   */
  async updateStatus(
    id: string,
    status: OutlineRequestStatus,
    error?: { message: string; errors?: string[]; validationDetails?: unknown },
  ): Promise<void> {
    const supabase = await createClient();

    const updateData: { status: OutlineRequestStatus; error?: typeof error } = { status };
    if (error) {
      updateData.error = error;
    }

    const { error: updateError } = await supabase.from('outline_request').update(updateData).eq('id', id);

    if (updateError) {
      console.error(`Failed to update outline request status to ${status}:`, updateError);
      throw new Error(`Failed to update outline request status: ${updateError.message}`);
    }
  }

  /**
   * Update outline request content blocks
   *
   * Stores the generated actionable blocks (teaching points) in the
   * outline_request.content_blocks JSONB column.
   */
  async updateBlocks(id: string, blocks: ActionableBlocksResult): Promise<void> {
    const supabase = await createClient();

    const { error } = await supabase.from('outline_request').update({ content_blocks: blocks }).eq('id', id);

    if (error) {
      console.error('Failed to update outline request blocks:', error);
      throw new Error(`Failed to update outline request blocks: ${error.message}`);
    }
  }
}

/**
 * Supabase implementation of LessonRepository
 */
export class SupabaseLessonRepository implements LessonRepository {
  /**
   * Create a new lesson with content
   */
  async create(content: LessonContent, status: LessonStatus): Promise<Lesson> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('lesson')
      .insert({
        status,
        content,
      })
      .select()
      .single();

    if (error || !data) {
      console.error('Failed to create lesson:', error);
      throw new Error(`Failed to create lesson: ${error?.message || 'Unknown error'}`);
    }

    return data;
  }

  /**
   * Update lesson status
   */
  async updateStatus(id: string, status: LessonStatus, error?: { message: string }): Promise<void> {
    const supabase = await createClient();

    const updateData: { status: LessonStatus; error?: { message: string } } = { status };
    if (error) {
      updateData.error = error;
    }

    const { error: updateError } = await supabase.from('lesson').update(updateData).eq('id', id);

    if (updateError) {
      console.error(`Failed to update lesson status to ${status}:`, updateError);
      throw new Error(`Failed to update lesson status: ${updateError.message}`);
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
      console.error('Failed to create mapping:', error);
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
    outlineRequestRepository: new SupabaseOutlineRequestRepository(),
    lessonRepository: new SupabaseLessonRepository(),
  };
};
