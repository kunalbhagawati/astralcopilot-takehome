/**
 * LLM client adapter for educational content generation
 * Using Vercel AI SDK v5.0+ - https://ai-sdk.dev/
 *
 * Provider-agnostic facade that wraps Vercel AI SDK's generateObject()
 * Supports: Ollama (local dev), OpenAI, Anthropic, etc. via llm-config.ts
 *
 * Provides structured output generation for:
 * - Outline validation (intent, specificity, actionability)
 * - Outline structuring (converting text to StructuredOutline)
 * - Lesson generation (creating LessonContent)
 * - Quality validation (checking generated content)
 *
 * Note: For provider-specific health checks (e.g., Ollama model management),
 * use lib/utils/ollama-health-check.ts
 */

import type {
  EnhancedValidationResult,
  StructuredOutline,
  QualityValidationResult,
} from '../../types/validation.types';
import type { LessonContent } from '../../types/lesson-structure.types';
import {
  EnhancedValidationResultSchema,
  StructuredOutlineSchema,
  QualityValidationResultSchema,
} from '../../types/validation.types';
import { LessonContentSchema } from '../../types/lesson-structure.types';
import { VALIDATION_SYSTEM_PROMPT, buildValidationUserPrompt } from '../../prompts/validation-prompts';
import {
  GENERATION_SYSTEM_PROMPT,
  buildGenerationUserPrompt,
  buildQualityValidationPrompt,
  buildOutlineStructuringPrompt,
} from '../../prompts/generation-prompts';
import { createAIModel } from './llm-config';
import { generateLessonContent, transformLessonGenerationError } from './lesson-generator-core';
import { generateValidationResult, generateStructuredOutline, generateQualityValidation } from './validation-core';

/**
 * Configuration for LLM client
 * Provider-agnostic configuration (works with any LLM via Vercel AI SDK)
 */
export interface LLMClientConfig {
  /** LLM provider host (default: http://localhost:11434 for Ollama) */
  host?: string;
  /** Model for validation tasks (default: llama3.1) */
  validationModel?: string;
  /** Model for generation tasks (default: llama3.1) */
  generationModel?: string;
  /** Temperature for validation (default: 0.2 for consistency) */
  validationTemperature?: number;
  /** Temperature for generation (default: 0.6 for creativity) */
  generationTemperature?: number;
  /** Request timeout in milliseconds (default: 60000) */
  timeout?: number;
  /** Maximum retry attempts (default: 3) */
  maxRetries?: number;
  /** Retry delay in milliseconds (default: 1000) */
  retryDelay?: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<LLMClientConfig> = {
  host: process.env.OLLAMA_HOST || 'http://localhost:11434',
  validationModel: process.env.OLLAMA_VALIDATION_MODEL || 'llama3.1',
  generationModel: process.env.OLLAMA_GENERATION_MODEL || 'llama3.1',
  validationTemperature: 0.2,
  generationTemperature: 0.6,
  timeout: 60000,
  maxRetries: 3,
  retryDelay: 1000,
};

/**
 * LLM client for educational content generation
 * Provider-agnostic facade wrapping Vercel AI SDK
 */
export class LLMClient {
  private config: Required<LLMClientConfig>;

  constructor(config?: LLMClientConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Validate an outline for intent, specificity, and actionability
   */
  async validateOutline(outline: string): Promise<EnhancedValidationResult> {
    const model = createAIModel(this.config.validationModel);

    return await generateValidationResult(outline, {
      model,
      systemPrompt: VALIDATION_SYSTEM_PROMPT,
      buildUserPrompt: buildValidationUserPrompt,
      schema: EnhancedValidationResultSchema,
      temperature: this.config.validationTemperature,
    });
  }

  /**
   * Structure a validated outline into StructuredOutline format
   * Using Vercel AI SDK's generateObject() for structured output generation
   */
  async structureOutline(outline: string): Promise<StructuredOutline> {
    const model = createAIModel(this.config.validationModel);

    return await generateStructuredOutline(outline, {
      model,
      systemPrompt: 'You are an expert at parsing and structuring educational content requests.',
      buildUserPrompt: buildOutlineStructuringPrompt,
      schema: StructuredOutlineSchema,
      temperature: this.config.validationTemperature,
    });
  }

  /**
   * Generate lesson content from a structured outline
   * Using Vercel AI SDK's generateObject() for structured output generation
   *
   * Thin wrapper around generateLessonContent() that provides:
   * - Configuration from LLMClient instance
   * - User-friendly error messages
   *
   * For direct testing or REPL usage, use generateLessonContent() from lesson-generator-core.ts
   */
  async generateLesson(structuredOutline: StructuredOutline): Promise<LessonContent> {
    try {
      // Create model and delegate to pure function
      const model = createAIModel(this.config.generationModel);

      return await generateLessonContent(structuredOutline, {
        model,
        systemPrompt: GENERATION_SYSTEM_PROMPT,
        buildUserPrompt: buildGenerationUserPrompt,
        schema: LessonContentSchema,
        temperature: this.config.generationTemperature,
      });
    } catch (error) {
      // Transform error to user-friendly message
      const errorInfo = transformLessonGenerationError(error, this.config.generationModel, this.config.host);
      throw new Error(errorInfo.message);
    }
  }

  /**
   * Validate the quality of generated lesson content
   */
  async validateLessonQuality(content: LessonContent): Promise<QualityValidationResult> {
    try {
      const model = createAIModel(this.config.validationModel);
      const contentStr = JSON.stringify(content, null, 2);

      return await generateQualityValidation(contentStr, {
        model,
        systemPrompt: 'You are an expert at evaluating educational content quality.',
        buildUserPrompt: buildQualityValidationPrompt,
        schema: QualityValidationResultSchema,
        temperature: this.config.validationTemperature,
      });
    } catch (error) {
      // If quality validation fails, don't block the lesson
      // Just return a low score with error
      return {
        valid: true,
        errors: [`Quality validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        suggestions: ['Manual review recommended'],
        qualityScore: 0.5,
      };
    }
  }
}

/**
 * Create an LLM client instance with environment-based configuration
 *
 * @param config - Optional configuration override
 * @returns LLMClient instance
 *
 * @example
 * ```typescript
 * const client = createLLMClient();
 * const validation = await client.validateOutline(outline);
 * ```
 */
export const createLLMClient = (config?: LLMClientConfig): LLMClient => {
  return new LLMClient(config);
};
