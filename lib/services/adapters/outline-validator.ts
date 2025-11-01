import { ValidationResult } from '@/lib/types/lesson';
import { isEmpty, isNil } from 'ramda';

/**
 * Adapter interface for outline validation systems
 * This allows us to swap out different validation implementations
 */
export interface OutlineValidator {
  validate(outline: string): Promise<ValidationResult>;
}

/**
 * Runs validation for the outline request.
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

    // TODO Check if outline LLM can understand the request.

    // All checks passed
    return {
      valid: true,
    };
  }
}

// Factory function to get the validator instance
export const getOutlineValidator = (): OutlineValidator => new SimpleOutlineValidator();
