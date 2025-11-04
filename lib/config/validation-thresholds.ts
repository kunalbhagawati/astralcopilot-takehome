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
     * Minimum positive score required (0.0-1.0)
     * Request is considered acceptable if positiveScore >= this value
     *
     * Conservative: 0.8 (≥80% confidence in positive educational intent)
     */
    minPositiveScore: 0.8,

    /**
     * Maximum negative score allowed (0.0-1.0)
     * Request is rejected if negativeScore > this value
     *
     * Conservative: 0.2 (>20% confidence in harmful/negative intent)
     */
    maxNegativeScore: 0.2,

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
   * Currently boolean-only (actionable: true/false)
   * No numeric thresholds needed
   */
  actionability: {
    // Future: Could add complexity thresholds if needed
  },
} as const;

/**
 * Helper function to check if intent passes validation
 *
 * @param positiveScore - Positive intent score (0.0-1.0)
 * @param negativeScore - Negative intent score (0.0-1.0)
 * @param confidence - Confidence in assessment (0.0-1.0)
 * @returns True if intent is acceptable
 */
export const isIntentAcceptable = (positiveScore: number, negativeScore: number, confidence: number): boolean => {
  return (
    positiveScore >= VALIDATION_THRESHOLDS.intent.minPositiveScore &&
    negativeScore <= VALIDATION_THRESHOLDS.intent.maxNegativeScore &&
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
 * Get human-readable threshold descriptions
 * Useful for error messages and debugging
 */
export const getThresholdDescriptions = () => {
  return {
    intent: {
      positive: `Must be ≥${VALIDATION_THRESHOLDS.intent.minPositiveScore * 100}% positive`,
      negative: `Must be ≤${VALIDATION_THRESHOLDS.intent.maxNegativeScore * 100}% negative`,
      confidence: `Must be ≥${VALIDATION_THRESHOLDS.intent.minConfidence * 100}% confident`,
    },
    specificity: {
      score: `Must be ≥${VALIDATION_THRESHOLDS.specificity.minScore * 100}% specific`,
      taxonomy: VALIDATION_THRESHOLDS.specificity.requireTaxonomyMatch
        ? 'Must match predefined taxonomy'
        : 'Taxonomy match recommended but not required',
    },
  };
};
