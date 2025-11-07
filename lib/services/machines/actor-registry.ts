/**
 * Actor Registry
 *
 * Maintains persistent references to running XState actors to prevent garbage collection.
 *
 * Problem:
 * - XState actors created as local variables can be GC'd when they go out of scope
 * - Fire-and-forget async patterns leave no persistent references
 * - Node.js GC can collect actors mid-execution, killing state machines
 *
 * Solution:
 * - Store actor references in a Map keyed by unique ID
 * - Automatically remove actors on completion/error
 * - Prevents GC while actors are running
 *
 * Usage:
 * ```typescript
 * const actor = createActor(machine, { input: ... });
 * registerActor('unique-id', actor); // Keep reference alive
 * actor.start();
 * ```
 */

import type { Actor, AnyActorLogic } from 'xstate';
import { logger } from '../logger';

/**
 * Global registry of active actors
 * Key: Unique actor ID (e.g., outline request ID, lesson ID)
 * Value: Actor instance (keeps reference alive, prevents GC)
 */
const activeActors = new Map<string, Actor<AnyActorLogic>>();

/**
 * Register an actor to prevent garbage collection
 *
 * Stores a persistent reference to the actor and automatically removes it
 * when the actor completes or errors.
 *
 * @param id - Unique identifier for the actor (e.g., outline request ID, lesson ID)
 * @param actor - XState actor instance to register
 * @param type - Actor type for logging (e.g., 'outline', 'lesson')
 *
 * @example
 * ```typescript
 * const actor = createActor(outlineRequestActorMachine, { input: ... });
 * registerActor(outlineRequestId, actor, 'outline');
 * actor.start();
 * ```
 */
export const registerActor = (id: string, actor: Actor<AnyActorLogic>, type: string = 'actor'): void => {
  // Store reference to prevent GC
  activeActors.set(id, actor);
  logger.info(`[ActorRegistry] Registered ${type} actor: ${id} (total active: ${activeActors.size})`);

  // Auto-cleanup on completion or error
  actor.subscribe({
    complete: () => {
      activeActors.delete(id);
      logger.info(`[ActorRegistry] Unregistered ${type} actor (completed): ${id} (total active: ${activeActors.size})`);
    },
    error: (error: unknown) => {
      activeActors.delete(id);
      logger.error(
        `[ActorRegistry] Unregistered ${type} actor (error): ${id} (total active: ${activeActors.size})`,
        error,
      );
    },
  });
};

/**
 * Get a registered actor by ID
 *
 * Useful for debugging or manual actor management.
 *
 * @param id - Unique identifier for the actor
 * @returns Actor instance if registered, undefined otherwise
 */
export const getActor = (id: string): Actor<AnyActorLogic> | undefined => {
  return activeActors.get(id);
};

/**
 * Get count of active actors
 *
 * Useful for monitoring and debugging.
 *
 * @returns Number of currently active actors
 */
export const getActiveActorCount = (): number => {
  return activeActors.size;
};

/**
 * Manually unregister an actor
 *
 * Generally not needed as actors auto-unregister on completion/error.
 * Use only for manual cleanup scenarios.
 *
 * @param id - Unique identifier for the actor
 * @returns True if actor was found and removed, false otherwise
 */
export const unregisterActor = (id: string): boolean => {
  const removed = activeActors.delete(id);
  if (removed) {
    logger.info(`[ActorRegistry] Manually unregistered actor: ${id} (total active: ${activeActors.size})`);
  }
  return removed;
};

/**
 * Get all active actor IDs
 *
 * Useful for debugging and monitoring.
 *
 * @returns Array of active actor IDs
 */
export const getActiveActorIds = (): string[] => {
  return Array.from(activeActors.keys());
};
