/**
 * Actionable Blocks Types
 *
 * Actionable blocks are teaching points extracted from validated outlines.
 * Each block is a markdown string describing ONE atomic teaching concept.
 *
 * Flow: Validation → Blocks Generation → (Later: Lesson Creation)
 *
 * Blocks are generated AFTER outline validation, BEFORE lesson creation.
 * They represent "WHAT to teach" broken down into digestible teaching points.
 */

import { z } from 'zod';

/**
 * Single actionable block - markdown string describing one teaching point
 *
 * Example: "**What is photosynthesis?** Plants make their own food using sunlight, like a kitchen inside their leaves."
 */
export type ActionableBlock = string;

/**
 * Result of actionable blocks generation
 *
 * Contains the generated teaching point blocks plus metadata about the content.
 */
export interface ActionableBlocksResult {
  /** Array of teaching point blocks (markdown strings) */
  blocks: ActionableBlock[];

  /** Metadata about the generated blocks */
  metadata: {
    /** Original user outline that was validated */
    originalOutline: string;
    /** Detected topic from validation stage */
    topic: string;
    /** Related domain categories */
    domains: string[];
    /** Target age range for content [min, max] */
    ageRange: [number, number];
    /** Estimated complexity level */
    complexity: 'simple' | 'moderate' | 'complex';
  };
}

/**
 * Input for blocks generation
 *
 * Created from validation output + original outline.
 */
export interface BlockGenerationInput {
  /** Original outline text from user */
  originalOutline: string;

  /** Validation feedback (non-redundant data from validation stage) */
  validationFeedback: {
    /** Detected topic hierarchy from validation */
    detectedHierarchy: {
      topic: string;
      domains: string[];
    };
    /** Extracted requirements */
    requirements: string[];
    /** Target age range from validation [min, max] */
    targetAgeRange: [number, number];
    /** Intent reasoning (optional, for context) */
    intentReasoning?: string;
    /** Suggestions from validation (optional) */
    suggestions?: string[];
  };
}

/**
 * Zod schema for ActionableBlocksResult validation
 *
 * Used by Vercel AI SDK's generateObject() for structured output validation.
 */
export const ActionableBlocksResultSchema = z.object({
  blocks: z.array(z.string().min(10)).min(1), // At least 1 block, min 10 chars each
  metadata: z.object({
    originalOutline: z.string(),
    topic: z.string(),
    domains: z.array(z.string()),
    ageRange: z.tuple([z.number(), z.number()]),
    complexity: z.enum(['simple', 'moderate', 'complex']),
  }),
});
