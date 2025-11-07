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
 * Zod schema for LessonTSX validation (not used with raw TSX output)
 * Kept for backward compatibility
 */
export const LessonTSXSchema = z.object({
  title: z.string().min(3, 'Lesson title must be at least 3 characters'),
  tsxCode: z
    .string()
    .min(50, 'TSX code must be at least 50 characters')
    .refine((code) => code.includes('export const'), 'TSX code must include named export')
    .refine((code) => code.includes('LessonComponent'), 'TSX code must export LessonComponent'),
});

/**
 * Zod schema for TSXGenerationResult validation (not used with raw TSX output)
 * Kept for backward compatibility
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
  /** Validation errors from TypeScript or import validation */
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
 * Contains fixed TSX code as raw text.
 */
export interface TSXRegenerationResult {
  /** Fixed TSX code as a string (full Next.js page) */
  tsxCode: string;
}

/**
 * Zod schema for TSXRegenerationResult validation (not used with raw TSX output)
 * Kept for backward compatibility
 */
export const TSXRegenerationResultSchema = z.object({
  tsxCode: z
    .string()
    .min(50, 'TSX code must be at least 50 characters')
    .refine((code) => code.includes('export const'), 'TSX code must include named export')
    .refine((code) => code.includes('LessonComponent'), 'TSX code must export LessonComponent'),
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
 * Contains raw TSX code for one lesson.
 * Always uses default export: export default function LessonPage()
 */
export interface SingleLessonTSXResult {
  /** Generated TSX code as a string (full Next.js page with default export) */
  tsxCode: string;
}

/**
 * Zod schema for SingleLessonTSXResult validation (not used with raw TSX output)
 * Kept for backward compatibility
 */
export const SingleLessonTSXResultSchema = z.object({
  tsxCode: z
    .string()
    .min(50, 'TSX code must be at least 50 characters')
    .refine((code) => code.includes('export const'), 'TSX code must include named export')
    .refine((code) => code.includes('LessonComponent'), 'TSX code must export LessonComponent'),
});
