/**
 * LLM client adapter for educational content generation
 * Using Vercel AI SDK v5.0+ - https://ai-sdk.dev/
 *
 * Provider-agnostic facade that wraps Vercel AI SDK's generateObject()
 * Supports: Ollama (local dev), OpenAI, Anthropic, etc. via llm-config.ts
 *
 * Provides structured output generation for:
 * - Outline validation (intent, specificity, actionability)
 * - Actionable blocks generation (teaching points from validated outline)
 * - TSX generation (React/Next.js components from blocks)
 *
 * Note: For provider-specific health checks (e.g., Ollama model management),
 * use lib/utils/ollama-health-check.ts
 */

import {
  BLOCKS_GENERATION_SYSTEM_PROMPT,
  buildBlocksGenerationUserPrompt,
} from '../../prompts/blocks-generation.prompts';
import { TSX_GENERATION_SYSTEM_PROMPT, buildTSXGenerationUserPrompt } from '../../prompts/tsx-generation.prompts';
import { VALIDATION_SYSTEM_PROMPT, buildValidationUserPrompt } from '../../prompts/validation.prompts';
import type { ActionableBlocksResult, BlockGenerationInput } from '../../types/actionable-blocks.types';
import { ActionableBlocksResultSchema } from '../../types/actionable-blocks.types';
import type { TSXGenerationInput, TSXGenerationResult } from '../../types/tsx-generation.types';
import { TSXGenerationResultSchema } from '../../types/tsx-generation.types';
import type { EnhancedValidationResult } from '../../types/validation.types';
import { EnhancedValidationResultSchema } from '../../types/validation.types';
import { transformLLMError } from '../utils/llm-error-transformer';
import { generateBlocks } from './blocks-generator-core';
import { generateTSX } from './tsx-generator-core';
import { createAIModel } from './llm-config';
import { generateValidationResult } from './outline-validation.core';

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
  generationModel: process.env.OLLAMA_GENERATION_MODEL || 'deepseek-coder-v2',
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
   *
   * First stage of the LLM flow:
   * 1. Validation (this method) → produces scores/feedback
   * 2. Blocks generation → produces teaching points
   * 3. TSX generation → formats blocks into React components
   */
  async validateOutline(outline: string): Promise<EnhancedValidationResult> {
    try {
      const model = createAIModel(this.config.validationModel);

      return await generateValidationResult(outline, {
        model,
        systemPrompt: VALIDATION_SYSTEM_PROMPT,
        buildUserPrompt: buildValidationUserPrompt,
        schema: EnhancedValidationResultSchema,
        temperature: this.config.validationTemperature,
      });
    } catch (error) {
      const llmError = transformLLMError(error, {
        modelName: this.config.validationModel,
        host: this.config.host,
        operation: 'outline validation',
      });
      throw new Error(llmError.message);
    }
  }

  /**
   * Generate actionable blocks (teaching points) from validated outline
   *
   * Second stage of the LLM flow:
   * 1. Validation → produces scores/feedback
   * 2. Blocks generation (this method) → produces teaching points
   * 3. TSX generation → formats blocks into React components
   *
   * Using Vercel AI SDK's generateObject() for structured output generation.
   * Returns ActionableBlocksResult with array of markdown strings.
   *
   * @param input - Block generation input (outline + validation feedback)
   * @returns Actionable blocks result with teaching points
   */
  async generateBlocks(input: BlockGenerationInput): Promise<ActionableBlocksResult> {
    try {
      const model = createAIModel(this.config.generationModel);

      return await generateBlocks(input, {
        model,
        systemPrompt: BLOCKS_GENERATION_SYSTEM_PROMPT,
        buildUserPrompt: buildBlocksGenerationUserPrompt,
        schema: ActionableBlocksResultSchema,
        temperature: this.config.generationTemperature,
      });
    } catch (error) {
      const llmError = transformLLMError(error, {
        modelName: this.config.generationModel,
        host: this.config.host,
        operation: 'blocks generation',
      });
      throw new Error(llmError.message);
    }
  }

  /**
   * Generate TSX code from actionable blocks
   *
   * Third stage of the LLM flow:
   * 1. Validation → produces scores/feedback
   * 2. Blocks generation → produces teaching points
   * 3. TSX generation (this method) → produces React/Next.js components
   *
   * Using Vercel AI SDK's generateObject() for structured output generation.
   * Returns TSXGenerationResult with TSX code strings for each lesson.
   * Recommended model: deepseek-coder-v2 (specialized for code generation)
   *
   * @param input - TSX generation input (blocks result from Stage 2)
   * @returns TSX generation result with React components
   */
  async generateTSXFromBlocks(input: TSXGenerationInput): Promise<TSXGenerationResult> {
    try {
      const model = createAIModel(this.config.generationModel);

      return await generateTSX(input, {
        model,
        systemPrompt: TSX_GENERATION_SYSTEM_PROMPT,
        buildUserPrompt: buildTSXGenerationUserPrompt,
        schema: TSXGenerationResultSchema,
        temperature: 0.4, // Lower temperature for code generation
      });
    } catch (error) {
      const llmError = transformLLMError(error, {
        modelName: this.config.generationModel,
        host: this.config.host,
        operation: 'TSX generation',
      });
      throw new Error(llmError.message);
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
