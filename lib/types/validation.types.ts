/**
 * Enhanced validation types for LLM-based outline validation
 *
 * These types support multi-stage validation:
 * 1. Intent classification (positive/negative/unclear)
 * 2. Specificity analysis (stream/domain/topic hierarchy)
 * 3. Actionability checks (content type, complexity)
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
 */
export interface IntentClassification {
  /** Classification result */
  classification: 'positive' | 'negative' | 'unclear';
  /** Confidence score 0.0 to 1.0 */
  confidence: number;
  /** Explanation for the classification */
  reasoning: string;
  /** Optional flags for potential issues */
  flags?: string[];
}

/**
 * Specificity analysis result
 * Checks if the outline is specific enough for lesson generation
 */
export interface SpecificityAnalysis {
  /** Classification of specificity */
  classification: 'specific' | 'vague' | 'unclear';
  /** Whether detected topic matches predefined taxonomy */
  matchesTaxonomy: boolean;
  /** Detected topic hierarchy */
  detectedHierarchy: TopicHierarchy;
  /** Suggestions for improvement if vague or not matching taxonomy */
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
 */
export const IntentClassificationSchema = z.object({
  classification: z.enum(['positive', 'negative', 'unclear']),
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
 */
export const SpecificityAnalysisSchema = z.object({
  classification: z.enum(['specific', 'vague', 'unclear']),
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
