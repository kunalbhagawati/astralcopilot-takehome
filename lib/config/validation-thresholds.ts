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
   * Intent validation thresholds
   */
  intent: {
    /**
     * Minimum intent score required (0.0-1.0)
     * 0.0 = harmful/negative intent
     * 1.0 = positive educational intent
     *
     * Conservative: 0.7 (≥70% positive educational intent)
     */
    minIntentScore: 0.7,

    /**
     * Minimum confidence score (0.0-1.0)
     * General confidence in the intent assessment
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
     * Request is considered specific enough if specificityScore >= this value
     *
     * 1.0 = very specific (e.g., "Photosynthesis")
     * 0.5 = moderately specific (e.g., "Biology basics")
     * 0.0 = very vague (e.g., "Science")
     *
     * High specificity: 0.7 (≥70% specificity required)
     */
    minScore: 0.7,

    /**
     * Whether to require taxonomy match
     * If true, rejects requests where matchesTaxonomy = false
     *
     * Strict: true (must match predefined taxonomy)
     */
    requireTaxonomyMatch: true,
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
 * Helper function to check if intent passes validation
 *
 * @param intentScore - Intent gradient score (0.0-1.0)
 * @param confidence - Confidence in assessment (0.0-1.0)
 * @returns True if intent is acceptable
 */
export const isIntentAcceptable = (intentScore: number, confidence: number): boolean => {
  return (
    intentScore >= VALIDATION_THRESHOLDS.intent.minIntentScore &&
    confidence >= VALIDATION_THRESHOLDS.intent.minConfidence
  );
};

/**
 * Helper function to check if specificity passes validation
 *
 * @param specificityScore - Specificity score (0.0-1.0)
 * @param matchesTaxonomy - Whether topic matches predefined taxonomy
 * @returns True if specificity is acceptable
 */
export const isSpecificityAcceptable = (specificityScore: number, matchesTaxonomy: boolean): boolean => {
  const meetsScoreThreshold = specificityScore >= VALIDATION_THRESHOLDS.specificity.minScore;
  const meetsTaxonomyRequirement = !VALIDATION_THRESHOLDS.specificity.requireTaxonomyMatch || matchesTaxonomy;

  return meetsScoreThreshold && meetsTaxonomyRequirement;
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
    intent: {
      score: `Must be ≥${VALIDATION_THRESHOLDS.intent.minIntentScore * 100}% positive educational intent`,
      confidence: `Must be ≥${VALIDATION_THRESHOLDS.intent.minConfidence * 100}% confident`,
    },
    specificity: {
      score: `Must be ≥${VALIDATION_THRESHOLDS.specificity.minScore * 100}% specific`,
      taxonomy: VALIDATION_THRESHOLDS.specificity.requireTaxonomyMatch
        ? 'Must match predefined taxonomy'
        : 'Taxonomy match recommended but not required',
    },
    actionability: {
      ageRange: `Must be within ages ${VALIDATION_THRESHOLDS.actionability.minAge}-${VALIDATION_THRESHOLDS.actionability.maxAge}`,
    },
  };
};
