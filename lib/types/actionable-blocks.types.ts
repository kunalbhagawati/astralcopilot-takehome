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
 * Lesson - a semantic grouping of related teaching blocks
 *
 * Represents one unit of learning that can be grasped in one "slide" or sitting.
 * Blocks within a lesson are related and build on each other progressively.
 */
export interface Lesson {
  /** Title of the lesson (describes the unit of learning) */
  title: string;
  /** Array of teaching point blocks within this lesson */
  blocks: ActionableBlock[];
}

/**
 * Result of actionable blocks generation
 *
 * Contains the generated lessons (with blocks) plus metadata about the content.
 * Blocks are now organized into semantic lessons for better structure.
 */
export interface ActionableBlocksResult {
  /** Array of lessons, each containing related teaching blocks */
  lessons: Lesson[];

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
    /** Total number of blocks across all lessons (must be ≤100) */
    totalBlockCount: number;
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
    /** Safety reasoning (optional, for context) */
    safetyReasoning?: string;
    /** Suggestions from validation (optional) */
    suggestions?: string[];
  };
}

/**
 * Zod schema for Lesson validation
 */
export const LessonSchema = z.object({
  title: z.string().min(3, 'Lesson title must be at least 3 characters'),
  blocks: z
    .array(z.string().min(10, 'Each block must be at least 10 characters'))
    .min(1, 'Each lesson must have at least 1 block'),
});

/**
 * Zod schema for ActionableBlocksResult validation
 *
 * Used by Vercel AI SDK's generateObject() for structured output validation.
 * Validates that total blocks across all lessons is ≤100.
 */
export const ActionableBlocksResultSchema = z.object({
  lessons: z.array(LessonSchema).min(1, 'Must have at least 1 lesson'),
  metadata: z.object({
    originalOutline: z.string(),
    topic: z.string(),
    domains: z.array(z.string()),
    ageRange: z.tuple([z.number(), z.number()]),
    complexity: z.enum(['simple', 'moderate', 'complex']),
    totalBlockCount: z.number().int().min(1).max(100, 'Total blocks must not exceed 100'),
  }),
});
