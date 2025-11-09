/**
 * Core validation functions
 * Using Vercel AI SDK v5.0+ - https://ai-sdk.dev/
 *
 * Pure functions for validation operations that are:
 * - Easy to unit test (no side effects)
 * - Easy to use in REPL
 * - Follow SRP and SoC principles
 *
 * Context pattern: Model-specific config bundled together for consistency between tests and production.
 */

import type { LanguageModel } from 'ai';
import { generateObject } from 'ai';
import type { z } from 'zod';
import { VALIDATION_SYSTEM_PROMPT, buildValidationUserPrompt } from '../../prompts/validation.prompts';
import type { EnhancedValidationResult } from '../../types/validation.types';
import { EnhancedValidationResultSchema } from '../../types/validation.types';
import { createAIModel } from './llm-config';

/**
 * Context for outline validation
 * Bundles all model-specific configuration for this generation task
 */
export interface OutlineValidationContext {
  model: LanguageModel;
  temperature: number;
  systemPrompt: string;
  buildUserPrompt: (outline: string) => string;
  schema: z.ZodType<EnhancedValidationResult>;
}

/**
 * Create context for outline validation
 * Bundles model + prompts + temperature + schema for this specific task
 *
 * Used by both production code and tests to ensure identical configuration.
 *
 * @returns Validation context with all configuration
 *
 * @example Production usage
 * ```typescript
 * const context = createContextForOutlineValidation();
 * const result = await generateValidationResult(context, outline);
 * ```
 *
 * @example Test usage
 * ```typescript
 * const context = createContextForOutlineValidation();
 * const result = await generateValidationResult(context, testOutline);
 * ```
 */
export const createContextForOutlineValidation = (): OutlineValidationContext => {
  const modelName = process.env.OUTLINE_VALIDATION_MODEL || 'llama3.1';
  const model = createAIModel(modelName);

  return {
    model,
    temperature: 0.2, // Low temperature for consistent validation
    systemPrompt: VALIDATION_SYSTEM_PROMPT,
    buildUserPrompt: buildValidationUserPrompt,
    schema: EnhancedValidationResultSchema,
  };
};

/**
 * Validate outline for safety, specificity, and actionability
 *
 * Pure function that delegates to Vercel AI SDK.
 * No error handling - let errors bubble up for caller to handle.
 *
 * @param context - Validation context with model and configuration
 * @param outline - Text outline to validate
 * @returns Promise resolving to validated EnhancedValidationResult
 *
 * @example
 * ```typescript
 * const context = createContextForOutlineValidation();
 * const result = await generateValidationResult(context, outline);
 * ```
 */
export const generateValidationResult = async (
  context: OutlineValidationContext,
  outline: string,
): Promise<EnhancedValidationResult> => {
  try {
    const result = await generateObject({
      model: context.model,
      schema: context.schema,
      system: context.systemPrompt,
      prompt: context.buildUserPrompt(outline),
      temperature: context.temperature,
    });

    return result.object;
  } catch (error) {
    console.error('[Validation Error] Full error:', JSON.stringify(error, null, 2));
    console.error('[Validation Error] Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      cause: error instanceof Error ? error.cause : undefined,
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
};
