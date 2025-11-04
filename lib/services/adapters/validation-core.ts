/**
 * Core validation functions
 * Using Vercel AI SDK v5.0+ - https://ai-sdk.dev/
 *
 * Pure functions for validation operations that are:
 * - Easy to unit test (no side effects)
 * - Easy to use in REPL
 * - Follow SRP and SoC principles
 */

import type { LanguageModel } from 'ai';
import { generateObject } from 'ai';
import type { z } from 'zod';
import type {
  EnhancedValidationResult,
  QualityValidationResult,
  StructuredOutline,
} from '../../types/validation.types';

/**
 * Configuration for outline validation
 */
export interface OutlineValidationConfig {
  /** Vercel AI SDK model instance */
  model: LanguageModel;
  /** System prompt for validation */
  systemPrompt: string;
  /** Function to build user prompt from outline text */
  buildUserPrompt: (outline: string) => string;
  /** Zod schema for validation */
  schema: z.ZodType<EnhancedValidationResult>;
  /** Temperature for validation (0.0-1.0) */
  temperature?: number;
}

/**
 * Configuration for outline structuring
 */
export interface OutlineStructuringConfig {
  /** Vercel AI SDK model instance */
  model: LanguageModel;
  /** System prompt for structuring */
  systemPrompt: string;
  /** Function to build user prompt from outline text */
  buildUserPrompt: (outline: string) => string;
  /** Zod schema for validation */
  schema: z.ZodType<StructuredOutline>;
  /** Temperature for structuring (0.0-1.0) */
  temperature?: number;
}

/**
 * Configuration for quality validation
 */
export interface QualityValidationConfig {
  /** Vercel AI SDK model instance */
  model: LanguageModel;
  /** System prompt for quality validation */
  systemPrompt: string;
  /** Function to build user prompt from lesson content (as JSON string) */
  buildUserPrompt: (lessonContentJson: string) => string;
  /** Zod schema for validation */
  schema: z.ZodType<QualityValidationResult>;
  /** Temperature for validation (0.0-1.0) */
  temperature?: number;
}

/**
 * Validate outline for intent, specificity, and actionability
 *
 * Pure function that delegates to Vercel AI SDK.
 * No error handling - let errors bubble up for caller to handle.
 * Easy to test and use in REPL.
 *
 * @param outline - Text outline to validate
 * @param config - Validation configuration
 * @returns Promise resolving to validated EnhancedValidationResult
 *
 * @example REPL usage
 * ```typescript
 * import { generateValidationResult } from './validation-core'
 * import { createAIModel } from './llm-config'
 * import { EnhancedValidationResultSchema } from '../../types/validation.types'
 * import { VALIDATION_SYSTEM_PROMPT, buildValidationUserPrompt } from '../../prompts/validation-prompts'
 *
 * const model = createAIModel('llama3.1')
 * const outline = "Create a quiz on photosynthesis for 5th graders"
 * const result = await generateValidationResult(outline, {
 *   model,
 *   systemPrompt: VALIDATION_SYSTEM_PROMPT,
 *   buildUserPrompt: buildValidationUserPrompt,
 *   schema: EnhancedValidationResultSchema,
 *   temperature: 0.2
 * })
 * ```
 */
export const generateValidationResult = async (
  outline: string,
  config: OutlineValidationConfig,
): Promise<EnhancedValidationResult> => {
  const result = await generateObject({
    model: config.model,
    schema: config.schema,
    system: config.systemPrompt,
    prompt: config.buildUserPrompt(outline),
    temperature: config.temperature ?? 0.2,
  });

  return result.object;
};

/**
 * Structure raw outline text into StructuredOutline format
 *
 * Pure function that delegates to Vercel AI SDK.
 * No error handling - let errors bubble up for caller to handle.
 * Easy to test and use in REPL.
 *
 * @param outline - Text outline to structure
 * @param config - Structuring configuration
 * @returns Promise resolving to validated StructuredOutline
 *
 * @example REPL usage
 * ```typescript
 * import { generateStructuredOutline } from './validation-core'
 * import { createAIModel } from './llm-config'
 * import { StructuredOutlineSchema } from '../../types/validation.types'
 * import { buildOutlineStructuringPrompt } from '../../prompts/generation-prompts'
 *
 * const model = createAIModel('llama3.1')
 * const outline = "Create a quiz on photosynthesis for 5th graders"
 * const result = await generateStructuredOutline(outline, {
 *   model,
 *   systemPrompt: 'You are an expert at parsing educational content requests.',
 *   buildUserPrompt: buildOutlineStructuringPrompt,
 *   schema: StructuredOutlineSchema,
 *   temperature: 0.2
 * })
 * ```
 */
export const generateStructuredOutline = async (
  outline: string,
  config: OutlineStructuringConfig,
): Promise<StructuredOutline> => {
  const result = await generateObject({
    model: config.model,
    schema: config.schema,
    system: config.systemPrompt,
    prompt: config.buildUserPrompt(outline),
    temperature: config.temperature ?? 0.2,
  });

  return result.object;
};

/**
 * Validate quality of generated lesson content
 *
 * Pure function that delegates to Vercel AI SDK.
 * No error handling - let errors bubble up for caller to handle.
 * Easy to test and use in REPL.
 *
 * @param lessonContentJson - Generated lesson content as JSON string
 * @param config - Quality validation configuration
 * @returns Promise resolving to validated QualityValidationResult
 *
 * @example REPL usage
 * ```typescript
 * import { generateQualityValidation } from './validation-core'
 * import { createAIModel } from './llm-config'
 * import { QualityValidationResultSchema } from '../../types/validation.types'
 * import { buildQualityValidationPrompt } from '../../prompts/generation-prompts'
 *
 * const model = createAIModel('llama3.1')
 * const lessonContent = { ... }
 * const contentJson = JSON.stringify(lessonContent, null, 2)
 * const result = await generateQualityValidation(contentJson, {
 *   model,
 *   systemPrompt: 'You are an expert at validating educational content quality.',
 *   buildUserPrompt: buildQualityValidationPrompt,
 *   schema: QualityValidationResultSchema,
 *   temperature: 0.2
 * })
 * ```
 */
export const generateQualityValidation = async (
  lessonContentJson: string,
  config: QualityValidationConfig,
): Promise<QualityValidationResult> => {
  const result = await generateObject({
    model: config.model,
    schema: config.schema,
    system: config.systemPrompt,
    prompt: config.buildUserPrompt(lessonContentJson),
    temperature: config.temperature ?? 0.2,
  });

  return result.object;
};

/**
 * Error information for validation failures
 */
export interface ValidationError {
  /** User-friendly error message */
  message: string;
  /** Original error */
  originalError: Error;
  /** Error type for programmatic handling */
  type: 'model_not_found' | 'connection_error' | 'schema_validation' | 'unknown';
}

/**
 * Transform raw errors into user-friendly error messages
 *
 * Pure function that categorizes errors and provides helpful messages.
 * Easy to test with different error inputs.
 *
 * @param error - Error from validation
 * @param modelName - Model name that was used (for error messages)
 * @param host - Ollama host (for error messages)
 * @returns Structured error information
 *
 * @example Unit test
 * ```typescript
 * const error = new Error('model not found')
 * const result = transformValidationError(error, 'llama3.1', 'http://localhost:11434')
 * expect(result.type).toBe('model_not_found')
 * expect(result.message).toContain('ollama pull')
 * ```
 */
export const transformValidationError = (error: unknown, modelName: string, host: string): ValidationError => {
  if (!(error instanceof Error)) {
    return {
      message: 'Unknown error occurred during validation',
      originalError: new Error(String(error)),
      type: 'unknown',
    };
  }

  // Model not found
  if (error.message.includes('model') && error.message.includes('not found')) {
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

  // Schema validation error
  if (error.message.includes('ZodError') || error.message.includes('validation')) {
    return {
      message: `Validation output does not match expected schema: ${error.message}`,
      originalError: error,
      type: 'schema_validation',
    };
  }

  // Unknown error
  return {
    message: `Validation failed: ${error.message}`,
    originalError: error,
    type: 'unknown',
  };
};
