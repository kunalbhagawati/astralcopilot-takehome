/**
 * Outline Request Repository
 *
 * Using Supabase SSR client - https://supabase.com/docs/guides/auth/server-side
 *
 * Handles outline_request table operations with consolidated status tracking
 * using timestamp and metadata columns directly on the outline_request table.
 */

import { createClient } from '@/lib/supabase/server';
import type { ActionableBlocksResult } from '@/lib/types/actionable-blocks.types';
import type { OutlineRequest, OutlineRequestStatus } from '@/lib/types/lesson';
import { logger } from '../logger';

/**
 * Repository for outline_request operations
 */
export class OutlineRequestRepository {
  /**
   * Find outline request by ID
   *
   * @param id - Outline request ID
   * @returns Outline request or null if not found
   */
  async findById(id: string): Promise<OutlineRequest | null> {
    const supabase = await createClient();

    const { data, error } = await supabase.from('outline_request').select('*').eq('id', id).single();

    if (error) {
      logger.error('Failed to fetch outline request:', error);
      return null;
    }

    return data;
  }

  /**
   * Update outline request status
   *
   * Updates the timestamp and metadata columns for the given status.
   * Each status has its own timestamp column (e.g., submitted_at, outline_validating_at)
   * and metadata column (e.g., outline_validating_metadata).
   *
   * Metadata structure:
   * - For success states with LLM output: store LLM output directly
   * - For 'failed' state: { llmOutput?, failureReason, details? }
   * - For 'error' state: { message, error, context? } (no stack trace)
   *
   * @param id - Outline request ID
   * @param status - New status (uses DB enum from database.types.ts)
   * @param metadata - Optional metadata (LLM output, error details, or failure reasons)
   */
  async updateStatus(id: string, status: OutlineRequestStatus, metadata?: unknown): Promise<void> {
    const supabase = await createClient();

    // Map status enum to column names
    const statusColumnMap: Record<OutlineRequestStatus, { timestamp: string; metadata: string }> = {
      'submitted': { timestamp: 'submitted_at', metadata: 'submitted_metadata' },
      'outline.validating': { timestamp: 'outline_validating_at', metadata: 'outline_validating_metadata' },
      'outline.validated': { timestamp: 'outline_validated_at', metadata: 'outline_validated_metadata' },
      'outline.blocks.generating': {
        timestamp: 'outline_blocks_generating_at',
        metadata: 'outline_blocks_generating_metadata',
      },
      'outline.blocks.generated': {
        timestamp: 'outline_blocks_generated_at',
        metadata: 'outline_blocks_generated_metadata',
      },
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

    const { error } = await supabase.from('outline_request').update(updateData).eq('id', id);

    if (error) {
      logger.error(`Failed to update outline request status to ${status}:`, error);
      throw new Error(`Failed to update outline request status: ${error.message}`);
    }
  }

  /**
   * Update outline request content blocks
   *
   * Stores the generated actionable blocks (teaching points) in the
   * outline_request.content_blocks JSONB column.
   *
   * @param id - Outline request ID
   * @param blocks - Actionable blocks result from LLM generation
   */
  async updateBlocks(id: string, blocks: ActionableBlocksResult): Promise<void> {
    const supabase = await createClient();

    const { error } = await supabase.from('outline_request').update({ content_blocks: blocks }).eq('id', id);

    if (error) {
      logger.error('Failed to update outline request blocks:', error);
      throw new Error(`Failed to update outline request blocks: ${error.message}`);
    }
  }

  /**
   * Update number of lessons for outline request
   *
   * Sets the num_lessons column when blocks are generated.
   * This indicates how many lessons will be created from the outline.
   *
   * @param id - Outline request ID
   * @param numLessons - Number of lessons to be generated
   */
  async updateNumLessons(id: string, numLessons: number): Promise<void> {
    const supabase = await createClient();

    const { error } = await supabase.from('outline_request').update({ num_lessons: numLessons }).eq('id', id);

    if (error) {
      logger.error('Failed to update outline request num_lessons:', error);
      throw new Error(`Failed to update outline request num_lessons: ${error.message}`);
    }
  }
}
