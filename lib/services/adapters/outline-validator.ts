import { ValidationResult } from '@/lib/types/lesson';
import { isEmpty, isNil } from 'ramda';
import { OllamaClient, createOllamaClient } from './ollama-client';
import type { EnhancedValidationResult } from '@/lib/types/validation.types';

/**
 * Adapter interface for outline validation systems
 * This allows us to swap out different validation implementations
 */
export interface OutlineValidator {
  validate(outline: string): Promise<ValidationResult>;
}

/**
 * Enhanced outline validator result with detailed validation info
 */
export interface EnhancedOutlineValidationResult extends ValidationResult {
  enhancedResult?: EnhancedValidationResult;
}

/**
 * Runs basic validation for the outline request (no LLM)
 */
export class SimpleOutlineValidator implements OutlineValidator {
  async validate(outline: string): Promise<ValidationResult> {
    // Basic validation: check if outline is not empty
    if (isNil(outline) || isEmpty(outline.trim())) {
      return {
        valid: false,
        errors: ['Outline cannot be empty'],
      };
    }

    // All checks passed
    return {
      valid: true,
    };
  }
}

/**
 * LLM-based outline validator using Ollama
 * Validates intent, specificity, and actionability using LLM
 */
export class LLMOutlineValidator implements OutlineValidator {
  private ollamaClient: OllamaClient;

  constructor(ollamaClient?: OllamaClient) {
    this.ollamaClient = ollamaClient || createOllamaClient();
  }

  async validate(outline: string): Promise<EnhancedOutlineValidationResult> {
    // Basic validation first
    if (isNil(outline) || isEmpty(outline.trim())) {
      return {
        valid: false,
        errors: ['Outline cannot be empty'],
      };
    }

    // LLM-based validation for intent, specificity, and actionability
    const enhancedResult = await this.ollamaClient.validateOutline(outline);

    // Convert enhanced result to simple ValidationResult format
    const result: EnhancedOutlineValidationResult = {
      valid: enhancedResult.valid,
      errors: enhancedResult.errors,
      enhancedResult,
    };

    // Add specific error messages based on validation aspects
    if (!enhancedResult.valid) {
      const detailedErrors: string[] = [];

      // Intent errors
      if (enhancedResult.intent.classification === 'negative') {
        detailedErrors.push(`Invalid intent: ${enhancedResult.intent.reasoning}`);
        if (enhancedResult.intent.flags && enhancedResult.intent.flags.length > 0) {
          detailedErrors.push(`Concerns: ${enhancedResult.intent.flags.join(', ')}`);
        }
      } else if (enhancedResult.intent.classification === 'unclear') {
        detailedErrors.push(`Unclear intent: ${enhancedResult.intent.reasoning}`);
      }

      // Specificity errors
      if (enhancedResult.specificity.classification === 'vague') {
        const matchInfo = enhancedResult.specificity.matchesTaxonomy
          ? `Topic: ${enhancedResult.specificity.detectedHierarchy.topic}`
          : 'Topic not found in taxonomy';

        detailedErrors.push(`Too vague: Please specify a more specific topic. ${matchInfo}`);

        if (enhancedResult.specificity.suggestions && enhancedResult.specificity.suggestions.length > 0) {
          detailedErrors.push(`Suggestions: ${enhancedResult.specificity.suggestions.join('; ')}`);
        }
      } else if (
        !enhancedResult.specificity.matchesTaxonomy &&
        enhancedResult.specificity.classification === 'specific'
      ) {
        // Topic is specific but doesn't match taxonomy
        detailedErrors.push(`Topic "${enhancedResult.specificity.detectedHierarchy.topic}" not found in our taxonomy.`);
        if (enhancedResult.specificity.suggestions && enhancedResult.specificity.suggestions.length > 0) {
          detailedErrors.push(`Did you mean: ${enhancedResult.specificity.suggestions.join(', ')}?`);
        }
      }

      // Actionability errors
      if (!enhancedResult.actionability.actionable) {
        detailedErrors.push('Not actionable: Insufficient information to generate content');
        if (enhancedResult.actionability.missingInfo && enhancedResult.actionability.missingInfo.length > 0) {
          detailedErrors.push(`Missing: ${enhancedResult.actionability.missingInfo.join(', ')}`);
        }
      }

      result.errors = [...(result.errors || []), ...detailedErrors];
    }

    return result;
  }

  /**
   * Get the enhanced validation result if using LLM validator
   */
  getEnhancedResult(result: ValidationResult): EnhancedValidationResult | undefined {
    return (result as EnhancedOutlineValidationResult).enhancedResult;
  }
}

/**
 * Factory function to get the validator instance
 * Uses environment variable to determine which validator to use
 */
export const getOutlineValidator = (): OutlineValidator => {
  const useLLM = process.env.USE_LLM_VALIDATION !== 'false'; // Default to true

  if (useLLM) {
    return new LLMOutlineValidator();
  }

  return new SimpleOutlineValidator();
};
