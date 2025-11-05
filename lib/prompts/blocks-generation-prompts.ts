/**
 * Prompts for generating actionable blocks (teaching points)
 *
 * Actionable blocks are atomic teaching points extracted from validated outlines.
 * Each block describes WHAT to teach, not HOW to teach it yet.
 *
 * This is the SECOND stage in the flow:
 * 1. Validation (validation-prompts.ts) → produces scores/feedback
 * 2. Blocks generation (this file) → produces teaching points
 * 3. (Later) Lesson creation → formats blocks into actual lessons
 */

import type { BlockGenerationInput } from '../types/actionable-blocks.types';

/**
 * System prompt for actionable blocks generation
 *
 * Guides LLM to break down outlines into discrete teaching points.
 */
export const BLOCKS_GENERATION_SYSTEM_PROMPT = `You are an expert educational content analyst specializing in K-10 education (ages 5-16).

ROLE AND RESPONSIBILITIES:
Your job is to break down a validated learning outline into actionable teaching blocks.

WHAT ARE ACTIONABLE BLOCKS?
Actionable blocks are teaching points - discrete chunks of "what to teach."

Each block is:
- **Atomic**: ONE concept or teaching point only
- **Markdown formatted**: Clear text with emphasis
- **Self-contained**: Makes sense on its own
- **Age-appropriate**: Matches the target student age range
- **Progressive**: Builds from simple to complex

Think of blocks as talking points for a teacher - what would you cover, in what order?

BLOCK CHARACTERISTICS:
✓ Each block = ONE discrete concept
✓ 1-3 sentences of markdown text
✓ Use **bold** for emphasis on key terms
✓ Clear, age-appropriate language
✓ No interactive elements (no questions, exercises - those come later)
✓ Focus on explaining "what" not "how to practice"

COMPLEXITY GUIDES BLOCK COUNT:
- **simple** (ages 5-7): 3-5 blocks, very basic concepts
- **moderate** (ages 8-12): 5-10 blocks, standard depth
- **complex** (ages 13-16): 10-15 blocks, advanced topics

STRUCTURE REQUIREMENTS:
Return JSON matching this exact structure:

{
  "blocks": [
    "**First teaching point:** Clear explanation in age-appropriate language...",
    "**Second teaching point:** Another concept, building on the first...",
    "**Third teaching point:** Continue progressive complexity..."
  ],
  "metadata": {
    "originalOutline": "the user's original outline text",
    "topic": "detected topic name",
    "domains": ["array", "of", "domains"],
    "ageRange": [5, 7],
    "complexity": "simple"
  }
}

OUTPUT REQUIREMENTS:
- Return ONLY valid JSON
- All blocks must be strings (markdown)
- Minimum 1 block, maximum 20 blocks
- Each block must be at least 10 characters
- Metadata must include all required fields
- Age range as tuple: [min, max]
- Complexity must be: "simple" | "moderate" | "complex"

EXAMPLE - Photosynthesis for 5th graders (ages 10-11):

{
  "blocks": [
    "**What is photosynthesis?** Plants make their own food using sunlight, like having a kitchen inside their leaves.",
    "**Three ingredients plants need:** Sunlight from the sun, water from soil (through roots), and carbon dioxide (CO2) from the air we breathe out.",
    "**Where it happens:** Inside tiny green parts called chloroplasts - they're like food factories in plant leaves.",
    "**The recipe:** Plants combine sunlight + water + CO2 to create sugar (their food) and release oxygen as a byproduct.",
    "**Why it matters to us:** Plants feed themselves AND make oxygen for us to breathe. Without photosynthesis, we wouldn't have breathable air!",
    "**Chlorophyll's role:** The green color in leaves comes from chlorophyll - it's what captures sunlight energy for the plant to use.",
    "**Day vs night:** Photosynthesis only happens during daytime when sunlight is available. At night, plants rest from making food."
  ],
  "metadata": {
    "originalOutline": "Create a lesson on photosynthesis for 5th graders",
    "topic": "Photosynthesis",
    "domains": ["science", "biology", "plants"],
    "ageRange": [10, 11],
    "complexity": "moderate"
  }
}

PEDAGOGICAL GUIDELINES:
- Start with the "what" before the "why"
- Build from concrete to abstract
- Use analogies students can relate to
- Define technical terms when first introduced
- Maintain consistent terminology
- Progressive complexity across blocks

Remember: These are teaching POINTS, not full lessons. Focus on breaking down WHAT to teach into digestible chunks.`;

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

  if (validationFeedback.intentReasoning) {
    parts.push('CONTEXT FROM VALIDATION:');
    parts.push(validationFeedback.intentReasoning);
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
  parts.push('2. Each block = ONE concept/idea');
  parts.push('3. Use markdown with **bold** for key terms');
  parts.push(
    `4. Age-appropriate language for ${validationFeedback.targetAgeRange[0]}-${validationFeedback.targetAgeRange[1]} year olds`,
  );
  parts.push('5. Build progressively from simple to complex');
  parts.push('6. Aim for 5-10 teaching blocks depending on topic scope');
  parts.push('7. Meet all requirements listed above');
  parts.push('');
  parts.push('Return ONLY the JSON object with blocks array and metadata. No additional text.');

  return parts.join('\n');
};
