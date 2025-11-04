import { ValidationResult } from '@/lib/types/lesson';
import { isEmpty, isNil } from 'ramda';
import { OllamaClient, createOllamaClient } from './ollama-client';
import type { EnhancedValidationResult } from '@/lib/types/validation.types';
import {
  VALIDATION_THRESHOLDS,
  isIntentAcceptable,
  isSpecificityAcceptable,
  getThresholdDescriptions,
} from '../../config/validation-thresholds';

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
      const thresholds = getThresholdDescriptions();

      // Intent errors (threshold-based)
      const intentAcceptable = isIntentAcceptable(
        enhancedResult.intent.positiveScore,
        enhancedResult.intent.negativeScore,
        enhancedResult.intent.confidence,
      );

      if (!intentAcceptable) {
        if (enhancedResult.intent.negativeScore > VALIDATION_THRESHOLDS.intent.maxNegativeScore) {
          // High negative score - reject
          detailedErrors.push(
            `Invalid intent (negativeScore: ${(enhancedResult.intent.negativeScore * 100).toFixed(0)}%): ${enhancedResult.intent.reasoning}`,
          );
          if (enhancedResult.intent.flags && enhancedResult.intent.flags.length > 0) {
            detailedErrors.push(`Concerns: ${enhancedResult.intent.flags.join(', ')}`);
          }
        } else if (enhancedResult.intent.positiveScore < VALIDATION_THRESHOLDS.intent.minPositiveScore) {
          // Low positive score - unclear/ambiguous
          detailedErrors.push(
            `Unclear intent (positiveScore: ${(enhancedResult.intent.positiveScore * 100).toFixed(0)}%, ${thresholds.intent.positive}): ${enhancedResult.intent.reasoning}`,
          );
        } else if (enhancedResult.intent.confidence < VALIDATION_THRESHOLDS.intent.minConfidence) {
          // Low confidence
          detailedErrors.push(
            `Low confidence in intent assessment (${(enhancedResult.intent.confidence * 100).toFixed(0)}%, ${thresholds.intent.confidence})`,
          );
        }
      }

      // Specificity errors (threshold-based)
      const specificityAcceptable = isSpecificityAcceptable(
        enhancedResult.specificity.specificityScore,
        enhancedResult.specificity.matchesTaxonomy,
      );

      if (!specificityAcceptable) {
        if (enhancedResult.specificity.specificityScore < VALIDATION_THRESHOLDS.specificity.minScore) {
          // Low specificity score
          const matchInfo = enhancedResult.specificity.matchesTaxonomy
            ? `Detected: "${enhancedResult.specificity.detectedHierarchy.topic}"`
            : 'Topic not found in taxonomy';

          detailedErrors.push(
            `Too vague (specificityScore: ${(enhancedResult.specificity.specificityScore * 100).toFixed(0)}%, ${thresholds.specificity.score}): ${matchInfo}`,
          );

          if (enhancedResult.specificity.suggestions && enhancedResult.specificity.suggestions.length > 0) {
            detailedErrors.push(`Suggestions: ${enhancedResult.specificity.suggestions.join('; ')}`);
          }
        } else if (
          !enhancedResult.specificity.matchesTaxonomy &&
          VALIDATION_THRESHOLDS.specificity.requireTaxonomyMatch
        ) {
          // Specific but not in taxonomy
          detailedErrors.push(
            `Topic "${enhancedResult.specificity.detectedHierarchy.topic}" not found in our taxonomy (${thresholds.specificity.taxonomy})`,
          );
          if (enhancedResult.specificity.suggestions && enhancedResult.specificity.suggestions.length > 0) {
            detailedErrors.push(`Did you mean: ${enhancedResult.specificity.suggestions.join(', ')}?`);
          }
        }
      }

      // Actionability errors (boolean-only)
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
