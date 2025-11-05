/**
 * Test script for outline validation (K-10 Education)
 *
 * Tests the full validation flow: LLM score generation + server threshold application
 *
 * Flow tested:
 * 1. LLM generates EnhancedValidationResult (scores only)
 * 2. Server applies thresholds via applyValidationThresholds() (computes 'valid' field)
 * 3. Returns EnhancedOutlineValidationResult (includes both LLM scores and server decision)
 *
 * Run with: bun run scripts/test-outline-validation.ts
 * Run with verbose output: bun run scripts/test-outline-validation.ts -v
 *
 * Note: Verbose mode shows full validation result as JSON
 *
 * Prerequisites:
 * - Ollama running: `ollama serve`
 * - Model available: `ollama pull llama3.1`
 */

import { VALIDATION_THRESHOLDS } from '../lib/config/validation-thresholds';
import { getOutlineValidator, type EnhancedOutlineValidationResult } from '../lib/services/adapters/outline-validator';
import { EnhancedValidationResultSchema } from '../lib/types/validation.types';
import { createOllamaHealthCheck } from '../lib/utils/ollama-health-check';
import { OUTLINE_VALIDATION_FIXTURES } from './fixtures/outline-validation-fixtures';

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
const runTests = async (verbose: boolean = false): Promise<void> => {
  console.log('🚀 Starting Outline Validation Tests (K-10 Education)');
  if (verbose) {
    console.log('   (Verbose mode: showing full LLM output)');
  }
  console.log('\n' + '='.repeat(80));

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

  // Create validator for tests (includes LLM + threshold application)
  const validator = getOutlineValidator();

  console.log('\n' + '='.repeat(80));
  console.log('🧪 Running validation tests...\n');
  console.log(
    `📏 Thresholds: Intent ≥${(VALIDATION_THRESHOLDS.intent.minIntentScore * 100).toFixed(0)}% | Specificity ≥${(VALIDATION_THRESHOLDS.specificity.minScore * 100).toFixed(0)}% | Age Range: ${VALIDATION_THRESHOLDS.actionability.minAge}-${VALIDATION_THRESHOLDS.actionability.maxAge}\n`,
  );

  let passed = 0;
  let failed = 0;
  let schemaErrors = 0;

  for (const test of OUTLINE_VALIDATION_FIXTURES) {
    console.log(`\n${'─'.repeat(80)}`);
    console.log(`📝 Test: ${test.name}`);
    console.log(`   Outline: "${test.outline}"`);
    console.log(`   Expected: ${test.expectedValid ? 'VALID ✓' : 'INVALID ✗'}`);
    console.log();

    try {
      const validationResult = await validator.validate(test.outline);
      const result = validationResult as EnhancedOutlineValidationResult;

      // Validate enhanced result against schema (if available)
      if (result.enhancedResult) {
        try {
          EnhancedValidationResultSchema.parse(result.enhancedResult);
          console.log('   ✅ Schema validation: PASSED');
        } catch (schemaError) {
          console.error('   ❌ Schema validation: FAILED');
          console.error(`      ${schemaError instanceof Error ? schemaError.message : 'Unknown schema error'}`);
          schemaErrors++;
        }
      }

      console.log();
      console.log(`   📊 Result: ${validationResult.valid ? 'VALID ✓' : 'INVALID ✗'}`);
      console.log();

      // Show full JSON output in verbose mode
      if (verbose) {
        console.log('   📄 Full Validation Result (JSON):');
        console.log(
          JSON.stringify(validationResult, null, 2)
            .split('\n')
            .map((line) => `      ${line}`)
            .join('\n'),
        );
        console.log();
      }

      // Check if we have enhanced result for detailed output
      if (!result.enhancedResult) {
        console.log('   ⚠️  No enhanced validation result available');
        if (!validationResult.valid && validationResult.errors && validationResult.errors.length > 0) {
          console.log('\n   ⚠️  Validation Errors:');
          validationResult.errors.forEach((err: string) => console.log(`      - ${err}`));
        }
        continue;
      }

      // Intent scores
      console.log('   🎯 Intent Analysis:');
      console.log(
        `      Intent:     ${formatScore(result.enhancedResult.intent.intentScore, VALIDATION_THRESHOLDS.intent.minIntentScore, true)} (0.0=harmful, 1.0=educational)`,
      );
      console.log(
        `      Confidence: ${formatScore(result.enhancedResult.intent.confidence, VALIDATION_THRESHOLDS.intent.minConfidence, true)}`,
      );
      console.log(`      Reasoning:  "${result.enhancedResult.intent.reasoning}"`);
      if (result.enhancedResult.intent.flags && result.enhancedResult.intent.flags.length > 0) {
        console.log(`      Flags:      ${result.enhancedResult.intent.flags.join(', ')}`);
      }

      console.log();

      // Specificity scores
      console.log('   🔍 Specificity Analysis:');
      console.log(
        `      Score:      ${formatScore(result.enhancedResult.specificity.specificityScore, VALIDATION_THRESHOLDS.specificity.minScore, true)}`,
      );
      console.log(
        `      Taxonomy:   ${result.enhancedResult.specificity.matchesTaxonomy ? '✓ Matches' : '✗ No match'}`,
      );
      console.log(
        `      Topic:      "${result.enhancedResult.specificity.detectedHierarchy.topic}" (${result.enhancedResult.specificity.detectedHierarchy.domains.join(', ')})`,
      );
      if (result.enhancedResult.specificity.suggestions && result.enhancedResult.specificity.suggestions.length > 0) {
        console.log(`      Suggestions: ${result.enhancedResult.specificity.suggestions.join('; ')}`);
      }

      console.log();

      // Actionability
      console.log('   ⚙️  Actionability:');
      console.log(
        `      Status:     ${result.enhancedResult.actionability.actionable ? '✓ Actionable' : '✗ Not actionable'}`,
      );
      const [minAge, maxAge] = result.enhancedResult.actionability.targetAgeRange;
      const ageRangeValid =
        minAge >= VALIDATION_THRESHOLDS.actionability.minAge &&
        maxAge <= VALIDATION_THRESHOLDS.actionability.maxAge &&
        minAge <= maxAge;
      console.log(`      Age Range:  [${minAge}, ${maxAge}] ${ageRangeValid ? '✓' : '✗'}`);
      if (result.enhancedResult.actionability.requirements.length > 0) {
        console.log(`      Requirements: ${result.enhancedResult.actionability.requirements.join(', ')}`);
      }
      if (
        result.enhancedResult.actionability.missingInfo &&
        result.enhancedResult.actionability.missingInfo.length > 0
      ) {
        console.log(`      Missing:    ${result.enhancedResult.actionability.missingInfo.join(', ')}`);
      }

      console.log();

      // Test result
      if (validationResult.valid !== test.expectedValid) {
        console.log(
          `   ❌ TEST FAILED: Expected ${test.expectedValid ? 'VALID' : 'INVALID'} but got ${validationResult.valid ? 'VALID' : 'INVALID'}`,
        );
        failed++;
      } else {
        console.log(`   ✅ TEST PASSED`);
        passed++;
      }

      // Errors (from top-level result or enhanced result)
      const errors = validationResult.errors || result.enhancedResult.errors;
      if (!validationResult.valid && errors && errors.length > 0) {
        console.log();
        console.log('   ⚠️  Validation Errors:');
        errors.forEach((err: string) => console.log(`      - ${err}`));
      }

      // Suggestions (from enhanced result)
      if (result.enhancedResult.suggestions && result.enhancedResult.suggestions.length > 0) {
        console.log();
        console.log('   💡 Suggestions:');
        result.enhancedResult.suggestions.forEach((sug: string) => console.log(`      - ${sug}`));
      }
    } catch (error) {
      console.error(`   ❌ ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`);
      failed++;
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log(
    `\n📊 Test Results: ${passed} passed, ${failed} failed out of ${OUTLINE_VALIDATION_FIXTURES.length} tests`,
  );

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

  if (!verbose) {
    console.log('\n💡 Tip: Run with -v or --verbose to see full LLM output (JSON)');
  }

  console.log('\n' + '='.repeat(80));
};

/**
 * Main execution
 */
const main = async (): Promise<void> => {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const verbose = args.includes('-v') || args.includes('--verbose');

  try {
    await runTests(verbose);
  } catch (error) {
    console.error('\n❌ Test execution failed:', error);
    process.exit(1);
  }
};

// Export for direct execution
export { main };

// Run if executed directly (Bun-specific)
// @ts-ignore - Bun-specific property not in standard TypeScript
if (import.meta.main) {
  main().catch(console.error);
}
