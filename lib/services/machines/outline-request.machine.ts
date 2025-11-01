// Using XState v5.23.0 - https://statelyai.github.io/xstate/
import { setup, assign } from 'xstate';
import { OutlineRequestStatus } from '@/lib/types/lesson';

/**
 * Context for the outline request state machine
 */
interface OutlineRequestContext {
  outlineRequestId: string;
  outline: string;
  lessonId?: string;
  error?: {
    message: string;
    errors?: string[];
  };
}

/**
 * Events that can be sent to the outline request state machine
 */
type OutlineRequestEvent =
  | { type: 'outline.validation.start' }
  | { type: 'outline.validation.success' }
  | { type: 'outline.validation.failed'; error: { message: string; errors?: string[] } }
  | { type: 'outline.lesson.generation.start' }
  | { type: 'outline.lesson.generation.success'; lessonId: string }
  | { type: 'outline.lesson.generation.failed'; error: { message: string } }
  | { type: 'outline.lesson.validation.success' }
  | { type: 'outline.lesson.validation.failed'; error: { message: string } };

/**
 * State machine for managing the outline request lifecycle
 *
 * Uses nested states for lesson validation within validating_lessons parent state
 *
 * Flow:
 * submitted → validating_outline → generating_lessons → validating_lessons (parent) → completed
 *                ↓                        ↓                     ↓
 *              error                    error                 error
 *
 * validating_lessons contains nested states:
 *   - lesson_validating → lesson_ready
 *         ↓
 *       error
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
        if (
          event.type === 'outline.validation.failed' ||
          event.type === 'outline.lesson.generation.failed' ||
          event.type === 'outline.lesson.validation.failed'
        ) {
          return event.error;
        }
        return undefined;
      },
    }),
    // Store lesson ID in context
    storeLessonId: assign({
      lessonId: ({ event }) => {
        if (event.type === 'outline.lesson.generation.success') {
          return event.lessonId;
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
        'outline.validation.success': 'generating_lessons',
        'outline.validation.failed': {
          target: 'error',
          actions: 'storeError',
        },
      },
    },
    generating_lessons: {
      on: {
        'outline.lesson.generation.success': {
          target: 'validating_lessons',
          actions: 'storeLessonId',
        },
        'outline.lesson.generation.failed': {
          target: 'error',
          actions: 'storeError',
        },
      },
    },
    // Parent state containing nested lesson validation states
    validating_lessons: {
      initial: 'lesson_validating',
      states: {
        lesson_validating: {
          on: {
            'outline.lesson.validation.success': 'lesson_ready',
            'outline.lesson.validation.failed': {
              target: '#outlineRequest.error',
              actions: 'storeError',
            },
          },
        },
        lesson_ready: {
          // Automatically transition to completed when lesson is ready
          always: {
            target: '#outlineRequest.completed',
          },
        },
      },
    },
    completed: {
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
