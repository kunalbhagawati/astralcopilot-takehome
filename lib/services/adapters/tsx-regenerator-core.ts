/**
 * Core TSX regeneration functions
 * Using Vercel AI SDK v5.0+ - https://ai-sdk.dev/
 *
 * Pure functions for regenerating TSX code based on validation errors:
 * - Takes failed TSX + validation errors
 * - Generates fixed TSX that passes validation
 * - Easy to unit test (no side effects)
 * - Follow SRP and SoC principles
 *
 * Used in validation retry loops to fix LLM-generated code.
 */

import { generateObject } from 'ai';
import type { LanguageModel } from 'ai';
import type { z } from 'zod';
import type { TSXRegenerationInput, TSXRegenerationResult } from '../../types/tsx-generation.types';

/**
 * Configuration for TSX regeneration
 */
export interface TSXRegenerationConfig {
  /** Vercel AI SDK model instance */
  model: LanguageModel;
  /** System prompt for TSX regeneration */
  systemPrompt: string;
  /** Function to build user prompt from input */
  buildUserPrompt: (input: TSXRegenerationInput) => string;
  /** Zod schema for validation */
  schema: z.ZodType<TSXRegenerationResult>;
  /** Temperature for generation (0.0-1.0) */
  temperature?: number;
}

/**
 * Regenerate TSX code based on validation errors
 *
 * Pure function that delegates to Vercel AI SDK.
 * No error handling - let errors bubble up for caller to handle.
 * Easy to test and use in REPL.
 *
 * This is called during validation retry loops when TSX fails validation:
 * 1. TSX generation produces code
 * 2. Validation detects errors (TypeScript, ESLint, imports)
 * 3. TSX regeneration (this function) fixes errors
 * 4. Validation re-runs on fixed code
 *
 * @param input - TSX regeneration input (original code + errors)
 * @param config - Regeneration configuration
 * @returns Promise resolving to TSXRegenerationResult
 *
 * @example REPL usage
 * ```typescript
 * import { regenerateTSX } from './tsx-regenerator-core'
 * import { createAIModel } from './llm-config'
 * import { TSXRegenerationResultSchema } from '../../types/tsx-generation.types'
 * import { TSX_REGENERATION_SYSTEM_PROMPT, buildTSXRegenerationUserPrompt } from '../../prompts/tsx-regeneration.prompts'
 *
 * const model = createAIModel('deepseek-coder-v2')
 * const input = {
 *   originalCode: '...buggy TSX code...',
 *   componentName: 'LessonComponent',
 *   validationErrors: [
 *     { type: 'typescript', line: 5, column: 10, message: 'Cannot redeclare...', ... }
 *   ],
 *   lessonTitle: 'Photosynthesis Basics',
 *   blocks: [...],
 *   attemptNumber: 2
 * }
 * const result = await regenerateTSX(input, {
 *   model,
 *   systemPrompt: TSX_REGENERATION_SYSTEM_PROMPT,
 *   buildUserPrompt: buildTSXRegenerationUserPrompt,
 *   schema: TSXRegenerationResultSchema,
 *   temperature: 0.3
 * })
 * ```
 */
export const regenerateTSX = async (
  input: TSXRegenerationInput,
  config: TSXRegenerationConfig,
): Promise<TSXRegenerationResult> => {
  const result = await generateObject({
    model: config.model,
    schema: config.schema,
    system: config.systemPrompt,
    prompt: config.buildUserPrompt(input),
    temperature: config.temperature ?? 0.3, // Lower temp for error fixing (deterministic)
  });

  return result.object;
};
