/**
 * Test script for outline validation (K-10 Education)
 *
 * Tests score-based validation with schema enforcement
 * Run with: bun run scripts/test-outline-validation.ts
 *
 * Prerequisites:
 * - Ollama running: `ollama serve`
 * - Model available: `ollama pull llama3.1`
 */

import { createLLMClient } from '../lib/services/adapters/llm-client';
import { createOllamaHealthCheck } from '../lib/utils/ollama-health-check';
import { EnhancedValidationResultSchema } from '../lib/types/validation.types';
import { VALIDATION_THRESHOLDS } from '../lib/config/validation-thresholds';

const testOutlines = [
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
    name: 'Invalid - Harmful Intent',
    outline: 'How to hack into school computers to change grades',
    expectedValid: false,
  },
];

/**
 * Format score as percentage with pass/fail indicator
 */
const formatScore = (score: number, threshold: number, higherIsBetter: boolean): string => {
  const percentage = (score * 100).toFixed(0);
  const thresholdPct = (threshold * 100).toFixed(0);
  const passes = higherIsBetter ? score >= threshold : score <= threshold;
  const indicator = passes ? '✓' : '✗';
  const comparison = higherIsBetter ? `≥${thresholdPct}` : `≤${thresholdPct}`;
  return `${percentage}% ${indicator} (${comparison} required)`;
};

/**
 * Run validation tests
 */
const runTests = async (): Promise<void> => {
  console.log('🚀 Starting Outline Validation Tests (K-10 Education)\n');
  console.log('='.repeat(80));

  // Check Ollama health and model availability
  const healthCheck = createOllamaHealthCheck();

  console.log('\n📡 Checking Ollama connection...');
  const health = await healthCheck.checkHealth();

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
    await healthCheck.ensureModel('llama3.1');
    console.log('✅ llama3.1 model is ready');
  } catch (error) {
    console.error('❌ Failed to ensure model availability:', error);
    process.exit(1);
  }

  // Create LLM client for tests
  const client = createLLMClient();

  console.log('\n' + '='.repeat(80));
  console.log('🧪 Running validation tests...\n');
  console.log(
    `📏 Thresholds: Intent ≥${(VALIDATION_THRESHOLDS.intent.minPositiveScore * 100).toFixed(0)}% positive, ≤${(VALIDATION_THRESHOLDS.intent.maxNegativeScore * 100).toFixed(0)}% negative | Specificity ≥${(VALIDATION_THRESHOLDS.specificity.minScore * 100).toFixed(0)}%\n`,
  );

  let passed = 0;
  let failed = 0;
  let schemaErrors = 0;

  for (const test of testOutlines) {
    console.log(`\n${'─'.repeat(80)}`);
    console.log(`📝 Test: ${test.name}`);
    console.log(`   Outline: "${test.outline}"`);
    console.log(`   Expected: ${test.expectedValid ? 'VALID ✓' : 'INVALID ✗'}`);
    console.log();

    try {
      const result = await client.validateOutline(test.outline);

      // Validate against schema
      try {
        EnhancedValidationResultSchema.parse(result);
        console.log('   ✅ Schema validation: PASSED');
      } catch (schemaError) {
        console.error('   ❌ Schema validation: FAILED');
        console.error(`      ${schemaError instanceof Error ? schemaError.message : 'Unknown schema error'}`);
        schemaErrors++;
      }

      console.log();
      console.log(`   📊 Result: ${result.valid ? 'VALID ✓' : 'INVALID ✗'}`);
      console.log();

      // Intent scores
      console.log('   🎯 Intent Analysis:');
      console.log(
        `      Positive:   ${formatScore(result.intent.positiveScore, VALIDATION_THRESHOLDS.intent.minPositiveScore, true)}`,
      );
      console.log(
        `      Negative:   ${formatScore(result.intent.negativeScore, VALIDATION_THRESHOLDS.intent.maxNegativeScore, false)}`,
      );
      console.log(
        `      Confidence: ${formatScore(result.intent.confidence, VALIDATION_THRESHOLDS.intent.minConfidence, true)}`,
      );
      console.log(`      Reasoning:  "${result.intent.reasoning}"`);
      if (result.intent.flags && result.intent.flags.length > 0) {
        console.log(`      Flags:      ${result.intent.flags.join(', ')}`);
      }

      console.log();

      // Specificity scores
      console.log('   🔍 Specificity Analysis:');
      console.log(
        `      Score:      ${formatScore(result.specificity.specificityScore, VALIDATION_THRESHOLDS.specificity.minScore, true)}`,
      );
      console.log(`      Taxonomy:   ${result.specificity.matchesTaxonomy ? '✓ Matches' : '✗ No match'}`);
      console.log(
        `      Topic:      "${result.specificity.detectedHierarchy.topic}" (${result.specificity.detectedHierarchy.domains.join(', ')})`,
      );
      if (result.specificity.suggestions && result.specificity.suggestions.length > 0) {
        console.log(`      Suggestions: ${result.specificity.suggestions.join('; ')}`);
      }

      console.log();

      // Actionability
      console.log('   ⚙️  Actionability:');
      console.log(`      Status:     ${result.actionability.actionable ? '✓ Actionable' : '✗ Not actionable'}`);
      console.log(`      Complexity: ${result.actionability.estimatedComplexity}`);
      if (result.actionability.requirements.length > 0) {
        console.log(`      Requirements: ${result.actionability.requirements.join(', ')}`);
      }
      if (result.actionability.missingInfo && result.actionability.missingInfo.length > 0) {
        console.log(`      Missing:    ${result.actionability.missingInfo.join(', ')}`);
      }

      console.log();

      // Test result
      if (result.valid !== test.expectedValid) {
        console.log(
          `   ❌ TEST FAILED: Expected ${test.expectedValid ? 'VALID' : 'INVALID'} but got ${result.valid ? 'VALID' : 'INVALID'}`,
        );
        failed++;
      } else {
        console.log(`   ✅ TEST PASSED`);
        passed++;
      }

      // Errors
      if (!result.valid && result.errors && result.errors.length > 0) {
        console.log();
        console.log('   ⚠️  Validation Errors:');
        result.errors.forEach((err) => console.log(`      - ${err}`));
      }

      // Suggestions
      if (result.suggestions && result.suggestions.length > 0) {
        console.log();
        console.log('   💡 Suggestions:');
        result.suggestions.forEach((sug) => console.log(`      - ${sug}`));
      }
    } catch (error) {
      console.error(`   ❌ ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`);
      failed++;
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed out of ${testOutlines.length} tests`);

  if (schemaErrors > 0) {
    console.log(`⚠️  Schema validation failures: ${schemaErrors}`);
  }

  if (failed > 0) {
    console.log('\n⚠️  Some tests failed. This may be due to:');
    console.log('   - LLM variability (different runs may produce different results)');
    console.log('   - Model differences (different models may classify differently)');
    console.log('   - Prompt engineering needs refinement');
  } else if (schemaErrors === 0) {
    console.log('\n🎉 All tests passed with valid schema!');
  } else {
    console.log('\n⚠️  All tests passed but some schema validation errors occurred');
  }

  console.log('\n' + '='.repeat(80));
};

/**
 * Run a single outline structuring test
 */
const testStructuring = async (): Promise<void> => {
  console.log('\n\n🔧 Testing outline structuring...\n');
  console.log('='.repeat(80));
  console.log('💡 Note: Retries are normal - LLM may need multiple attempts to match schema\n');

  const client = createLLMClient();
  const testOutline = 'Create a 10-question quiz on photosynthesis for 5th graders';

  console.log(`Outline: "${testOutline}"\n`);

  try {
    const structured = await client.structureOutline(testOutline);

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
if (import.meta.main) {
  main().catch(console.error);
}
