/**
 * Enhanced validation types for LLM-based outline validation
 *
 * These types support multi-stage validation:
 * 1. Safety classification (single gradient: safetyScore 0.0-1.0)
 * 2. Specificity analysis (numeric score: specificityScore)
 * 3. Actionability checks (boolean: actionable, age range: [min, max])
 *
 * Philosophy: LLM provides numeric scores (0.0-1.0), server applies thresholds
 */

import { z } from 'zod';

/**
 * Topic hierarchy structure for educational content
 * Simplified structure: topic → domains[]
 *
 * LLM determines topic and domains from outline content (no predefined taxonomy)
 */
export interface TopicHierarchy {
  /** Specific learning topic (e.g., "React Hooks", "Quadratic Equations") */
  topic: string;
  /** Related domain categories (e.g., ["web-development", "javascript", "frontend"]) */
  domains: string[];
}

/**
 * Safety classification result
 * Determines if the outline content is safe and appropriate for children (ages 5-16)
 * Uses single gradient score (0.0-1.0)
 *
 * Examples:
 * - 1.0 = Safe educational content (e.g., biological reproduction taught in schools)
 * - 0.0 = Unsafe/inappropriate content (e.g., pornography, violence, harmful activities)
 */
export interface SafetyClassification {
  /** Safety gradient: 0.0 = unsafe/inappropriate for children, 1.0 = safe/appropriate educational content */
  safetyScore: number;
  /** Confidence in the assessment (0.0-1.0) */
  confidence: number;
  /** Explanation for the score */
  reasoning: string;
  /** Optional flags for potential issues */
  flags?: string[];
}

/**
 * Specificity analysis result
 * Checks if the outline is specific enough for lesson generation
 *
 * Topic must be specific enough to:
 * - Generate ≤100 actionable teaching blocks
 * - Cover top-level topics comprehensively
 */
export interface SpecificityAnalysis {
  /** Specificity score: 1.0 = very specific, 0.0 = very vague (0.0-1.0) */
  specificityScore: number;
  /** Detected topic hierarchy (LLM-determined from outline content) */
  detectedHierarchy: TopicHierarchy;
  /** Suggestions for improvement if low score */
  suggestions?: string[];
}

/**
 * Actionability check result
 * Determines if outline is actionable for generating structured content blocks
 *
 * This system produces actionables (descriptions of teaching content blocks).
 * A separate downstream system will render these as actual JSX/HTML.
 * The LLM determines the best multimodal structure for teaching.
 */
export interface ActionabilityCheck {
  /** Is the outline actionable? */
  actionable: boolean;
  /** Target age range [minAge, maxAge] - must be within pedagogy range [5, 16] */
  targetAgeRange: [number, number];
  /** List of identified requirements */
  requirements: string[];
  /** Missing information if not actionable */
  missingInfo?: string[];
}

/**
 * Enhanced validation result combining all validation aspects
 *
 * Note: LLM generates scores only. Server computes validity via applyValidationThresholds().
 */
export interface EnhancedValidationResult {
  /** Safety classification */
  safety: SafetyClassification;
  /** Specificity analysis */
  specificity: SpecificityAnalysis;
  /** Actionability check */
  actionability: ActionabilityCheck;
  /** Errors if validation failed */
  errors?: string[];
  /** Suggestions for improvement */
  suggestions?: string[];
}

/**
 * Structured outline ready for actionable block generation
 * Result of parsing and validating an outline
 *
 * This structure feeds into actionable generation, which produces
 * descriptions of teaching content blocks (not rendered code).
 */
export interface StructuredOutline {
  /** Original text from user */
  originalText: string;
  /** Validated topic hierarchy */
  hierarchy: TopicHierarchy;
  /** List of requirements extracted from outline */
  requirements: string[];
  /** Additional metadata */
  metadata: {
    /** Difficulty level if specified */
    difficulty?: 'beginner' | 'intermediate' | 'advanced';
    /** Target audience if specified */
    targetAudience?: string;
    /** Estimated duration in minutes if specified */
    estimatedDuration?: number;
    /** Number of questions/items if specified */
    itemCount?: number;
  };
}

/**
 * Zod schema for SafetyClassification
 * Used for structured output validation from LLM
 * Validates single safety gradient (0.0-1.0)
 */
export const SafetyClassificationSchema = z.object({
  safetyScore: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  flags: z.array(z.string()).optional(),
});

/**
 * Zod schema for TopicHierarchy
 */
export const TopicHierarchySchema = z.object({
  topic: z.string().min(1),
  domains: z.array(z.string().min(1)).min(1),
});

/**
 * Zod schema for SpecificityAnalysis
 * Validates numeric score (topic must be specific enough for ≤100 blocks)
 */
export const SpecificityAnalysisSchema = z.object({
  specificityScore: z.number().min(0).max(1),
  detectedHierarchy: TopicHierarchySchema,
  suggestions: z.array(z.string()).optional(),
});

/**
 * Zod schema for ActionabilityCheck
 */
export const ActionabilityCheckSchema = z.object({
  actionable: z.boolean(),
  targetAgeRange: z.tuple([z.number().int().min(1).max(100), z.number().int().min(1).max(100)]),
  requirements: z.array(z.string()),
  missingInfo: z.array(z.string()).optional(),
});

/**
 * Zod schema for EnhancedValidationResult
 *
 * Note: Does not include 'valid' field - server computes validity via applyValidationThresholds().
 */
export const EnhancedValidationResultSchema = z.object({
  safety: SafetyClassificationSchema,
  specificity: SpecificityAnalysisSchema,
  actionability: ActionabilityCheckSchema,
  errors: z.array(z.string()).optional(),
  suggestions: z.array(z.string()).optional(),
});

/**
 * Zod schema for StructuredOutline
 */
export const StructuredOutlineSchema = z.object({
  originalText: z.string(),
  hierarchy: TopicHierarchySchema,
  requirements: z.array(z.string()),
  metadata: z.object({
    difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
    targetAudience: z.string().optional(),
    estimatedDuration: z.number().optional(),
    itemCount: z.number().optional(),
  }),
});

/**
 * Quality validation result for generated lesson content
 */
export interface QualityValidationResult {
  /** Is the generated content valid? */
  valid: boolean;
  /** List of validation errors */
  errors: string[];
  /** Suggestions for improvement */
  suggestions: string[];
  /** Overall quality score (0.0-1.0) */
  qualityScore: number;
}

/**
 * Zod schema for QualityValidationResult
 */
export const QualityValidationResultSchema = z.object({
  valid: z.boolean(),
  errors: z.array(z.string()),
  suggestions: z.array(z.string()),
  qualityScore: z.number().min(0).max(1),
}); // Validation result (simple valid/errors structure used by pipeline)

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}
