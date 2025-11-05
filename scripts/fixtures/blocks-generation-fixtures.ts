/**
 * Blocks Generation Test Fixtures
 *
 * Generated from validation output to ensure consistent test data.
 * These fixtures include complete BlockGenerationInput objects ready for testing.
 *
 * Note: LLM-generated complexity and lesson grouping may not always match expectations
 * due to model interpretation. Tests validate total block count, not specific lesson structure.
 */

import type { BlockGenerationInput } from '../../lib/types/actionable-blocks.types';

/**
 * Test fixture for blocks generation
 */
export interface BlockGenerationFixture {
  name: string;
  input: BlockGenerationInput;
  expectedMetadata: {
    targetAgeRange: [number, number];
    minBlockCount: number;
    maxBlockCount: number;
    topic: string;
    domains: string[];
  };
}

/**
 * Test fixtures covering K-10 education topics
 * - Simple (ages 5-7): 3-5 blocks expected
 * - Moderate (ages 8-12): 5-10 blocks expected
 * - Complex (ages 13-16): 10-15 blocks expected
 */
export const BLOCKS_GENERATION_FIXTURES: BlockGenerationFixture[] = [
  {
    name: 'Simple - Colors for Kindergarten',
    input: {
      originalOutline: 'Teach the primary colors (red, blue, yellow) to kindergarten students',
      validationFeedback: {
        detectedHierarchy: {
          topic: 'Primary Colors',
          domains: ['Art', 'Design', 'Kindergarten'],
        },
        requirements: ['teach primary colors to kindergarten students'],
        targetAgeRange: [5, 6],
        safetyReasoning:
          'The request is clearly safe and educational, focusing on teaching kindergarten students a fundamental concept in art and design.',
        suggestions: [],
      },
    },
    expectedMetadata: {
      targetAgeRange: [5, 6],
      minBlockCount: 3,
      maxBlockCount: 5,
      topic: 'Primary Colors',
      domains: ['art', 'colors'],
    },
  },
  {
    name: 'Simple - Counting to 10',
    input: {
      originalOutline: 'Create a lesson on counting from 1 to 10 for first graders',
      validationFeedback: {
        detectedHierarchy: {
          topic: 'Counting',
          domains: ['math', 'arithmetic'],
        },
        requirements: ['Create a lesson on counting from 1 to 10'],
        targetAgeRange: [6, 7],
        safetyReasoning:
          'The request is clear, specific, and safe - teaching counting to first graders is age-appropriate educational content.',
        suggestions: [],
      },
    },
    expectedMetadata: {
      targetAgeRange: [6, 7],
      minBlockCount: 3,
      maxBlockCount: 5,
      topic: 'Counting',
      domains: ['math', 'arithmetic'],
    },
  },
  {
    name: 'Moderate - Photosynthesis Quiz',
    input: {
      originalOutline: 'Create a 5-question quiz on photosynthesis for 5th graders',
      validationFeedback: {
        detectedHierarchy: {
          topic: 'Photosynthesis',
          domains: ['science', 'biology'],
        },
        requirements: ['create a quiz with 5 questions', 'target audience is 5th graders'],
        targetAgeRange: [10, 11],
        safetyReasoning:
          'Clear educational purpose, safe and appropriate topic for K-10 students, target audience is specific.',
        suggestions: [],
      },
    },
    expectedMetadata: {
      targetAgeRange: [10, 11],
      minBlockCount: 5,
      maxBlockCount: 10,
      topic: 'Photosynthesis',
      domains: ['science', 'biology'],
    },
  },
  {
    name: 'Moderate - Fractions Lesson',
    input: {
      originalOutline: 'Teach adding fractions with like denominators to 4th graders',
      validationFeedback: {
        detectedHierarchy: {
          topic: 'Addition with Like Denominators',
          domains: ['math', 'arithmetic', 'fractions'],
        },
        requirements: [
          'Create a lesson on adding fractions with like denominators for 4th graders',
          'Include examples and exercises',
        ],
        targetAgeRange: [9, 10],
        safetyReasoning:
          'The request is safe and appropriate - teaching adding fractions with like denominators to 4th graders is age-appropriate math education.',
        suggestions: ['Consider including visual aids to help students understand the concept of equivalent ratios.'],
      },
    },
    expectedMetadata: {
      targetAgeRange: [9, 10],
      minBlockCount: 5,
      maxBlockCount: 10,
      topic: 'Fractions',
      domains: ['math', 'arithmetic'],
    },
  },
  {
    name: 'Complex - Algebraic Equations',
    input: {
      originalOutline: 'Explain solving linear equations with variables on both sides for 8th graders',
      validationFeedback: {
        detectedHierarchy: {
          topic: 'Solving Linear Equations with Variables on Both Sides',
          domains: ['math', 'algebra'],
        },
        requirements: ['Explain solving linear equations with variables on both sides'],
        targetAgeRange: [13, 14],
        safetyReasoning: 'Clear educational purpose, safe and suitable topic for 8th graders.',
        suggestions: [],
      },
    },
    expectedMetadata: {
      targetAgeRange: [13, 14],
      minBlockCount: 10,
      maxBlockCount: 15,
      topic: 'Linear Equations',
      domains: ['math', 'algebra'],
    },
  },
  {
    name: 'Complex - Cell Structure',
    input: {
      originalOutline:
        'Create a comprehensive lesson on eukaryotic cell structure and organelle functions for 9th graders',
      validationFeedback: {
        detectedHierarchy: {
          topic: 'Eukaryotic Cell Structure',
          domains: ['science', 'biology', 'cells'],
        },
        requirements: ['Comprehensive lesson on eukaryotic cell structure', 'Organelle functions for 9th graders'],
        targetAgeRange: [14, 15],
        safetyReasoning: 'Clear educational purpose with safe, age-appropriate biology content for 9th graders.',
        suggestions: [
          'Consider breaking down the topic into smaller modules, such as nucleus, mitochondria, and chloroplasts, to enhance student understanding.',
        ],
      },
    },
    expectedMetadata: {
      targetAgeRange: [14, 15],
      minBlockCount: 10,
      maxBlockCount: 15,
      topic: 'Cell Structure',
      domains: ['science', 'biology'],
    },
  },
];
