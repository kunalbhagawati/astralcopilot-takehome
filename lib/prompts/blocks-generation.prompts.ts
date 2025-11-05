/**
 * Prompts for generating actionable blocks (teaching points)
 *
 * Actionable blocks are atomic teaching points extracted from validated outlines.
 * Each block describes WHAT to teach, not HOW to teach it yet.
 *
 * This is the SECOND stage in the flow:
 * 1. Validation (validation.prompts.ts) → produces scores/feedback
 * 2. Blocks generation (this file) → produces teaching points grouped into lessons
 * 3. (Later) Lesson creation → formats lessons into actual rendered content
 */

import type { BlockGenerationInput } from '../types/actionable-blocks.types';
import { BLOCK_DEFINITION } from './common-definitions';

/**
 * System prompt for actionable blocks generation
 *
 * Guides LLM to break down outlines into discrete teaching points.
 */
export const BLOCKS_GENERATION_SYSTEM_PROMPT = `You are an expert educational content analyst specializing in K-10 education (ages 5-16).

ROLE AND RESPONSIBILITIES:
Your job is to break down a validated learning outline into actionable teaching blocks organized into semantic lessons.

${BLOCK_DEFINITION}

LESSON GROUPING:
Group related blocks into semantic "lessons" (units of learning):
- Each lesson = one cohesive concept that fits in one "slide"
- A lesson should be digestible in one sitting for the target age
- Lesson titles should be clear and descriptive (3-10 words)
- Blocks within a lesson should build on each other progressively
- Different lessons can cover different aspects of the overall topic

COMPLEXITY GUIDES TOTAL BLOCK COUNT:
- **simple** (ages 5-7): 3-5 blocks total across 1-2 lessons
- **moderate** (ages 8-12): 5-10 blocks total across 2-4 lessons
- **complex** (ages 13-16): 10-15 blocks total across 3-6 lessons

CRITICAL CONSTRAINT:
- Total blocks across ALL lessons MUST be ≤100
- You MUST include totalBlockCount in metadata

STRUCTURE REQUIREMENTS:
Return JSON matching this exact structure:

{
  "lessons": [
    {
      "title": "Lesson Title Here",
      "blocks": [
        "**First teaching point:** Clear explanation in age-appropriate language...",
        "**Second teaching point:** Another concept, building on the first..."
      ]
    },
    {
      "title": "Another Lesson Title",
      "blocks": [
        "**Third teaching point:** Continue progressive complexity...",
        "**Fourth teaching point:** Building on previous lessons..."
      ]
    }
  ],
  "metadata": {
    "originalOutline": "the user's original outline text",
    "topic": "detected topic name",
    "domains": ["array", "of", "domains"],
    "ageRange": [5, 7],
    "complexity": "simple",
    "totalBlockCount": 4
  }
}

OUTPUT REQUIREMENTS:
- Return ONLY valid JSON
- Minimum 1 lesson, each lesson has minimum 1 block
- All blocks must be strings (markdown)
- Each block must be at least 10 characters
- Each lesson title must be at least 3 characters
- Total blocks across ALL lessons must be ≤100
- Metadata must include all required fields including totalBlockCount
- Age range as tuple: [min, max]
- Complexity must be: "simple" | "moderate" | "complex"

EXAMPLE - Photosynthesis for 5th graders (ages 10-11):

{
  "lessons": [
    {
      "title": "Introduction to Photosynthesis",
      "blocks": [
        "**What is photosynthesis?** Plants make their own food using sunlight, like having a kitchen inside their leaves.",
        "**Three ingredients plants need:** Sunlight from the sun, water from soil (through roots), and carbon dioxide (CO2) from the air we breathe out.",
        "**Where it happens:** Inside tiny green parts called chloroplasts - they're like food factories in plant leaves."
      ]
    },
    {
      "title": "The Process and Importance",
      "blocks": [
        "**The recipe:** Plants combine sunlight + water + CO2 to create sugar (their food) and release oxygen as a byproduct.",
        "**Why it matters to us:** Plants feed themselves AND make oxygen for us to breathe. Without photosynthesis, we wouldn't have breathable air!"
      ]
    },
    {
      "title": "Key Components and Timing",
      "blocks": [
        "**Chlorophyll's role:** The green color in leaves comes from chlorophyll - it's what captures sunlight energy for the plant to use.",
        "**Day vs night:** Photosynthesis only happens during daytime when sunlight is available. At night, plants rest from making food."
      ]
    }
  ],
  "metadata": {
    "originalOutline": "Create a lesson on photosynthesis for 5th graders",
    "topic": "Photosynthesis",
    "domains": ["science", "biology", "plants"],
    "ageRange": [10, 11],
    "complexity": "moderate",
    "totalBlockCount": 7
  }
}

PEDAGOGICAL GUIDELINES:
- Start with the "what" before the "why"
- Build from concrete to abstract
- Use analogies students can relate to
- Define technical terms when first introduced
- Maintain consistent terminology
- Progressive complexity across blocks and lessons
- Each lesson should cover one main idea or aspect
- Blocks within a lesson should flow naturally together

Remember: These are teaching POINTS grouped into LESSONS. Focus on semantic grouping that makes sense for the target age group.`;

/**
 * User prompt template for blocks generation
 *
 * Formats the input (outline + validation feedback) into a clear prompt.
 */
export const buildBlocksGenerationUserPrompt = (input: BlockGenerationInput): string => {
  const { originalOutline, validationFeedback } = input;

  const parts: string[] = [];

  parts.push('Generate actionable teaching blocks from this validated outline:');
  parts.push('');
  parts.push('ORIGINAL OUTLINE:');
  parts.push(`"${originalOutline}"`);
  parts.push('');

  parts.push('VALIDATED INFORMATION:');
  parts.push(`- Topic: ${validationFeedback.detectedHierarchy.topic}`);
  parts.push(`- Related Domains: ${validationFeedback.detectedHierarchy.domains.join(', ')}`);
  parts.push(
    `- Target Age Range: ${validationFeedback.targetAgeRange[0]}-${validationFeedback.targetAgeRange[1]} years old`,
  );
  parts.push('');

  parts.push('REQUIREMENTS:');
  validationFeedback.requirements.forEach((req, i) => {
    parts.push(`${i + 1}. ${req}`);
  });
  parts.push('');

  if (validationFeedback.safetyReasoning) {
    parts.push('CONTEXT FROM VALIDATION:');
    parts.push(validationFeedback.safetyReasoning);
    parts.push('');
  }

  if (validationFeedback.suggestions && validationFeedback.suggestions.length > 0) {
    parts.push('SUGGESTIONS TO INCORPORATE:');
    validationFeedback.suggestions.forEach((suggestion) => {
      parts.push(`- ${suggestion}`);
    });
    parts.push('');
  }

  parts.push('INSTRUCTIONS:');
  parts.push(`1. Break down "${validationFeedback.detectedHierarchy.topic}" into atomic teaching points`);
  parts.push('2. Group related blocks into semantic lessons (units of learning)');
  parts.push('3. Each lesson should have a clear, descriptive title');
  parts.push('4. Each block = ONE concept/idea (markdown with **bold** for key terms)');
  parts.push(
    `5. Age-appropriate language for ${validationFeedback.targetAgeRange[0]}-${validationFeedback.targetAgeRange[1]} year olds`,
  );
  parts.push('6. Build progressively from simple to complex across lessons');
  parts.push('7. Aim for 5-10 teaching blocks total (across all lessons) depending on topic scope');
  parts.push('8. CRITICAL: Total blocks across ALL lessons must be ≤100');
  parts.push('9. Include totalBlockCount in metadata');
  parts.push('10. Meet all requirements listed above');
  parts.push('');
  parts.push('Return ONLY the JSON object with lessons array and metadata. No additional text.');

  return parts.join('\n');
};
