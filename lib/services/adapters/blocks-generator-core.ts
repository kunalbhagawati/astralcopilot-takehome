/**
 * Core blocks generation functions
 * Using Vercel AI SDK v5.0+ - https://ai-sdk.dev/
 *
 * Pure functions for generating actionable blocks (teaching points) that are:
 * - Easy to unit test (no side effects)
 * - Easy to use in REPL
 * - Follow SRP and SoC principles
 *
 * Actionable blocks = teaching points (WHAT to teach), not full lessons.
 * Each block is a markdown string describing one atomic concept.
 *
 * Context pattern: Model-specific config bundled together for consistency between tests and production.
 */

import type { LanguageModel } from 'ai';
import { generateObject } from 'ai';
import type { z } from 'zod';
import {
  BLOCKS_GENERATION_SYSTEM_PROMPT,
  buildBlocksGenerationUserPrompt,
} from '../../prompts/blocks-generation.prompts';
import type { ActionableBlocksResult, BlockGenerationInput } from '../../types/actionable-blocks.types';
import { ActionableBlocksResultSchema } from '../../types/actionable-blocks.types';
import { createAIModel } from './llm-config';

/**
 * Context for blocks generation
 * Bundles all model-specific configuration for this generation task
 */
export interface BlocksGenerationContext {
  model: LanguageModel;
  temperature: number;
  systemPrompt: string;
  buildUserPrompt: (input: BlockGenerationInput) => string;
  schema: z.ZodType<ActionableBlocksResult>;
}

/**
 * Create context for blocks generation
 * Bundles model + prompts + temperature + schema for this specific task
 *
 * Used by both production code and tests to ensure identical configuration.
 *
 * @returns Blocks generation context with all configuration
 *
 * @example Production usage
 * ```typescript
 * const context = createContextForBlocksGeneration();
 * const result = await generateBlocks(context, input);
 * ```
 *
 * @example Test usage
 * ```typescript
 * const context = createContextForBlocksGeneration();
 * const result = await generateBlocks(context, testInput);
 * ```
 */
export const createContextForBlocksGeneration = (): BlocksGenerationContext => {
  const modelName = process.env.CODE_GENERATION_MODEL || 'qwen2.5-coder';
  const model = createAIModel(modelName);

  return {
    model,
    temperature: 0.6, // Moderate temperature for creative but consistent content generation
    systemPrompt: BLOCKS_GENERATION_SYSTEM_PROMPT,
    buildUserPrompt: buildBlocksGenerationUserPrompt,
    schema: ActionableBlocksResultSchema,
  };
};

/**
 * Generate actionable blocks (teaching points) from validated outline
 *
 * Pure function that delegates to Vercel AI SDK.
 * No error handling - let errors bubble up for caller to handle.
 *
 * This is the SECOND LLM call in the flow:
 * 1. Validation LLM call → produces scores/feedback
 * 2. Blocks generation LLM call (this function) → produces teaching points
 * 3. (Later) Lesson generation LLM call → formats blocks into lessons
 *
 * @param context - Blocks generation context with model and configuration
 * @param input - Block generation input (outline + validation feedback)
 * @returns Promise resolving to ActionableBlocksResult
 *
 * @example
 * ```typescript
 * const context = createContextForBlocksGeneration();
 * const result = await generateBlocks(context, input);
 * ```
 */
export const generateBlocks = async (
  context: BlocksGenerationContext,
  input: BlockGenerationInput,
): Promise<ActionableBlocksResult> => {
  const result = await generateObject({
    model: context.model,
    schema: context.schema,
    system: context.systemPrompt,
    prompt: context.buildUserPrompt(input),
    temperature: context.temperature,
  });

  return result.object;
};
