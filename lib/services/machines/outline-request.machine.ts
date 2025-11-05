// Using XState v5.23.0 - https://statelyai.github.io/xstate/
import { OutlineRequestStatus } from '@/lib/types/lesson';
import { assign, setup } from 'xstate';

/**
 * Context for the outline request state machine
 */
interface OutlineRequestContext {
  outlineRequestId: string;
  outline: string;
  metadata?: unknown;
}

/**
 * Events that can be sent to the outline request state machine
 */
type OutlineRequestEvent =
  | { type: 'outline.validation.start' }
  | { type: 'outline.validation.success' }
  | {
      type: 'outline.validation.failed';
      metadata: {
        llmOutput?: unknown;
        failureReason: string;
        details?: string[];
      };
    }
  | {
      type: 'outline.validation.error';
      metadata: {
        message: string;
        error: string;
        context?: unknown;
      };
    }
  | { type: 'blocks.generation.start' }
  | { type: 'blocks.generation.success' }
  | {
      type: 'blocks.generation.failed';
      metadata: {
        llmOutput?: unknown;
        failureReason: string;
        details?: string[];
      };
    }
  | {
      type: 'blocks.generation.error';
      metadata: {
        message: string;
        error: string;
        context?: unknown;
      };
    };

/**
 * State machine for managing the outline request lifecycle
 *
 * Internal flow (with underscores):
 * submitted → outline_validating → outline_validated → outline_blocks_generating → outline_blocks_generated
 *                ↓                        ↓                        ↓
 *              failed/error            failed/error            failed/error
 *
 * These map to database statuses (with dots):
 * submitted → outline.validating → outline.validated → outline.blocks.generating → outline.blocks.generated
 *
 * Final states: failed, error
 * - failed: Flow can't proceed based on LLM output (outline validation fails, etc.)
 * - error: System/technical error (network error, LLM API down, etc.)
 */
export const outlineRequestMachine = setup({
  types: {
    context: {} as OutlineRequestContext,
    events: {} as OutlineRequestEvent,
    input: {} as OutlineRequestContext,
  },
  actions: {
    // Store metadata in context
    storeMetadata: assign({
      metadata: ({ event }) => {
        if (
          event.type === 'outline.validation.failed' ||
          event.type === 'outline.validation.error' ||
          event.type === 'blocks.generation.failed' ||
          event.type === 'blocks.generation.error'
        ) {
          return event.metadata;
        }
        return undefined;
      },
    }),
    // Clear metadata when transitioning
    clearMetadata: assign({
      metadata: undefined,
    }),
  },
}).createMachine({
  id: 'outlineRequest',
  initial: 'submitted',
  context: ({ input }) => input,
  states: {
    submitted: {
      on: {
        'outline.validation.start': 'outline_validating',
      },
    },
    outline_validating: {
      on: {
        'outline.validation.success': 'outline_validated',
        'outline.validation.failed': {
          target: 'failed',
          actions: 'storeMetadata',
        },
        'outline.validation.error': {
          target: 'error',
          actions: 'storeMetadata',
        },
      },
    },
    outline_validated: {
      on: {
        'blocks.generation.start': 'outline_blocks_generating',
      },
    },
    outline_blocks_generating: {
      on: {
        'blocks.generation.success': {
          target: 'outline_blocks_generated',
        },
        'blocks.generation.failed': {
          target: 'failed',
          actions: 'storeMetadata',
        },
        'blocks.generation.error': {
          target: 'error',
          actions: 'storeMetadata',
        },
      },
    },
    outline_blocks_generated: {
      type: 'final',
    },
    failed: {
      type: 'final',
    },
    error: {
      type: 'final',
    },
  },
});

/**
 * Maps XState state values to OutlineRequestStatus enum
 *
 * State machine uses underscores internally (e.g., 'outline_validating')
 * Database uses dots (e.g., 'outline.validating')
 *
 * This function converts from state machine format to database format
 */
export const mapStateToStatus = (state: string | object): OutlineRequestStatus => {
  // Handle nested state objects
  if (typeof state === 'object' && state !== null) {
    const stateKeys = Object.keys(state);
    if (stateKeys.length > 0) {
      return stateKeys[0] as OutlineRequestStatus;
    }
  }

  // Convert underscore format to dot format
  const stateMap: Record<string, OutlineRequestStatus> = {
    submitted: 'submitted',
    outline_validating: 'outline.validating',
    outline_validated: 'outline.validated',
    outline_blocks_generating: 'outline.blocks.generating',
    outline_blocks_generated: 'outline.blocks.generated',
    failed: 'failed',
    error: 'error',
  };

  return stateMap[state as string] || (state as OutlineRequestStatus);
};
