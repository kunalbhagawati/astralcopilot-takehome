/**
 * Validation threshold configuration
 *
 * Defines numeric thresholds for server-side validation logic.
 * LLM provides scores (0.0-1.0), server applies these thresholds.
 *
 * Philosophy:
 * - LLM speaks in probabilities/scores
 * - Server code makes accept/reject decisions
 * - Thresholds are configurable in one place
 */

/**
 * Validation thresholds for outline validation
 */
export const VALIDATION_THRESHOLDS = {
  /**
   * Safety validation thresholds
   */
  safety: {
    /**
     * Minimum safety score required (0.0-1.0)
     * 0.0 = unsafe/inappropriate for children
     * 1.0 = safe/appropriate educational content
     *
     * Conservative: 0.7 (≥70% safe/appropriate)
     */
    minSafetyScore: 0.7,

    /**
     * Minimum confidence score (0.0-1.0)
     * General confidence in the safety assessment
     *
     * Moderate: 0.6 (≥60% confidence in the assessment)
     */
    minConfidence: 0.6,
  },

  /**
   * Specificity validation thresholds
   */
  specificity: {
    /**
     * Minimum specificity score required (0.0-1.0)
     * Topic must be specific enough to generate ≤100 teaching blocks
     *
     * 1.0 = very specific (e.g., "Photosynthesis")
     * 0.5 = moderately specific (e.g., "Biology basics")
     * 0.0 = very vague (e.g., "Science")
     *
     * High specificity: 0.7 (≥70% specificity required)
     */
    minScore: 0.7,
  },

  /**
   * Actionability validation thresholds
   */
  actionability: {
    /**
     * Supported age range for pedagogy (classes 1-10)
     * Ages 5-16 correspond to typical K-10 education
     */
    minAge: 5,
    maxAge: 16,
  },
} as const;

/**
 * Helper function to check if safety passes validation
 *
 * @param safetyScore - Safety gradient score (0.0-1.0)
 * @param confidence - Confidence in assessment (0.0-1.0)
 * @returns True if safety is acceptable
 */
export const isSafetyAcceptable = (safetyScore: number, confidence: number): boolean => {
  return (
    safetyScore >= VALIDATION_THRESHOLDS.safety.minSafetyScore &&
    confidence >= VALIDATION_THRESHOLDS.safety.minConfidence
  );
};

/**
 * Helper function to check if specificity passes validation
 *
 * @param specificityScore - Specificity score (0.0-1.0)
 * @returns True if specificity is acceptable
 */
export const isSpecificityAcceptable = (specificityScore: number): boolean => {
  return specificityScore >= VALIDATION_THRESHOLDS.specificity.minScore;
};

/**
 * Helper function to check if age range is within supported pedagogy range
 *
 * @param ageRange - Target age range [minAge, maxAge]
 * @returns True if age range is within supported range [5, 16]
 */
export const isAgeRangeAcceptable = (ageRange: [number, number]): boolean => {
  const [minAge, maxAge] = ageRange;
  return (
    minAge >= VALIDATION_THRESHOLDS.actionability.minAge &&
    maxAge <= VALIDATION_THRESHOLDS.actionability.maxAge &&
    minAge <= maxAge
  );
};

/**
 * Get human-readable threshold descriptions
 * Useful for error messages and debugging
 */
export const getThresholdDescriptions = () => {
  return {
    safety: {
      score: `Must be ≥${VALIDATION_THRESHOLDS.safety.minSafetyScore * 100}% safe/appropriate`,
      confidence: `Must be ≥${VALIDATION_THRESHOLDS.safety.minConfidence * 100}% confident`,
    },
    specificity: {
      score: `Must be ≥${VALIDATION_THRESHOLDS.specificity.minScore * 100}% specific`,
    },
    actionability: {
      ageRange: `Must be within ages ${VALIDATION_THRESHOLDS.actionability.minAge}-${VALIDATION_THRESHOLDS.actionability.maxAge}`,
    },
  };
};
