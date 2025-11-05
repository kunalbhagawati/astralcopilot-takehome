/**
 * Outline Request Repository
 *
 * Using Supabase SSR client - https://supabase.com/docs/guides/auth/server-side
 *
 * Handles outline_request table operations and status tracking in outline_request_statuses.
 */

import { createClient } from '@/lib/supabase/server';
import type { OutlineRequest, OutlineRequestStatus } from '@/lib/types/lesson';
import type { ActionableBlocksResult } from '@/lib/types/actionable-blocks.types';
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
   * Create status record in outline_request_statuses
   *
   * Records each status transition with optional response and error data.
   * Status changes are append-only for audit trail.
   *
   * @param id - Outline request ID
   * @param status - New status
   * @param response - Optional response data from service (e.g., validation results, generated blocks)
   * @param error - Optional error data
   */
  async createStatusRecord(
    id: string,
    status: OutlineRequestStatus,
    response?: unknown,
    error?: { message: string; errors?: string[]; validationDetails?: unknown },
  ): Promise<void> {
    const supabase = await createClient();

    const statusData: {
      outline_request_id: string;
      status: OutlineRequestStatus;
      response?: unknown;
      error?: typeof error;
    } = {
      outline_request_id: id,
      status,
    };

    if (response) {
      statusData.response = response;
    }

    if (error) {
      statusData.error = error;
    }

    const { error: insertError } = await supabase.from('outline_request_statuses').insert(statusData);

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
