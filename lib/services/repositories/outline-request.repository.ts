/**
 * Outline Request Repository
 *
 * Using Supabase SSR client - https://supabase.com/docs/guides/auth/server-side
 *
 * Handles outline_request table operations and status tracking in outline_request_status_record.
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
   * Create status record in outline_request_status_record
   *
   * Records each status transition with optional metadata.
   * Status changes are append-only for audit trail.
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
  async createStatusRecord(id: string, status: OutlineRequestStatus, metadata?: unknown): Promise<void> {
    const supabase = await createClient();

    const statusData: {
      outline_request_id: string;
      status: OutlineRequestStatus;
      metadata?: unknown;
    } = {
      outline_request_id: id,
      status,
    };

    if (metadata !== undefined) {
      statusData.metadata = metadata;
    }

    const { error: insertError } = await supabase.from('outline_request_status_record').insert(statusData);

    if (insertError) {
      logger.error(`Failed to create outline request status record for ${status}:`, insertError);
      throw new Error(`Failed to create outline request status record: ${insertError.message}`);
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
}
