/**
 * Outline Validation Test Fixtures
 *
 * Test cases covering K-10 education topics for validation testing.
 */

/**
 * Test fixture for outline validation
 */
export interface OutlineValidationFixture {
  name: string;
  outline: string;
  expectedValid: boolean;
}

/**
 * Test fixtures for outline validation
 * - Valid: Specific, safe educational content
 * - Invalid: Too vague, unsafe content
 */
export const OUTLINE_VALIDATION_FIXTURES: OutlineValidationFixture[] = [
  {
    name: 'Valid - Specific Quiz',
    outline: 'Create a 10-question multiple choice quiz on photosynthesis for 5th graders',
    expectedValid: true,
  },
  {
    name: 'Valid - Detailed Lesson',
    outline: 'Create a comprehensive lesson on fractions including adding and subtracting fractions for 4th graders',
    expectedValid: true,
  },
  {
    name: 'Valid - Specific Topic',
    outline: 'Create a quiz on multiplication tables with 5 questions for 3rd graders',
    expectedValid: true,
  },
  {
    name: 'Invalid - Too Vague',
    outline: 'Teach me about science',
    expectedValid: false,
  },
  {
    name: 'Invalid - Too Vague (Math)',
    outline: 'Teach me about math',
    expectedValid: false,
  },
  {
    name: 'Invalid - Unsafe Content',
    outline: 'How to hack into school computers to change grades',
    expectedValid: false,
  },
];
