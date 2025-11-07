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
 */

import { generateText } from 'ai';
import type { LanguageModel } from 'ai';
import type {
  TSXGenerationInput,
  TSXGenerationResult,
  SingleLessonTSXInput,
  SingleLessonTSXResult,
} from '../../types/tsx-generation.types';
import { stripMarkdownFences } from '../../utils/strip-markdown-fences';

/**
 * Configuration for TSX generation
 */
export interface TSXGenerationConfig {
  /** Vercel AI SDK model instance */
  model: LanguageModel;
  /** System prompt for TSX generation */
  systemPrompt: string;
  /** Function to build user prompt from input */
  buildUserPrompt: (input: TSXGenerationInput) => string;
  /** Temperature for generation (0.0-1.0) */
  temperature?: number;
}

/**
 * Generate TSX code from actionable blocks
 *
 * Pure function that delegates to Vercel AI SDK.
 * No error handling - let errors bubble up for caller to handle.
 * Easy to test and use in REPL.
 *
 * This is the THIRD LLM call in the flow:
 * 1. Validation LLM call → produces scores/feedback
 * 2. Blocks generation LLM call → produces teaching points
 * 3. TSX generation LLM call (this function) → produces React/Next.js components
 *
 * @param input - TSX generation input (blocks result from Stage 2)
 * @param config - Generation configuration
 * @returns Promise resolving to TSXGenerationResult
 *
 * @example REPL usage
 * ```typescript
 * import { generateTSX } from './tsx-generator-core'
 * import { createAIModel } from './llm-config'
 * import { TSXGenerationResultSchema } from '../../types/tsx-generation.types'
 * import { TSX_GENERATION_SYSTEM_PROMPT, buildTSXGenerationUserPrompt } from '../../prompts/tsx-generation.prompts'
 *
 * const model = createAIModel('deepseek-coder-v2')
 * const input = {
 *   blocksResult: {
 *     lessons: [
 *       {
 *         title: "Introduction to Photosynthesis",
 *         blocks: [
 *           "**What is photosynthesis?** Plants make their own food...",
 *           "**Three ingredients:** Sunlight, water, CO2..."
 *         ]
 *       }
 *     ],
 *     metadata: {
 *       topic: "Photosynthesis",
 *       domains: ["science", "biology"],
 *       ageRange: [10, 11],
 *       complexity: "moderate",
 *       totalBlockCount: 2
 *     }
 *   }
 * }
 * const result = await generateTSX(input, {
 *   model,
 *   systemPrompt: TSX_GENERATION_SYSTEM_PROMPT,
 *   buildUserPrompt: buildTSXGenerationUserPrompt,
 *   schema: TSXGenerationResultSchema,
 *   temperature: 0.4
 * })
 * ```
 */
export const generateTSX = async (
  input: TSXGenerationInput,
  config: TSXGenerationConfig,
): Promise<TSXGenerationResult> => {
  const result = await generateText({
    model: config.model,
    system: config.systemPrompt,
    prompt: config.buildUserPrompt(input),
    temperature: config.temperature ?? 0.4, // Lower temp for code generation (more deterministic)
  });

  // Return raw TSX code wrapped in result format
  // The result.text contains the complete TSX file content
  return {
    lessons: input.blocksResult.lessons.map((lesson) => ({
      title: lesson.title,
      tsxCode: result.text, // Raw TSX code from LLM
    })),
    metadata: {
      lessonCount: input.blocksResult.lessons.length,
      model: typeof config.model === 'string' ? config.model : 'unknown',
      generatedAt: new Date().toISOString(),
    },
  };
};

/**
 * Configuration for single-lesson TSX generation
 */
export interface SingleLessonTSXConfig {
  /** Vercel AI SDK model instance */
  model: LanguageModel;
  /** System prompt for TSX generation */
  systemPrompt: string;
  /** Function to build user prompt from input */
  buildUserPrompt: (input: SingleLessonTSXInput) => string;
  /** Temperature for generation (0.0-1.0) */
  temperature?: number;
}

/**
 * Generate TSX code for a single lesson
 *
 * Sequential generation approach: one lesson at a time.
 * Enables better parallelization and error isolation compared to batch generation.
 *
 * Pure function that delegates to Vercel AI SDK.
 * No error handling - let errors bubble up for caller to handle.
 *
 * @param input - Single lesson TSX input (title, blocks, context)
 * @param config - Generation configuration
 * @returns Promise resolving to SingleLessonTSXResult
 *
 * @example REPL usage
 * ```typescript
 * import { generateSingleLessonTSX } from './tsx-generator-core'
 * import { createAIModel } from './llm-config'
 * import { SingleLessonTSXResultSchema } from '../../types/tsx-generation.types'
 * import { TSX_GENERATION_SYSTEM_PROMPT, buildSingleLessonTSXPrompt } from '../../prompts/tsx-generation.prompts'
 *
 * const model = createAIModel('deepseek-coder-v2')
 * const input = {
 *   title: "Introduction to Photosynthesis",
 *   blocks: [
 *     { type: "text", content: "**What is photosynthesis?** Plants make..." },
 *     { type: "image", format: "svg", content: "...", alt: "Diagram" }
 *   ],
 *   context: {
 *     topic: "Photosynthesis",
 *     domains: ["science", "biology"],
 *     ageRange: [10, 11],
 *     complexity: "moderate"
 *   }
 * }
 * const result = await generateSingleLessonTSX(input, {
 *   model,
 *   systemPrompt: TSX_GENERATION_SYSTEM_PROMPT,
 *   buildUserPrompt: buildSingleLessonTSXPrompt,
 *   schema: SingleLessonTSXResultSchema,
 *   temperature: 0.4
 * })
 * ```
 */
export const generateSingleLessonTSX = async (
  input: SingleLessonTSXInput,
  config: SingleLessonTSXConfig,
): Promise<SingleLessonTSXResult> => {
  const result = await generateText({
    model: config.model,
    system: config.systemPrompt,
    prompt: config.buildUserPrompt(input),
    temperature: config.temperature ?? 0.4, // Lower temp for code generation (more deterministic)
  });

  // Return raw TSX code in result format
  // Strip markdown fences if LLM ignored instructions and wrapped code
  // The result.text contains the complete TSX file content
  return {
    tsxCode: stripMarkdownFences(result.text), // Raw TSX code from LLM, cleaned
  };
};
