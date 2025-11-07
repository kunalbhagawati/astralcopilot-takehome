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
 * Text block - Standard teaching content (markdown)
 *
 * Example: "**What is photosynthesis?** Plants make their own food using sunlight, like a kitchen inside their leaves."
 */
export interface TextBlock {
  type: 'text';
  content: string;
}

/**
 * Image block - Visual content for lessons
 *
 * Can be either:
 * - SVG description (for STEM diagrams, shapes, charts) - LLM generates inline SVG
 * - Image URL (for photos, illustrations) - rendered as <img>
 */
export interface ImageBlock {
  type: 'image';
  /** Either detailed SVG description for LLM to generate, OR image URL */
  content: string;
  /** Image format: 'svg' for inline generation, 'url' for external images */
  format: 'svg' | 'url';
  /** Alt text for accessibility (required) */
  alt: string;
  /** Optional caption to display below image */
  caption?: string;
}

/**
 * Interaction block - Interactive elements for engagement
 *
 * Types:
 * - input: Text/number/range inputs for experimentation
 * - quiz: Multiple choice questions with answer validation
 * - visualization: SVG-based interactive diagrams (e.g., adjust angle to see triangle change)
 * - dragdrop: Drag and drop matching/ordering activities
 */
export interface InteractionBlock {
  type: 'interaction';
  /** Interaction subtype */
  interactionType: 'input' | 'quiz' | 'visualization' | 'dragdrop';
  /** Prompt or question text */
  prompt: string;
  /** Additional metadata for the interaction (e.g., answer, options, validation rules) */
  metadata: {
    /** For quiz: correct answer(s) */
    answer?: string | string[];
    /** For quiz: available options */
    options?: string[];
    /** For input: input type (text, number, range, etc.) */
    inputType?: string;
    /** For input: default value */
    defaultValue?: string | number;
    /** For input: min/max for number/range */
    min?: number;
    max?: number;
    /** For visualization: description of what should be visualized */
    visualizationDescription?: string;
    /** For dragdrop: items to drag, drop zones, correct matches */
    dragDropData?: {
      items: string[];
      dropZones: string[];
      correctMatches?: Record<string, string>;
    };
    /** Any other custom metadata */
    [key: string]: unknown;
  };
}

/**
 * Actionable block - Union of all block types
 *
 * Structured format supporting text, images, and interactions.
 */
export type ActionableBlock = TextBlock | ImageBlock | InteractionBlock;

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
 * Zod schemas for block types
 */
export const TextBlockSchema = z.object({
  type: z.literal('text'),
  content: z.string().min(10, 'Text content must be at least 10 characters'),
});

export const ImageBlockSchema = z.object({
  type: z.literal('image'),
  content: z.string().min(10, 'Image content/URL must be at least 10 characters'),
  format: z.enum(['svg', 'url']),
  alt: z.string().min(3, 'Alt text is required and must be at least 3 characters'),
  caption: z.string().optional(),
});

export const InteractionBlockSchema = z.object({
  type: z.literal('interaction'),
  interactionType: z.enum(['input', 'quiz', 'visualization', 'dragdrop']),
  prompt: z.string().min(5, 'Prompt must be at least 5 characters'),
  metadata: z.record(z.string(), z.unknown()),
});

/**
 * Zod schema for ActionableBlock (discriminated union)
 */
export const ActionableBlockSchema = z.discriminatedUnion('type', [
  TextBlockSchema,
  ImageBlockSchema,
  InteractionBlockSchema,
]);

/**
 * Zod schema for Lesson validation
 */
export const LessonSchema = z.object({
  title: z.string().min(3, 'Lesson title must be at least 3 characters'),
  blocks: z.array(ActionableBlockSchema).min(1, 'Each lesson must have at least 1 block'),
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
