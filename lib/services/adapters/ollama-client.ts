/**
 * Ollama client adapter for LLM interactions
 * Using Vercel AI SDK v5.0+ - https://ai-sdk.dev/
 * Using Ollama v0.6+ (legacy methods) - https://ollama.com/
 *
 * Provides structured output generation for:
 * - Outline validation (intent, specificity, actionability) [Legacy Ollama]
 * - Outline structuring (converting text to StructuredOutline) [Legacy Ollama]
 * - Lesson generation (creating LessonContent) [Vercel AI SDK - POC]
 * - Quality validation (checking generated content) [Legacy Ollama]
 */

import { Ollama } from 'ollama';
import type { EnhancedValidationResult, StructuredOutline } from '../../types/validation.types';
import type { LessonContent } from '../../types/lesson-structure.types';
import { EnhancedValidationResultSchema, StructuredOutlineSchema } from '../../types/validation.types';
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

/**
 * Configuration for Ollama client
 */
export interface OllamaConfig {
  /** Ollama server host (default: http://localhost:11434) */
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
const DEFAULT_CONFIG: Required<OllamaConfig> = {
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
 * Quality validation result
 */
interface QualityValidationResult {
  valid: boolean;
  errors: string[];
  suggestions: string[];
  qualityScore: number;
}

/**
 * Ollama client for LLM interactions
 */
export class OllamaClient {
  private client: Ollama;
  private config: Required<OllamaConfig>;

  constructor(config?: OllamaConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.client = new Ollama({ host: this.config.host });
  }

  /**
   * Validate an outline for intent, specificity, and actionability
   */
  async validateOutline(outline: string): Promise<EnhancedValidationResult> {
    try {
      return await this.retryWithBackoff(async () => {
        const response = await this.client.chat({
          model: this.config.validationModel,
          messages: [
            { role: 'system', content: VALIDATION_SYSTEM_PROMPT },
            { role: 'user', content: buildValidationUserPrompt(outline) },
          ],
          format: 'json',
          options: {
            temperature: this.config.validationTemperature,
          },
        });

        // Parse and validate response
        const content = response.message.content;
        const parsed = JSON.parse(content);

        // Repair common issues in LLM response before schema validation
        this.repairValidationResponse(parsed);

        // Validate against schema
        const validated = EnhancedValidationResultSchema.parse(parsed);

        return validated;
      }, 'Outline validation');
    } catch (error) {
      return this.handleValidationError(error);
    }
  }

  /**
   * Structure a validated outline into StructuredOutline format
   */
  async structureOutline(outline: string): Promise<StructuredOutline> {
    return await this.retryWithBackoff(async () => {
      const response = await this.client.chat({
        model: this.config.validationModel,
        messages: [
          {
            role: 'system',
            content: 'You are an expert at parsing and structuring educational content requests.',
          },
          { role: 'user', content: buildOutlineStructuringPrompt(outline) },
        ],
        format: 'json',
        options: {
          temperature: this.config.validationTemperature,
        },
      });

      // Parse and validate response
      const content = response.message.content;
      const parsed = JSON.parse(content);

      // Validate against schema
      const validated = StructuredOutlineSchema.parse(parsed);

      return validated;
    }, 'Outline structuring');
  }

  /**
   * Generate lesson content from a structured outline
   * Using Vercel AI SDK's generateObject() for structured output generation
   *
   * Thin wrapper around generateLessonContent() that provides:
   * - Configuration from OllamaClient instance
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
      const contentStr = JSON.stringify(content, null, 2);
      const response = await this.client.chat({
        model: this.config.validationModel,
        messages: [
          {
            role: 'system',
            content: 'You are an expert at evaluating educational content quality.',
          },
          { role: 'user', content: buildQualityValidationPrompt(contentStr) },
        ],
        format: 'json',
        options: {
          temperature: this.config.validationTemperature,
        },
      });

      // Parse response
      const responseContent = response.message.content;
      const parsed = JSON.parse(responseContent);

      return {
        valid: parsed.valid ?? false,
        errors: parsed.errors ?? [],
        suggestions: parsed.suggestions ?? [],
        qualityScore: parsed.qualityScore ?? 0,
      };
    } catch (error) {
      // If quality validation fails, don't block the lesson
      // Just return a low score with error
      return {
        valid: true,
        errors: [`Quality validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        suggestions: ['Manual review recommended'],
        qualityScore: 5,
      };
    }
  }

  /**
   * Check if Ollama is available and model is ready
   */
  async checkHealth(): Promise<{ available: boolean; models: string[] }> {
    try {
      const models = await this.client.list();
      const modelNames = models.models.map((m) => m.name);

      return {
        available: true,
        models: modelNames,
      };
    } catch {
      return {
        available: false,
        models: [],
      };
    }
  }

  /**
   * Pull a model if not available
   */
  async ensureModel(modelName: string): Promise<void> {
    try {
      const health = await this.checkHealth();
      if (!health.models.some((m) => m.startsWith(modelName))) {
        console.log(`Pulling model ${modelName}...`);
        await this.client.pull({ model: modelName });
      }
    } catch (error) {
      throw new Error(
        `Failed to ensure model ${modelName}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Retry a function with exponential backoff
   */
  private async retryWithBackoff<T>(fn: () => Promise<T>, operationName: string): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry on certain errors
        if (lastError.message.includes('model') && lastError.message.includes('not found')) {
          throw lastError; // Model not found - no point retrying
        }

        if (lastError.message.includes('context length')) {
          throw lastError; // Context too long - no point retrying
        }

        // Log retry attempt
        console.warn(`${operationName} attempt ${attempt + 1}/${this.config.maxRetries} failed:`, lastError.message);

        // Wait before retrying (exponential backoff)
        if (attempt < this.config.maxRetries - 1) {
          const delay = this.config.retryDelay * Math.pow(2, attempt);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error(`${operationName} failed after ${this.config.maxRetries} attempts`);
  }

  /**
   * Repair common issues in validation response before schema validation
   * Mutates the parsed object to fix missing or invalid fields
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private repairValidationResponse(parsed: any): void {
    // Ensure detectedHierarchy exists and has required string fields
    if (!parsed.specificity) {
      parsed.specificity = {};
    }
    if (!parsed.specificity.detectedHierarchy) {
      parsed.specificity.detectedHierarchy = {};
    }

    const hierarchy = parsed.specificity.detectedHierarchy;
    if (!hierarchy.stream || typeof hierarchy.stream !== 'string') {
      hierarchy.stream = 'unknown';
    }
    if (!hierarchy.domain || typeof hierarchy.domain !== 'string') {
      hierarchy.domain = 'unknown';
    }
    if (!hierarchy.topic || typeof hierarchy.topic !== 'string') {
      hierarchy.topic = 'unknown';
    }

    // Ensure estimatedComplexity is valid
    if (!parsed.actionability) {
      parsed.actionability = {};
    }
    const validComplexities = ['simple', 'moderate', 'complex'];
    if (!validComplexities.includes(parsed.actionability.estimatedComplexity)) {
      parsed.actionability.estimatedComplexity = 'moderate';
    }

    // Ensure other required fields exist
    if (!parsed.actionability.requirements) {
      parsed.actionability.requirements = [];
    }
    if (!parsed.actionability.contentType) {
      parsed.actionability.contentType = 'unknown';
    }
    if (typeof parsed.actionability.actionable !== 'boolean') {
      parsed.actionability.actionable = false;
    }
  }

  /**
   * Handle validation errors gracefully
   */
  private handleValidationError(error: unknown): EnhancedValidationResult {
    console.error('Validation error:', error);

    // Check for specific error types
    if (error instanceof Error) {
      // Model not found
      if (error.message.includes('model') && error.message.includes('not found')) {
        return {
          valid: false,
          intent: {
            classification: 'unclear',
            confidence: 0,
            reasoning: 'Validation model not available',
          },
          specificity: {
            level: 'stream',
            classification: 'unclear',
            detectedHierarchy: {
              stream: 'unknown',
              domain: 'unknown',
              topic: 'unknown',
            },
          },
          actionability: {
            actionable: false,
            contentType: 'unknown',
            estimatedComplexity: 'moderate',
            requirements: [],
          },
          errors: [
            `Validation model '${this.config.validationModel}' not found. Please run: ollama pull ${this.config.validationModel}`,
          ],
        };
      }

      // Context length exceeded
      if (error.message.includes('context length')) {
        return {
          valid: false,
          intent: {
            classification: 'unclear',
            confidence: 0,
            reasoning: 'Outline too long',
          },
          specificity: {
            level: 'stream',
            classification: 'unclear',
            detectedHierarchy: {
              stream: 'unknown',
              domain: 'unknown',
              topic: 'unknown',
            },
          },
          actionability: {
            actionable: false,
            contentType: 'unknown',
            estimatedComplexity: 'complex',
            requirements: [],
          },
          errors: ['Outline is too long for validation. Please shorten your request.'],
        };
      }

      // Connection error
      if (error.message.includes('ECONNREFUSED') || error.message.includes('fetch failed')) {
        return {
          valid: false,
          intent: {
            classification: 'unclear',
            confidence: 0,
            reasoning: 'Cannot connect to Ollama server',
          },
          specificity: {
            level: 'stream',
            classification: 'unclear',
            detectedHierarchy: {
              stream: 'unknown',
              domain: 'unknown',
              topic: 'unknown',
            },
          },
          actionability: {
            actionable: false,
            contentType: 'unknown',
            estimatedComplexity: 'moderate',
            requirements: [],
          },
          errors: [`Cannot connect to Ollama server at ${this.config.host}. Please ensure Ollama is running.`],
        };
      }
    }

    // Generic error
    return {
      valid: false,
      intent: {
        classification: 'unclear',
        confidence: 0,
        reasoning: 'Validation failed due to technical error',
      },
      specificity: {
        level: 'stream',
        classification: 'unclear',
        detectedHierarchy: {
          stream: 'unknown',
          domain: 'unknown',
          topic: 'unknown',
        },
      },
      actionability: {
        actionable: false,
        contentType: 'unknown',
        estimatedComplexity: 'moderate',
        requirements: [],
      },
      errors: [`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
    };
  }
}

/**
 * Create a singleton instance with environment-based configuration
 */
export const createOllamaClient = (config?: OllamaConfig): OllamaClient => {
  return new OllamaClient(config);
};
