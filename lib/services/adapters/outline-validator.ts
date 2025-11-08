import type { EnhancedValidationResult } from '@/lib/types/validation.types';
import { ValidationResult } from '@/lib/types/validation.types';
import { isEmpty, isNil } from 'ramda';
import { applyValidationThresholds } from '../validation-rules.service';
import { createContextForOutlineValidation, generateValidationResult } from './outline-validation.core';

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
 * LLM-based outline validator (adapter only)
 *
 * This adapter calls the LLM to get validation scores/feedback.
 * Business logic (threshold checking, error formatting) is handled
 * by validation-rules.service.ts following SoC principles.
 *
 * Provider-agnostic (works with any LLM via Vercel AI SDK)
 */
export class LLMOutlineValidator implements OutlineValidator {
  async validate(outline: string): Promise<EnhancedOutlineValidationResult> {
    // Basic validation first
    if (isNil(outline) || isEmpty(outline.trim())) {
      return {
        valid: false,
        errors: ['Outline cannot be empty'],
      };
    }

    // LLM-based validation for safety, specificity, and actionability
    // Returns raw scores and feedback
    const context = createContextForOutlineValidation();
    const enhancedResult = await generateValidationResult(context, outline);

    // Apply threshold business rules to determine pass/fail
    const validationOutcome = applyValidationThresholds(enhancedResult);

    // Return result with threshold-based validation decision
    const result: EnhancedOutlineValidationResult = {
      valid: validationOutcome.passed,
      errors: validationOutcome.errors,
      enhancedResult,
    };

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
