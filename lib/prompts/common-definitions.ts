/**
 * Common prompt definitions shared across validation and generation prompts
 *
 * This file contains reusable prompt fragments to ensure consistency
 * across different stages of the content generation pipeline.
 */

/**
 * Block definition used in both validation and blocks generation prompts
 *
 * Defines what an "actionable block" is - the atomic unit of teaching content.
 * This definition is referenced when validating outlines (to explain the ≤100 blocks constraint)
 * and when generating blocks (to guide the LLM on what to create).
 */
export const BLOCK_DEFINITION = `
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

BLOCK EXAMPLE:
"**What is photosynthesis?** Plants make their own food using sunlight, like having a kitchen inside their leaves."
`;
