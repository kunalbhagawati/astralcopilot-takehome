/**
 * Enhanced validation types for LLM-based outline validation
 *
 * These types support multi-stage validation:
 * 1. Intent classification (numeric scores: positiveScore, negativeScore)
 * 2. Specificity analysis (numeric score: specificityScore, boolean: matchesTaxonomy)
 * 3. Actionability checks (boolean: actionable, content type, complexity)
 *
 * Philosophy: LLM provides numeric scores (0.0-1.0), server applies thresholds
 */

import { z } from 'zod';

/**
 * Topic hierarchy structure for educational content
 * Simplified structure: topic → domains[]
 *
 * Must match predefined taxonomy in lib/config/topic-taxonomy.ts
 */
export interface TopicHierarchy {
  /** Specific learning topic (e.g., "React Hooks", "Quadratic Equations") */
  topic: string;
  /** Related domain categories (e.g., ["web-development", "javascript", "frontend"]) */
  domains: string[];
}

/**
 * Intent classification result
 * Determines if the user has positive learning intent
 * Uses numeric scores instead of string classifications
 */
export interface IntentClassification {
  /** Probability this is genuine positive educational intent (0.0-1.0) */
  positiveScore: number;
  /** Probability this has harmful/negative intent (0.0-1.0) */
  negativeScore: number;
  /** Confidence in the assessment (0.0-1.0) */
  confidence: number;
  /** Explanation for the scores */
  reasoning: string;
  /** Optional flags for potential issues */
  flags?: string[];
}

/**
 * Specificity analysis result
 * Checks if the outline is specific enough for lesson generation
 * Uses numeric score instead of string classification
 */
export interface SpecificityAnalysis {
  /** Specificity score: 1.0 = very specific, 0.0 = very vague (0.0-1.0) */
  specificityScore: number;
  /** Whether detected topic matches predefined taxonomy (boolean yes/no) */
  matchesTaxonomy: boolean;
  /** Detected topic hierarchy */
  detectedHierarchy: TopicHierarchy;
  /** Suggestions for improvement if low score or not matching taxonomy */
  suggestions?: string[];
}

/**
 * Actionability check result
 * Determines if outline is actionable for lesson generation
 */
export interface ActionabilityCheck {
  /** Is the outline actionable? */
  actionable: boolean;
  /** Detected content type */
  contentType: 'quiz' | 'lesson' | 'tutorial' | 'exercise' | 'unknown';
  /** Estimated complexity */
  estimatedComplexity: 'simple' | 'moderate' | 'complex';
  /** List of identified requirements */
  requirements: string[];
  /** Missing information if not actionable */
  missingInfo?: string[];
}

/**
 * Enhanced validation result combining all validation aspects
 */
export interface EnhancedValidationResult {
  /** Overall validation status */
  valid: boolean;
  /** Intent classification */
  intent: IntentClassification;
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
 * Structured outline ready for lesson generation
 * Result of parsing and validating an outline
 */
export interface StructuredOutline {
  /** Original text from user */
  originalText: string;
  /** Validated topic hierarchy */
  hierarchy: TopicHierarchy;
  /** Content type */
  contentType: 'quiz' | 'lesson' | 'tutorial' | 'exercise';
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
 * Zod schema for IntentClassification
 * Used for structured output validation from LLM
 * Validates numeric scores instead of string enums
 */
export const IntentClassificationSchema = z.object({
  positiveScore: z.number().min(0).max(1),
  negativeScore: z.number().min(0).max(1),
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
 * Validates numeric score instead of string enum
 */
export const SpecificityAnalysisSchema = z.object({
  specificityScore: z.number().min(0).max(1),
  matchesTaxonomy: z.boolean(),
  detectedHierarchy: TopicHierarchySchema,
  suggestions: z.array(z.string()).optional(),
});

/**
 * Zod schema for ActionabilityCheck
 */
export const ActionabilityCheckSchema = z.object({
  actionable: z.boolean(),
  contentType: z.enum(['quiz', 'lesson', 'tutorial', 'exercise', 'unknown']),
  estimatedComplexity: z.enum(['simple', 'moderate', 'complex']),
  requirements: z.array(z.string()),
  missingInfo: z.array(z.string()).optional(),
});

/**
 * Zod schema for EnhancedValidationResult
 */
export const EnhancedValidationResultSchema = z.object({
  valid: z.boolean(),
  intent: IntentClassificationSchema,
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
  contentType: z.enum(['quiz', 'lesson', 'tutorial', 'exercise']),
  requirements: z.array(z.string()),
  metadata: z.object({
    difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
    targetAudience: z.string().optional(),
    estimatedDuration: z.number().optional(),
    itemCount: z.number().optional(),
  }),
});
