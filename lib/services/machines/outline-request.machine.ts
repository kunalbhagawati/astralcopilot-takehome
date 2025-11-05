// Using XState v5.23.0 - https://statelyai.github.io/xstate/
import { setup, assign } from 'xstate';
import { OutlineRequestStatus } from '@/lib/types/lesson';

/**
 * Context for the outline request state machine
 */
interface OutlineRequestContext {
  outlineRequestId: string;
  outline: string;
  error?: {
    message: string;
    errors?: string[];
    validationDetails?: unknown;
  };
}

/**
 * Events that can be sent to the outline request state machine
 */
type OutlineRequestEvent =
  | { type: 'outline.validation.start' }
  | { type: 'outline.validation.success' }
  | {
      type: 'outline.validation.failed';
      error: {
        message: string;
        errors?: string[];
        validationDetails?: unknown;
      };
    }
  | { type: 'blocks.generation.start' }
  | { type: 'blocks.generation.success' }
  | { type: 'blocks.generation.failed'; error: { message: string } };

/**
 * State machine for managing the outline request lifecycle
 *
 * Flow:
 * submitted → validating_outline → generating_blocks → blocks_generated
 *                ↓                        ↓
 *              error                    error
 */
export const outlineRequestMachine = setup({
  types: {
    context: {} as OutlineRequestContext,
    events: {} as OutlineRequestEvent,
    input: {} as OutlineRequestContext,
  },
  actions: {
    // Store error in context
    storeError: assign({
      error: ({ event }) => {
        if (event.type === 'outline.validation.failed' || event.type === 'blocks.generation.failed') {
          return event.error;
        }
        return undefined;
      },
    }),
    // Clear error when transitioning out of error state
    clearError: assign({
      error: undefined,
    }),
  },
}).createMachine({
  id: 'outlineRequest',
  initial: 'submitted',
  context: ({ input }) => input,
  states: {
    submitted: {
      on: {
        'outline.validation.start': 'validating_outline',
      },
    },
    validating_outline: {
      on: {
        'outline.validation.success': 'generating_blocks',
        'outline.validation.failed': {
          target: 'error',
          actions: 'storeError',
        },
      },
    },
    generating_blocks: {
      on: {
        'blocks.generation.success': {
          target: 'blocks_generated',
        },
        'blocks.generation.failed': {
          target: 'error',
          actions: 'storeError',
        },
      },
    },
    blocks_generated: {
      type: 'final',
    },
    error: {
      type: 'final',
    },
  },
});

/**
 * Maps XState state values to OutlineRequestStatus enum
 * Handles nested states by mapping them to their parent state
 *
 * XState v5 returns state.value as either:
 * - A string for flat states: 'submitted', 'validating_outline', etc.
 * - An object for nested states: { validating_lessons: 'lesson_validating' }
 */
export const mapStateToStatus = (state: string | object): OutlineRequestStatus => {
  // Handle nested state objects (e.g., { validating_lessons: 'lesson_validating' })
  if (typeof state === 'object' && state !== null) {
    const stateKeys = Object.keys(state);
    if (stateKeys.length > 0) {
      return stateKeys[0] as OutlineRequestStatus;
    }
  }

  // Handle flat state strings
  return state as OutlineRequestStatus;
};
