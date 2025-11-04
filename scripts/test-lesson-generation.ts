/**
 * Test script for lesson generation
 *
 * Usage:
 * 1. REPL: `bun repl` then copy/paste sections
 * 2. Direct: `bun run scripts/test-lesson-generation.ts`
 *
 * Prerequisites:
 * - Ollama running: `ollama serve`
 * - Model available: `ollama pull llama3.1`
 */

import { generateLessonContent, transformLessonGenerationError } from '../lib/services/adapters/lesson-generator-core';
import { createAIModel } from '../lib/services/adapters/llm-config';
import { LessonContentSchema } from '../lib/types/lesson-structure.types';
import type { StructuredOutline } from '../lib/types/validation.types';
import { GENERATION_SYSTEM_PROMPT, buildGenerationUserPrompt } from '../lib/prompts/generation-prompts';

/**
 * Example 1: Basic lesson generation (copy to REPL)
 */
const testBasicGeneration = async () => {
  console.log('=== Test 1: Basic Lesson Generation ===\n');

  // Create mock outline
  const outline: StructuredOutline = {
    originalText: 'I want to learn TypeScript basics including variables, types, and functions',
    hierarchy: {
      stream: 'programming',
      domain: 'web-development',
      topic: 'TypeScript',
      subtopic: 'basics',
    },
    contentType: 'lesson',
    requirements: ['Understand basic types', 'Write typed functions', 'Declare variables with types'],
    metadata: {
      targetAudience: 'Beginners with JavaScript knowledge',
      estimatedDuration: 30,
      difficulty: 'beginner',
    },
  };

  try {
    // Create model
    const model = createAIModel('llama3.1');

    // Generate lesson
    const lesson = await generateLessonContent(outline, {
      model,
      systemPrompt: GENERATION_SYSTEM_PROMPT,
      buildUserPrompt: buildGenerationUserPrompt,
      schema: LessonContentSchema,
      temperature: 0.6,
    });

    console.log('✓ Lesson generated successfully!\n');
    console.log('Metadata:', JSON.stringify(lesson.metadata, null, 2));
    console.log('\nSections:', lesson.sections.length);
    lesson.sections.forEach((section) => {
      console.log(`  - ${section.type}: ${section.title}`);
    });
  } catch (error) {
    console.error('✗ Generation failed:', error);
  }
};

/**
 * Example 2: Error transformation testing (copy to REPL)
 */
const testErrorTransformation = () => {
  console.log('\n=== Test 2: Error Transformation ===\n');

  // Test model not found error
  const modelError = new Error('model llama3.1 not found');
  const result1 = transformLessonGenerationError(modelError, 'llama3.1', 'http://localhost:11434');
  console.log('Model not found error:');
  console.log('  Type:', result1.type);
  console.log('  Message:', result1.message);

  // Test connection error
  const connectionError = new Error('ECONNREFUSED');
  const result2 = transformLessonGenerationError(connectionError, 'llama3.1', 'http://localhost:11434');
  console.log('\nConnection error:');
  console.log('  Type:', result2.type);
  console.log('  Message:', result2.message);

  // Test unknown error
  const unknownError = new Error('Something weird happened');
  const result3 = transformLessonGenerationError(unknownError, 'llama3.1', 'http://localhost:11434');
  console.log('\nUnknown error:');
  console.log('  Type:', result3.type);
  console.log('  Message:', result3.message);
};

/**
 * Example 3: Custom configuration (copy to REPL)
 */
const testCustomConfig = async () => {
  console.log('\n=== Test 3: Custom Configuration ===\n');

  const outline: StructuredOutline = {
    originalText: 'Quick test lesson',
    hierarchy: {
      stream: 'programming',
      domain: 'testing',
      topic: 'unit-testing',
    },
    contentType: 'lesson',
    requirements: ['Learn testing basics'],
    metadata: {
      targetAudience: 'Developers',
      estimatedDuration: 10,
    },
  };

  try {
    const model = createAIModel('llama3.1');

    // Try different temperatures
    console.log('Generating with temperature 0.1 (more deterministic)...');
    const lesson1 = await generateLessonContent(outline, {
      model,
      systemPrompt: GENERATION_SYSTEM_PROMPT,
      buildUserPrompt: buildGenerationUserPrompt,
      schema: LessonContentSchema,
      temperature: 0.1,
    });
    console.log('  Sections:', lesson1.sections.length);

    console.log('\nGenerating with temperature 0.9 (more creative)...');
    const lesson2 = await generateLessonContent(outline, {
      model,
      systemPrompt: GENERATION_SYSTEM_PROMPT,
      buildUserPrompt: buildGenerationUserPrompt,
      schema: LessonContentSchema,
      temperature: 0.9,
    });
    console.log('  Sections:', lesson2.sections.length);
  } catch (error) {
    console.error('✗ Generation failed:', error);
  }
};

/**
 * Run all tests
 */
const runAllTests = async () => {
  console.log('Starting lesson generation tests...\n');

  await testBasicGeneration();
  testErrorTransformation();
  await testCustomConfig();

  console.log('\n✓ All tests complete!');
};

// Run if executed directly (not in REPL)
if (import.meta.main) {
  runAllTests().catch(console.error);
}

// Export for REPL usage
export { testBasicGeneration, testErrorTransformation, testCustomConfig, runAllTests };
