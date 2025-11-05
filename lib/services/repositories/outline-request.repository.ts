/**
 * Outline Request Repository Interface
 *
 * Abstraction for outline_request table operations.
 * Enables dependency injection and testability by decoupling from Supabase.
 */

import type { OutlineRequest, OutlineRequestStatus } from '@/lib/types/lesson';
import type { ActionableBlocksResult } from '@/lib/types/actionable-blocks.types';

/**
 * Repository interface for outline_request operations
 */
export interface OutlineRequestRepository {
  /**
   * Find outline request by ID
   *
   * @param id - Outline request ID
   * @returns Outline request or null if not found
   */
  findById(id: string): Promise<OutlineRequest | null>;

  /**
   * Update outline request status
   *
   * @param id - Outline request ID
   * @param status - New status
   * @param error - Optional error data
   */
  updateStatus(
    id: string,
    status: OutlineRequestStatus,
    error?: { message: string; errors?: string[]; validationDetails?: unknown },
  ): Promise<void>;

  /**
   * Update outline request content blocks
   *
   * Stores the generated actionable blocks (teaching points) in the
   * outline_request.content_blocks JSONB column.
   *
   * @param id - Outline request ID
   * @param blocks - Actionable blocks result from LLM generation
   */
  updateBlocks(id: string, blocks: ActionableBlocksResult): Promise<void>;
}
