import { ValidationResult } from '@/lib/types/lesson';

/**
 * Adapter interface for outline validation systems
 * This allows us to swap out different validation implementations
 */
export interface OutlineValidator {
  validate(outline: string): Promise<ValidationResult>;
}

/**
 * Dummy implementation for development
 * Always returns valid with a simulated delay
 */
export class DummyOutlineValidator implements OutlineValidator {
  async validate(outline: string): Promise<ValidationResult> {
    // Simulate processing time
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Basic validation: check if outline is not empty
    if (!outline || outline.trim().length === 0) {
      return {
        valid: false,
        errors: ['Outline cannot be empty'],
      };
    }

    // Check minimum length
    if (outline.trim().length < 10) {
      return {
        valid: false,
        errors: ['Outline is too short. Please provide more detail.'],
      };
    }

    // All checks passed
    return {
      valid: true,
      warnings: outline.length > 1000 ? ['Outline is quite long. Generation may take more time.'] : undefined,
    };
  }
}

// Factory function to get the validator instance
export function getOutlineValidator(): OutlineValidator {
  // In the future, this could return different implementations based on config
  return new DummyOutlineValidator();
}
