/**
 * Core lesson generation functions
 * Using Vercel AI SDK v5.0+ - https://ai-sdk.dev/
 *
 * Pure functions for lesson generation that are:
 * - Easy to unit test (no side effects)
 * - Easy to use in REPL
 * - Follow SRP and SoC principles
 */

import { generateObject } from 'ai';
import type { LanguageModel } from 'ai';
import type { z } from 'zod';
import type { LessonContent } from '../../types/lesson-structure.types';
import type { StructuredOutline } from '../../types/validation.types';

/**
 * Configuration for lesson generation
 */
export interface LessonGenerationConfig {
  /** Vercel AI SDK model instance */
  model: LanguageModel;
  /** System prompt for lesson generation */
  systemPrompt: string;
  /** Function to build user prompt from outline */
  buildUserPrompt: (outline: StructuredOutline) => string;
  /** Zod schema for validation */
  schema: z.ZodType<LessonContent>;
  /** Temperature for generation (0.0-1.0) */
  temperature?: number;
}

/**
 * Generate lesson content from structured outline
 *
 * Pure function that delegates to Vercel AI SDK.
 * No error handling - let errors bubble up for caller to handle.
 * Easy to test and use in REPL.
 *
 * @param outline - Structured outline to generate lesson from
 * @param config - Generation configuration
 * @returns Promise resolving to validated LessonContent
 *
 * @example REPL usage
 * ```typescript
 * import { generateLessonContent } from './lesson-generator-core'
 * import { createAIModel } from './llm-config'
 * import { LessonContentSchema } from '../../types/lesson-structure.types'
 * import { GENERATION_SYSTEM_PROMPT, buildGenerationUserPrompt } from '../../prompts/generation-prompts'
 *
 * const model = createAIModel('llama3.1')
 * const outline = { title: 'Test', topics: ['foo'], ... }
 * const result = await generateLessonContent(outline, {
 *   model,
 *   systemPrompt: GENERATION_SYSTEM_PROMPT,
 *   buildUserPrompt: buildGenerationUserPrompt,
 *   schema: LessonContentSchema,
 *   temperature: 0.6
 * })
 * ```
 */
export const generateLessonContent = async (
  outline: StructuredOutline,
  config: LessonGenerationConfig,
): Promise<LessonContent> => {
  const result = await generateObject({
    model: config.model,
    schema: config.schema,
    system: config.systemPrompt,
    prompt: config.buildUserPrompt(outline),
    temperature: config.temperature ?? 0.6,
  });

  return result.object;
};

/**
 * Error information for lesson generation failures
 */
export interface LessonGenerationError {
  /** User-friendly error message */
  message: string;
  /** Original error */
  originalError: Error;
  /** Error type for programmatic handling */
  type: 'model_not_found' | 'connection_error' | 'unknown';
}

/**
 * Transform raw errors into user-friendly error messages
 *
 * Pure function that categorizes errors and provides helpful messages.
 * Easy to test with different error inputs.
 *
 * @param error - Error from lesson generation
 * @param modelName - Model name that was used (for error messages)
 * @param host - Ollama host (for error messages)
 * @returns Structured error information
 *
 * @example Unit test
 * ```typescript
 * const error = new Error('model not found')
 * const result = transformLessonGenerationError(error, 'llama3.1', 'http://localhost:11434')
 * expect(result.type).toBe('model_not_found')
 * expect(result.message).toContain('ollama pull')
 * ```
 */
export const transformLessonGenerationError = (
  error: unknown,
  modelName: string,
  host: string,
): LessonGenerationError => {
  if (!(error instanceof Error)) {
    return {
      message: 'Unknown error occurred during lesson generation',
      originalError: new Error(String(error)),
      type: 'unknown',
    };
  }

  // Model not found
  if (error.message.includes('model') || error.message.includes('not found')) {
    return {
      message: `Model '${modelName}' not found. Please run: ollama pull ${modelName}`,
      originalError: error,
      type: 'model_not_found',
    };
  }

  // Connection error
  if (error.message.includes('connection') || error.message.includes('ECONNREFUSED')) {
    return {
      message: `Cannot connect to Ollama server at ${host}. Please ensure Ollama is running.`,
      originalError: error,
      type: 'connection_error',
    };
  }

  // Unknown error
  return {
    message: `Lesson generation failed: ${error.message}`,
    originalError: error,
    type: 'unknown',
  };
};
