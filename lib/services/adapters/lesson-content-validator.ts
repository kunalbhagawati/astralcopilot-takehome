import {
  LessonContent,
  LessonContentValidationRules,
  DEFAULT_LESSON_VALIDATION_RULES,
} from '@/lib/types/lesson-structure.types';
import { ValidationResult } from '@/lib/types/lesson';

/**
 * Interface for lesson content validators
 *
 * Validates that generated lesson content meets structural and quality requirements
 */
export interface LessonContentValidator {
  /**
   * Validates lesson content structure and quality
   *
   * @param content - The lesson content to validate
   * @returns ValidationResult indicating if content is valid and any errors
   */
  validate(content: LessonContent): Promise<ValidationResult>;
}

/**
 * Dummy implementation of LessonContentValidator for testing
 *
 * Validates:
 * - Required fields are present and non-empty
 * - Minimum number of sections
 * - Required section types are present
 * - Section ordering is sequential
 * - Field length constraints
 */
export class DummyLessonContentValidator implements LessonContentValidator {
  private rules: LessonContentValidationRules;

  constructor(rules: LessonContentValidationRules = DEFAULT_LESSON_VALIDATION_RULES) {
    this.rules = rules;
  }

  async validate(content: LessonContent): Promise<ValidationResult> {
    // Simulate validation delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    const errors: string[] = [];

    // Validate metadata
    if (!content.metadata) {
      errors.push('Lesson metadata is missing');
      return { valid: false, errors };
    }

    if (!content.metadata.title || content.metadata.title.trim().length === 0) {
      errors.push('Lesson title is required');
    }

    if (content.metadata.title && content.metadata.title.length > this.rules.maxTitleLength) {
      errors.push(`Lesson title exceeds maximum length of ${this.rules.maxTitleLength} characters`);
    }

    if (!content.metadata.topics || content.metadata.topics.length === 0) {
      errors.push('At least one topic is required');
    }

    if (!content.metadata.estimatedDuration || content.metadata.estimatedDuration <= 0) {
      errors.push('Estimated duration must be greater than 0');
    }

    // Validate sections
    if (!content.sections || !Array.isArray(content.sections)) {
      errors.push('Sections must be an array');
      return { valid: false, errors };
    }

    if (content.sections.length < this.rules.minSections) {
      errors.push(`Lesson must have at least ${this.rules.minSections} section(s)`);
    }

    // Check for required section types
    const presentTypes = new Set(content.sections.map((s) => s.type));
    const missingTypes = this.rules.requiredSectionTypes.filter((type) => !presentTypes.has(type));

    if (missingTypes.length > 0) {
      errors.push(`Missing required section types: ${missingTypes.join(', ')}`);
    }

    // Validate each section
    content.sections.forEach((section, index) => {
      const sectionNum = index + 1;

      if (!section.id || section.id.trim().length === 0) {
        errors.push(`Section ${sectionNum}: ID is required`);
      }

      if (!section.type) {
        errors.push(`Section ${sectionNum}: Type is required`);
      }

      if (!section.title || section.title.trim().length === 0) {
        errors.push(`Section ${sectionNum}: Title is required`);
      }

      if (!section.content || section.content.trim().length < this.rules.minContentLength) {
        errors.push(`Section ${sectionNum}: Content must be at least ${this.rules.minContentLength} characters`);
      }

      if (section.order !== index) {
        errors.push(`Section ${sectionNum}: Order mismatch (expected ${index}, got ${section.order})`);
      }
    });

    // Check for duplicate section IDs
    const sectionIds = content.sections.map((s) => s.id);
    const duplicateIds = sectionIds.filter((id, index) => sectionIds.indexOf(id) !== index);
    if (duplicateIds.length > 0) {
      errors.push(`Duplicate section IDs found: ${[...new Set(duplicateIds)].join(', ')}`);
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }
}

/**
 * Factory function to get a lesson content validator instance
 *
 * Returns DummyLessonContentValidator for now
 * Future: Can return different implementations based on config/env
 */
export const getLessonContentValidator = (): LessonContentValidator => {
  return new DummyLessonContentValidator();
};
