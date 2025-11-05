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
 */

import { generateObject } from 'ai';
import type { LanguageModel } from 'ai';
import type { z } from 'zod';
import type { ActionableBlocksResult, BlockGenerationInput } from '../../types/actionable-blocks.types';

/**
 * Configuration for blocks generation
 */
export interface BlocksGenerationConfig {
  /** Vercel AI SDK model instance */
  model: LanguageModel;
  /** System prompt for blocks generation */
  systemPrompt: string;
  /** Function to build user prompt from input */
  buildUserPrompt: (input: BlockGenerationInput) => string;
  /** Zod schema for validation */
  schema: z.ZodType<ActionableBlocksResult>;
  /** Temperature for generation (0.0-1.0) */
  temperature?: number;
}

/**
 * Generate actionable blocks (teaching points) from validated outline
 *
 * Pure function that delegates to Vercel AI SDK.
 * No error handling - let errors bubble up for caller to handle.
 * Easy to test and use in REPL.
 *
 * This is the SECOND LLM call in the flow:
 * 1. Validation LLM call → produces scores/feedback
 * 2. Blocks generation LLM call (this function) → produces teaching points
 * 3. (Later) Lesson generation LLM call → formats blocks into lessons
 *
 * @param input - Block generation input (outline + validation feedback)
 * @param config - Generation configuration
 * @returns Promise resolving to ActionableBlocksResult
 *
 * @example REPL usage
 * ```typescript
 * import { generateBlocks } from './blocks-generator-core'
 * import { createAIModel } from './llm-config'
 * import { ActionableBlocksResultSchema } from '../../types/actionable-blocks.types'
 * import { BLOCKS_GENERATION_SYSTEM_PROMPT, buildBlocksGenerationUserPrompt } from '../../prompts/blocks-generation-prompts'
 *
 * const model = createAIModel('llama3.1')
 * const input = {
 *   originalOutline: 'Create a quiz on photosynthesis for 5th graders',
 *   validationFeedback: {
 *     detectedHierarchy: { topic: 'Photosynthesis', domains: ['science', 'biology', 'plants'] },
 *     requirements: ['age-appropriate for 5th grade', 'cover key concepts'],
 *     complexity: 'moderate'
 *   },
 *   ageRange: [10, 11]
 * }
 * const result = await generateBlocks(input, {
 *   model,
 *   systemPrompt: BLOCKS_GENERATION_SYSTEM_PROMPT,
 *   buildUserPrompt: buildBlocksGenerationUserPrompt,
 *   schema: ActionableBlocksResultSchema,
 *   temperature: 0.7
 * })
 * ```
 */
export const generateBlocks = async (
  input: BlockGenerationInput,
  config: BlocksGenerationConfig,
): Promise<ActionableBlocksResult> => {
  const result = await generateObject({
    model: config.model,
    schema: config.schema,
    system: config.systemPrompt,
    prompt: config.buildUserPrompt(input),
    temperature: config.temperature ?? 0.7,
  });

  return result.object;
};
