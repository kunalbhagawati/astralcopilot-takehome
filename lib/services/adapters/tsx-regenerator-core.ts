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
 *
 * Context pattern: Model-specific config bundled together for consistency between tests and production.
 */

import type { LanguageModel } from 'ai';
import { generateText } from 'ai';
import { TSX_REGENERATION_SYSTEM_PROMPT, buildTSXRegenerationUserPrompt } from '../../prompts/tsx-regeneration.prompts';
import type { TSXRegenerationInput, TSXRegenerationResult } from '../../types/tsx-generation.types';
import { stripMarkdownFences } from '../../utils/strip-markdown-fences';
import { createAIModel } from './llm-config';

/**
 * Context for TSX regeneration
 * Bundles all model-specific configuration for this generation task
 */
export interface TSXRegenerationContext {
  model: LanguageModel;
  temperature: number;
  systemPrompt: string;
  buildUserPrompt: (input: TSXRegenerationInput) => string;
}

/**
 * Create context for TSX regeneration
 * Bundles model + prompts + temperature for this specific task
 *
 * Used by both production code and tests to ensure identical configuration.
 *
 * @returns TSX regeneration context with all configuration
 *
 * @example Production usage
 * ```typescript
 * const context = createContextForTSXRegeneration();
 * const result = await regenerateTSX(context, input);
 * ```
 *
 * @example Test usage
 * ```typescript
 * const context = createContextForTSXRegeneration();
 * const result = await regenerateTSX(context, testInput);
 * ```
 */
export const createContextForTSXRegeneration = (): TSXRegenerationContext => {
  const modelName = process.env.CODE_GENERATION_MODEL || 'qwen2.5-coder';
  const model = createAIModel(modelName);

  return {
    model,
    temperature: 0.3, // Even lower temperature for deterministic error fixing
    systemPrompt: TSX_REGENERATION_SYSTEM_PROMPT,
    buildUserPrompt: buildTSXRegenerationUserPrompt,
  };
};

/**
 * Regenerate TSX code based on validation errors
 *
 * Pure function that delegates to Vercel AI SDK.
 * No error handling - let errors bubble up for caller to handle.
 *
 * This is called during validation retry loops when TSX fails validation:
 * 1. TSX generation produces code
 * 2. Validation detects errors (TypeScript compilation, imports)
 * 3. TSX regeneration (this function) fixes errors
 * 4. Validation re-runs on fixed code
 *
 * @param context - TSX regeneration context with model and configuration
 * @param input - TSX regeneration input (original code + errors)
 * @returns Promise resolving to TSXRegenerationResult
 *
 * @example
 * ```typescript
 * const context = createContextForTSXRegeneration();
 * const result = await regenerateTSX(context, input);
 * ```
 */
export const regenerateTSX = async (
  context: TSXRegenerationContext,
  input: TSXRegenerationInput,
): Promise<TSXRegenerationResult> => {
  const result = await generateText({
    model: context.model,
    system: context.systemPrompt,
    prompt: context.buildUserPrompt(input),
    temperature: context.temperature,
  });

  // Return raw TSX code in result format
  // Strip markdown fences if LLM ignored instructions and wrapped code
  return {
    tsxCode: stripMarkdownFences(result.text),
  };
};
