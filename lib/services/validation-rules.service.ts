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
  isIntentAcceptable,
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

  // Check intent thresholds
  const intentAcceptable = isIntentAcceptable(enhancedResult.intent.intentScore, enhancedResult.intent.confidence);

  if (!intentAcceptable) {
    if (enhancedResult.intent.intentScore < VALIDATION_THRESHOLDS.intent.minIntentScore) {
      // Low intent score - harmful or unclear intent
      const intentPct = (enhancedResult.intent.intentScore * 100).toFixed(0);
      if (enhancedResult.intent.intentScore < 0.3) {
        // Likely harmful intent
        detailedErrors.push(
          `Invalid intent (intentScore: ${intentPct}%, ${thresholds.intent.score}): ${enhancedResult.intent.reasoning}`,
        );
      } else {
        // Unclear/ambiguous intent
        detailedErrors.push(
          `Unclear intent (intentScore: ${intentPct}%, ${thresholds.intent.score}): ${enhancedResult.intent.reasoning}`,
        );
      }
      if (enhancedResult.intent.flags && enhancedResult.intent.flags.length > 0) {
        detailedErrors.push(`Concerns: ${enhancedResult.intent.flags.join(', ')}`);
      }
    } else if (enhancedResult.intent.confidence < VALIDATION_THRESHOLDS.intent.minConfidence) {
      // Low confidence in assessment
      detailedErrors.push(
        `Low confidence in intent assessment (${(enhancedResult.intent.confidence * 100).toFixed(0)}%, ${thresholds.intent.confidence})`,
      );
    }
  }

  // Check specificity thresholds
  const specificityAcceptable = isSpecificityAcceptable(
    enhancedResult.specificity.specificityScore,
    enhancedResult.specificity.matchesTaxonomy,
  );

  if (!specificityAcceptable) {
    if (enhancedResult.specificity.specificityScore < VALIDATION_THRESHOLDS.specificity.minScore) {
      // Low specificity score - too vague
      const matchInfo = enhancedResult.specificity.matchesTaxonomy
        ? `Detected: "${enhancedResult.specificity.detectedHierarchy.topic}"`
        : 'Topic not found in taxonomy';

      detailedErrors.push(
        `Too vague (specificityScore: ${(enhancedResult.specificity.specificityScore * 100).toFixed(0)}%, ${thresholds.specificity.score}): ${matchInfo}`,
      );

      if (enhancedResult.specificity.suggestions && enhancedResult.specificity.suggestions.length > 0) {
        detailedErrors.push(`Suggestions: ${enhancedResult.specificity.suggestions.join('; ')}`);
      }
    } else if (!enhancedResult.specificity.matchesTaxonomy && VALIDATION_THRESHOLDS.specificity.requireTaxonomyMatch) {
      // Specific but not in taxonomy
      detailedErrors.push(
        `Topic "${enhancedResult.specificity.detectedHierarchy.topic}" not found in our taxonomy (${thresholds.specificity.taxonomy})`,
      );
      if (enhancedResult.specificity.suggestions && enhancedResult.specificity.suggestions.length > 0) {
        detailedErrors.push(`Did you mean: ${enhancedResult.specificity.suggestions.join(', ')}?`);
      }
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
  const passed = intentAcceptable && specificityAcceptable && actionabilityAcceptable;

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
    intentReasoning: enhancedResult.intent.reasoning,
    suggestions: enhancedResult.suggestions,
  };
};
