/**
 * Core TSX generation functions
 * Using Vercel AI SDK v5.0+ - https://ai-sdk.dev/
 *
 * Pure functions for generating React/Next.js TSX from actionable blocks:
 * - Easy to unit test (no side effects)
 * - Easy to use in REPL
 * - Follow SRP and SoC principles
 *
 * Converts markdown teaching blocks into production-ready TSX components.
 *
 * Context pattern: Model-specific config bundled together for consistency between tests and production.
 */

import type { LanguageModel } from 'ai';
import { generateText } from 'ai';
import {
  TSX_GENERATION_SYSTEM_PROMPT,
  buildSingleLessonTSXPrompt,
  buildTSXGenerationUserPrompt,
} from '../../prompts/tsx-generation.prompts';
import type {
  SingleLessonTSXInput,
  SingleLessonTSXResult,
  TSXGenerationInput,
  TSXGenerationResult,
} from '../../types/tsx-generation.types';
import { stripMarkdownFences } from '../../utils/strip-markdown-fences';
import { createAIModel } from './llm-config';

/**
 * Context for single-lesson TSX generation
 * Bundles all model-specific configuration for this generation task
 */
export interface SingleLessonTSXContext {
  model: LanguageModel;
  temperature: number;
  systemPrompt: string;
  buildUserPrompt: (input: SingleLessonTSXInput) => string;
}

/**
 * Create context for single-lesson TSX generation
 * Bundles model + prompts + temperature for this specific task
 *
 * Used by both production code and tests to ensure identical configuration.
 *
 * @returns TSX generation context with all configuration
 *
 * @example Production usage
 * ```typescript
 * const context = createContextForSingleLessonTSX();
 * const result = await generateSingleLessonTSX(context, input);
 * ```
 *
 * @example Test usage
 * ```typescript
 * const context = createContextForSingleLessonTSX();
 * const result = await generateSingleLessonTSX(context, testInput);
 * ```
 */
export const createContextForSingleLessonTSX = (): SingleLessonTSXContext => {
  const modelName = process.env.CODE_GENERATION_MODEL || 'qwen2.5-coder';
  const model = createAIModel(modelName);

  return {
    model,
    temperature: 0.4, // Lower temperature for deterministic code generation
    systemPrompt: TSX_GENERATION_SYSTEM_PROMPT,
    buildUserPrompt: buildSingleLessonTSXPrompt,
  };
};

/**
 * Generate TSX code for a single lesson
 *
 * Sequential generation approach: one lesson at a time.
 * Enables better parallelization and error isolation compared to batch generation.
 *
 * Pure function that delegates to Vercel AI SDK.
 * No error handling - let errors bubble up for caller to handle.
 *
 * @param context - TSX generation context with model and configuration
 * @param input - Single lesson TSX input (title, blocks, context)
 * @returns Promise resolving to SingleLessonTSXResult
 *
 * @example
 * ```typescript
 * const context = createContextForSingleLessonTSX();
 * const result = await generateSingleLessonTSX(context, input);
 * ```
 */
export const generateSingleLessonTSX = async (
  context: SingleLessonTSXContext,
  input: SingleLessonTSXInput,
): Promise<SingleLessonTSXResult> => {
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

/**
 * Context for batch TSX generation
 * Bundles all model-specific configuration for this generation task
 */
export interface TSXGenerationContext {
  model: LanguageModel;
  temperature: number;
  systemPrompt: string;
  buildUserPrompt: (input: TSXGenerationInput) => string;
}

/**
 * Create context for batch TSX generation
 * Bundles model + prompts + temperature for this specific task
 *
 * Note: Batch generation is legacy. Production uses single-lesson generation.
 * Kept for testing purposes.
 *
 * @returns TSX generation context with all configuration
 */
export const createContextForTSXGeneration = (): TSXGenerationContext => {
  const modelName = process.env.CODE_GENERATION_MODEL || 'qwen2.5-coder';
  const model = createAIModel(modelName);

  return {
    model,
    temperature: 0.4,
    systemPrompt: TSX_GENERATION_SYSTEM_PROMPT,
    buildUserPrompt: buildTSXGenerationUserPrompt,
  };
};

/**
 * Generate TSX code from actionable blocks (batch mode)
 *
 * Legacy batch generation approach. Production uses single-lesson generation.
 * Kept for testing purposes.
 *
 * @param context - TSX generation context with model and configuration
 * @param input - TSX generation input (blocks result)
 * @returns Promise resolving to TSXGenerationResult
 */
export const generateTSX = async (
  context: TSXGenerationContext,
  input: TSXGenerationInput,
): Promise<TSXGenerationResult> => {
  const result = await generateText({
    model: context.model,
    system: context.systemPrompt,
    prompt: context.buildUserPrompt(input),
    temperature: context.temperature,
  });

  return {
    lessons: input.blocksResult.lessons.map((lesson) => ({
      title: lesson.title,
      tsxCode: result.text,
    })),
    metadata: {
      lessonCount: input.blocksResult.lessons.length,
      model: typeof context.model === 'string' ? context.model : 'unknown',
      generatedAt: new Date().toISOString(),
    },
  };
};
