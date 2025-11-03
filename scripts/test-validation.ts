/**
 * Test script for validating Ollama LLM integration
 *
 * This script tests the validation pipeline with sample outlines
 * Run with: bun run scripts/test-validation.ts
 */

import { createOllamaClient } from '../lib/services/adapters/ollama-client';

const testOutlines = [
  {
    name: 'Valid - Specific Quiz',
    outline: 'Create a 10-question multiple choice quiz on photosynthesis for 5th graders',
    expectedValid: true,
  },
  {
    name: 'Invalid - Too Vague',
    outline: 'Teach me about math',
    expectedValid: false,
  },
  {
    name: 'Invalid - Negative Intent',
    outline: 'How to hack into school computers',
    expectedValid: false,
  },
  {
    name: 'Valid - Complex Lesson',
    outline:
      'Create a comprehensive lesson on React hooks including useState, useEffect, and useContext with examples and exercises for intermediate developers',
    expectedValid: true,
  },
  {
    name: 'Valid - Specific Topic',
    outline: 'Create a quiz on quadratic equations with 5 questions',
    expectedValid: true,
  },
];

/**
 * Run validation tests
 */
const runTests = async (): Promise<void> => {
  console.log('🚀 Starting Ollama LLM Validation Tests\n');
  console.log('='.repeat(80));

  const ollamaClient = createOllamaClient();

  // Check Ollama health first
  console.log('\n📡 Checking Ollama connection...');
  const health = await ollamaClient.checkHealth();

  if (!health.available) {
    console.error('❌ Ollama is not available. Please ensure Ollama is running.');
    console.error('   Run: ollama serve');
    process.exit(1);
  }

  console.log('✅ Ollama is available');
  console.log(`📦 Available models: ${health.models.join(', ')}`);

  // Ensure required models are available
  console.log('\n📦 Ensuring required models are available...');
  try {
    await ollamaClient.ensureModel('llama3.1');
    console.log('✅ llama3.1 model is ready');
  } catch (error) {
    console.error('❌ Failed to ensure model availability:', error);
    process.exit(1);
  }

  console.log('\n' + '='.repeat(80));
  console.log('🧪 Running validation tests...\n');

  let passed = 0;
  let failed = 0;

  for (const test of testOutlines) {
    console.log(`\n📝 Test: ${test.name}`);
    console.log(`   Outline: "${test.outline}"`);
    console.log(`   Expected: ${test.expectedValid ? 'VALID' : 'INVALID'}`);

    try {
      const result = await ollamaClient.validateOutline(test.outline);

      console.log(`   Result: ${result.valid ? 'VALID' : 'INVALID'}`);
      console.log(`   Intent: ${result.intent.classification} (confidence: ${result.intent.confidence.toFixed(2)})`);
      console.log(`   Specificity: ${result.specificity.classification} (level: ${result.specificity.level})`);
      console.log(
        `   Actionability: ${result.actionability.actionable ? 'Yes' : 'No'} (type: ${result.actionability.contentType})`,
      );

      if (result.valid !== test.expectedValid) {
        console.log(
          `   ❌ FAILED: Expected ${test.expectedValid ? 'valid' : 'invalid'} but got ${result.valid ? 'valid' : 'invalid'}`,
        );
        failed++;
      } else {
        console.log(`   ✅ PASSED`);
        passed++;
      }

      if (!result.valid && result.errors) {
        console.log(`   Errors: ${result.errors.join(', ')}`);
      }

      if (result.suggestions && result.suggestions.length > 0) {
        console.log(`   Suggestions: ${result.suggestions.join(', ')}`);
      }
    } catch (error) {
      console.error(`   ❌ ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`);
      failed++;
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed out of ${testOutlines.length} tests`);

  if (failed > 0) {
    console.log('\n⚠️  Some tests failed. This may be due to:');
    console.log('   - LLM variability (different runs may produce different results)');
    console.log('   - Model differences (different models may classify differently)');
    console.log('   - Prompt engineering needs refinement');
  } else {
    console.log('\n🎉 All tests passed!');
  }

  console.log('\n' + '='.repeat(80));
};

/**
 * Run a single outline structuring test
 */
const testStructuring = async (): Promise<void> => {
  console.log('\n\n🔧 Testing outline structuring...\n');
  console.log('='.repeat(80));

  const ollamaClient = createOllamaClient();
  const testOutline = 'Create a 10-question quiz on photosynthesis for 5th graders';

  console.log(`Outline: "${testOutline}"\n`);

  try {
    const structured = await ollamaClient.structureOutline(testOutline);

    console.log('✅ Structured outline:');
    console.log(JSON.stringify(structured, null, 2));
  } catch (error) {
    console.error('❌ Structuring failed:', error);
  }

  console.log('\n' + '='.repeat(80));
};

/**
 * Main execution
 */
const main = async (): Promise<void> => {
  try {
    await runTests();
    await testStructuring();
  } catch (error) {
    console.error('\n❌ Test execution failed:', error);
    process.exit(1);
  }
};

// Export for direct execution
export { main };

// Run if executed directly (Bun-specific)
// @ts-expect-error - import.meta.main is Bun-specific
if (typeof import.meta.main !== 'undefined' && import.meta.main) {
  main().catch(console.error);
}
