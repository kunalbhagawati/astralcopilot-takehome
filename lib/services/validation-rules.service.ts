/**
 * Validation Rules Service
 *
 * Business logic for applying validation thresholds to LLM validation results.
 * Separates business rules from LLM adapter logic following SoC principles.
 *
 * Responsibilities:
 * - Apply threshold rules to validation scores
 * - Format validation error messages
 * - Determine pass/fail outcomes
 */

import type { EnhancedValidationResult } from '@/lib/types/validation.types';
import {
  VALIDATION_THRESHOLDS,
  isSafetyAcceptable,
  isSpecificityAcceptable,
  isAgeRangeAcceptable,
  getThresholdDescriptions,
} from '@/lib/config/validation-thresholds';

/**
 * Validation outcome after applying business rules
 */
export interface ValidationOutcome {
  /** Whether validation passed all threshold checks */
  passed: boolean;
  /** Detailed error messages if validation failed */
  errors: string[];
  /** Original enhanced validation result from LLM */
  enhancedResult: EnhancedValidationResult;
}

/**
 * Apply validation thresholds to LLM-generated validation result
 *
 * Philosophy: LLM provides scores/analysis, service applies business rules.
 *
 * @param enhancedResult - Raw validation result from LLM adapter
 * @returns Validation outcome with pass/fail and formatted errors
 */
export const applyValidationThresholds = (enhancedResult: EnhancedValidationResult): ValidationOutcome => {
  const detailedErrors: string[] = [];
  const thresholds = getThresholdDescriptions();

  // Check safety thresholds
  const safetyAcceptable = isSafetyAcceptable(enhancedResult.safety.safetyScore, enhancedResult.safety.confidence);

  if (!safetyAcceptable) {
    if (enhancedResult.safety.safetyScore < VALIDATION_THRESHOLDS.safety.minSafetyScore) {
      // Low safety score - unsafe or inappropriate content
      const safetyPct = (enhancedResult.safety.safetyScore * 100).toFixed(0);
      if (enhancedResult.safety.safetyScore < 0.3) {
        // Likely unsafe/inappropriate
        detailedErrors.push(
          `Unsafe content (safetyScore: ${safetyPct}%, ${thresholds.safety.score}): ${enhancedResult.safety.reasoning}`,
        );
      } else {
        // Unclear safety level
        detailedErrors.push(
          `Safety concerns (safetyScore: ${safetyPct}%, ${thresholds.safety.score}): ${enhancedResult.safety.reasoning}`,
        );
      }
      if (enhancedResult.safety.flags && enhancedResult.safety.flags.length > 0) {
        detailedErrors.push(`Concerns: ${enhancedResult.safety.flags.join(', ')}`);
      }
    } else if (enhancedResult.safety.confidence < VALIDATION_THRESHOLDS.safety.minConfidence) {
      // Low confidence in assessment
      detailedErrors.push(
        `Low confidence in safety assessment (${(enhancedResult.safety.confidence * 100).toFixed(0)}%, ${thresholds.safety.confidence})`,
      );
    }
  }

  // Check specificity thresholds
  const specificityAcceptable = isSpecificityAcceptable(enhancedResult.specificity.specificityScore);

  if (!specificityAcceptable) {
    // Low specificity score - too vague
    detailedErrors.push(
      `Too vague (specificityScore: ${(enhancedResult.specificity.specificityScore * 100).toFixed(0)}%, ${thresholds.specificity.score}): Topic "${enhancedResult.specificity.detectedHierarchy.topic}" needs more specificity`,
    );

    if (enhancedResult.specificity.suggestions && enhancedResult.specificity.suggestions.length > 0) {
      detailedErrors.push(`Suggestions: ${enhancedResult.specificity.suggestions.join('; ')}`);
    }
  }

  // Check actionability (boolean check + age range validation)
  let actionabilityAcceptable = true;

  if (!enhancedResult.actionability.actionable) {
    actionabilityAcceptable = false;
    detailedErrors.push('Not actionable: Insufficient information to generate content');
    if (enhancedResult.actionability.missingInfo && enhancedResult.actionability.missingInfo.length > 0) {
      detailedErrors.push(`Missing: ${enhancedResult.actionability.missingInfo.join(', ')}`);
    }
  }

  // Check age range
  const ageRangeAcceptable = isAgeRangeAcceptable(enhancedResult.actionability.targetAgeRange);
  if (!ageRangeAcceptable) {
    actionabilityAcceptable = false;
    const [minAge, maxAge] = enhancedResult.actionability.targetAgeRange;
    detailedErrors.push(
      `Age range [${minAge}, ${maxAge}] is outside supported pedagogy range (${thresholds.actionability.ageRange})`,
    );
  }

  // Include any errors from the enhanced result itself
  const allErrors = [...(enhancedResult.errors || []), ...detailedErrors];

  // Determine overall pass/fail
  const passed = safetyAcceptable && specificityAcceptable && actionabilityAcceptable;

  return {
    passed,
    errors: allErrors,
    enhancedResult,
  };
};

/**
 * Extract non-redundant validation feedback for actionable generation
 *
 * Filters out redundant fields like "valid" flag that shouldn't be passed
 * to the actionable generation stage.
 *
 * @param enhancedResult - Enhanced validation result
 * @returns Relevant feedback for actionable generation
 */
export const extractValidationFeedback = (enhancedResult: EnhancedValidationResult) => {
  return {
    detectedHierarchy: enhancedResult.specificity.detectedHierarchy,
    requirements: enhancedResult.actionability.requirements,
    targetAgeRange: enhancedResult.actionability.targetAgeRange,
    // Optionally include reasoning if helpful for generation
    safetyReasoning: enhancedResult.safety.reasoning,
    suggestions: enhancedResult.suggestions,
  };
};
