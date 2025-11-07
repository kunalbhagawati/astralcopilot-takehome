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
import type { ActionableBlocksResult } from './actionable-blocks.types';

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
  /** Generated TSX code as a string (React/Next.js functional component) */
  tsxCode: string;
  /** Component name extracted from export statement (e.g., "PhotosynthesisLesson") */
  componentName: string;
  /** Original blocks (for reference/debugging) */
  originalBlocks: string[];
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
    .refine((code) => code.includes('export'), 'TSX code must include an export statement')
    .refine((code) => code.includes('return') || code.includes('=>'), 'TSX code must be a valid React component'),
  componentName: z.string().min(3, 'Component name must be at least 3 characters'),
  originalBlocks: z.array(z.string()).min(1, 'Must have at least one original block'),
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
