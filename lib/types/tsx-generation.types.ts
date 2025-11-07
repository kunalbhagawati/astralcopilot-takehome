/**
 * Types and schemas for TSX generation from actionable blocks
 *
 * This is Stage 3 of the LLM flow:
 * 1. Validation → produces scores/feedback
 * 2. Blocks generation → produces teaching points
 * 3. TSX generation (this file) → produces React/Next.js TSX code
 *
 * Converts markdown teaching blocks into renderable TSX components.
 */

import { z } from 'zod';
import type { ActionableBlocksResult, ActionableBlock } from './actionable-blocks.types';
import type { TSXValidationError } from './validation.types';

/**
 * Input for TSX generation
 * Takes the output from blocks generation and converts to TSX
 */
export interface TSXGenerationInput {
  /** The blocks result from Stage 2 (blocks generation) */
  blocksResult: ActionableBlocksResult;
}

/**
 * A single lesson with generated TSX code
 */
export interface LessonTSX {
  /** Original lesson title */
  title: string;
  /** Generated TSX code as a string (full Next.js page with default export) */
  tsxCode: string;
  /** Original blocks (for reference/debugging) */
  originalBlocks: Array<{ type: string; content?: string; prompt?: string }>;
  /** Imports used in this lesson's TSX code (for Phase 2 module loading) */
  imports?: string[];
}

/**
 * Result of TSX generation
 * Contains TSX code for each lesson
 */
export interface TSXGenerationResult {
  /** Array of lessons with their TSX code */
  lessons: LessonTSX[];
  /** Metadata about the generation */
  metadata: {
    /** Total number of lessons processed */
    lessonCount: number;
    /** Model used for generation */
    model: string;
    /** Generation timestamp */
    generatedAt: string;
  };
}

/**
 * Zod schema for LessonTSX validation
 */
export const LessonTSXSchema = z.object({
  title: z.string().min(3, 'Lesson title must be at least 3 characters'),
  tsxCode: z
    .string()
    .min(50, 'TSX code must be at least 50 characters')
    .refine((code) => code.includes('export default'), 'TSX code must include default export')
    .refine((code) => code.includes('function LessonPage'), 'TSX code must export LessonPage function'),
  originalBlocks: z
    .array(
      z.object({
        type: z.string(),
        content: z.string().optional(),
        prompt: z.string().optional(),
      }),
    )
    .min(1, 'Must have at least one original block'),
  imports: z.array(z.string()).optional(),
});

/**
 * Zod schema for TSXGenerationResult validation
 */
export const TSXGenerationResultSchema = z.object({
  lessons: z.array(LessonTSXSchema).min(1, 'Must have at least one lesson'),
  metadata: z.object({
    lessonCount: z.number().int().positive('Lesson count must be positive'),
    model: z.string().min(1, 'Model name is required'),
    generatedAt: z.string().min(1, 'Generation timestamp is required'),
  }),
});

/**
 * Input for TSX regeneration (fixing validation errors)
 *
 * Used when initial TSX generation fails validation.
 * The LLM analyzes errors and generates fixed code.
 */
export interface TSXRegenerationInput {
  /** Original TSX code that failed validation */
  originalCode: string;
  /** Validation errors from TypeScript, ESLint, or import validation */
  validationErrors: TSXValidationError[];
  /** Lesson title for context */
  lessonTitle: string;
  /** Original blocks to maintain content fidelity */
  blocks: ActionableBlock[];
  /** Current attempt number (for tracking retries) */
  attemptNumber: number;
}

/**
 * Result of TSX regeneration
 *
 * Contains fixed TSX code and list of fixes applied.
 */
export interface TSXRegenerationResult {
  /** Fixed TSX code as a string (full Next.js page) */
  tsxCode: string;
  /** Brief descriptions of fixes applied */
  fixedErrors: string[];
  /** Attempt number (should match input) */
  attemptNumber: number;
}

/**
 * Zod schema for TSXRegenerationResult validation
 */
export const TSXRegenerationResultSchema = z.object({
  tsxCode: z
    .string()
    .min(50, 'TSX code must be at least 50 characters')
    .refine((code) => code.includes('export default'), 'TSX code must include default export')
    .refine((code) => code.includes('function LessonPage'), 'TSX code must export LessonPage function'),
  fixedErrors: z.array(z.string()), // Allow empty array to prevent schema validation failures
  attemptNumber: z.number().int().positive('Attempt number must be positive'),
});

/**
 * Input for single-lesson TSX generation
 *
 * Used to generate TSX for one lesson at a time (sequential generation).
 * Enables better parallelization and error isolation compared to batch generation.
 */
export interface SingleLessonTSXInput {
  /** Lesson title */
  title: string;
  /** Blocks for this lesson */
  blocks: ActionableBlock[];
  /** Context metadata (topic, age range, complexity, domains) */
  context: {
    topic: string;
    ageRange: [number, number];
    complexity: string;
    domains: string[];
  };
}

/**
 * Result of single-lesson TSX generation
 *
 * Contains TSX code for one lesson.
 * Always uses default export: export default function LessonPage()
 */
export interface SingleLessonTSXResult {
  /** Lesson title */
  title: string;
  /** Generated TSX code as a string (full Next.js page with default export) */
  tsxCode: string;
  /** Original blocks for reference */
  originalBlocks: Array<{ type: string; content?: string; prompt?: string }>;
  /** Imports used in this lesson's TSX code */
  imports?: string[];
}

/**
 * Zod schema for SingleLessonTSXResult validation
 */
export const SingleLessonTSXResultSchema = z.object({
  title: z.string().min(3, 'Lesson title must be at least 3 characters'),
  tsxCode: z
    .string()
    .min(50, 'TSX code must be at least 50 characters')
    .refine((code) => code.includes('export default'), 'TSX code must include default export')
    .refine((code) => code.includes('function LessonPage'), 'TSX code must export LessonPage function'),
  originalBlocks: z
    .array(
      z.object({
        type: z.string(),
        content: z.string().optional(),
        prompt: z.string().optional(),
      }),
    )
    .min(1, 'Must have at least one original block'),
  imports: z.array(z.string()).optional(),
});
