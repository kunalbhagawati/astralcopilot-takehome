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
import { logger } from '../lib/services/logger';

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
  logger.info('🚀 Starting Outline Validation Tests (K-10 Education)');
  if (verbose) {
    logger.info('   (Verbose mode: showing full LLM output)');
  }
  logger.info('\n' + '='.repeat(80));

  // Check Ollama health and model availability
  const healthCheck = createOllamaHealthCheck();

  logger.info('\n📡 Checking Ollama connection...');
  const health = await healthCheck.checkHealth();

  if (!health.available) {
    logger.error('❌ Ollama is not available. Please ensure Ollama is running.');
    logger.error('   Run: ollama serve');
    process.exit(1);
  }

  logger.info('✅ Ollama is available');
  logger.info(`📦 Available models: ${health.models.join(', ')}`);

  // Ensure required models are available
  logger.info('\n📦 Ensuring required models are available...');
  try {
    await healthCheck.ensureModel('llama3.1');
    logger.info('✅ llama3.1 model is ready');
  } catch (error) {
    logger.error('❌ Failed to ensure model availability:', error);
    process.exit(1);
  }

  // Create validator for tests (includes LLM + threshold application)
  const validator = getOutlineValidator();

  logger.info('\n' + '='.repeat(80));
  logger.info('🧪 Running validation tests...\n');
  logger.info(
    `📏 Thresholds: Safety ≥${(VALIDATION_THRESHOLDS.safety.minSafetyScore * 100).toFixed(0)}% | Specificity ≥${(VALIDATION_THRESHOLDS.specificity.minScore * 100).toFixed(0)}% | Age Range: ${VALIDATION_THRESHOLDS.actionability.minAge}-${VALIDATION_THRESHOLDS.actionability.maxAge}\n`,
  );

  let passed = 0;
  let failed = 0;
  let schemaErrors = 0;

  for (const test of OUTLINE_VALIDATION_FIXTURES) {
    logger.info(`\n${'─'.repeat(80)}`);
    logger.info(`📝 Test: ${test.name}`);
    logger.info(`   Outline: "${test.outline}"`);
    logger.info(`   Expected: ${test.expectedValid ? 'VALID ✓' : 'INVALID ✗'}`);
    logger.info('');

    try {
      const validationResult = await validator.validate(test.outline);
      const result = validationResult as EnhancedOutlineValidationResult;

      // Validate enhanced result against schema (if available)
      if (result.enhancedResult) {
        try {
          EnhancedValidationResultSchema.parse(result.enhancedResult);
          logger.info('   ✅ Schema validation: PASSED');
        } catch (schemaError) {
          logger.error('   ❌ Schema validation: FAILED');
          logger.error(`      ${schemaError instanceof Error ? schemaError.message : 'Unknown schema error'}`);
          schemaErrors++;
        }
      }

      logger.info('');
      logger.info(`   📊 Result: ${validationResult.valid ? 'VALID ✓' : 'INVALID ✗'}`);
      logger.info('');

      // Show full JSON output in verbose mode
      if (verbose) {
        logger.info('   📄 Full Validation Result (JSON):');
        logger.info(
          JSON.stringify(validationResult, null, 2)
            .split('\n')
            .map((line) => `      ${line}`)
            .join('\n'),
        );
        logger.info('');
      }

      // Check if we have enhanced result for detailed output
      if (!result.enhancedResult) {
        logger.info('   ⚠️  No enhanced validation result available');
        if (!validationResult.valid && validationResult.errors && validationResult.errors.length > 0) {
          logger.info('\n   ⚠️  Validation Errors:');
          validationResult.errors.forEach((err: string) => logger.info(`      - ${err}`));
        }
        continue;
      }

      // Safety scores
      logger.info('   🎯 Safety Analysis:');
      logger.info(
        `      Safety:     ${formatScore(result.enhancedResult.safety.safetyScore, VALIDATION_THRESHOLDS.safety.minSafetyScore, true)} (0.0=unsafe, 1.0=safe)`,
      );
      logger.info(
        `      Confidence: ${formatScore(result.enhancedResult.safety.confidence, VALIDATION_THRESHOLDS.safety.minConfidence, true)}`,
      );
      logger.info(`      Reasoning:  "${result.enhancedResult.safety.reasoning}"`);
      if (result.enhancedResult.safety.flags && result.enhancedResult.safety.flags.length > 0) {
        logger.info(`      Flags:      ${result.enhancedResult.safety.flags.join(', ')}`);
      }

      logger.info('');

      // Specificity scores
      logger.info('   🔍 Specificity Analysis:');
      logger.info(
        `      Score:      ${formatScore(result.enhancedResult.specificity.specificityScore, VALIDATION_THRESHOLDS.specificity.minScore, true)}`,
      );
      logger.info(
        `      Topic:      "${result.enhancedResult.specificity.detectedHierarchy.topic}" (${result.enhancedResult.specificity.detectedHierarchy.domains.join(', ')})`,
      );
      if (result.enhancedResult.specificity.suggestions && result.enhancedResult.specificity.suggestions.length > 0) {
        logger.info(`      Suggestions: ${result.enhancedResult.specificity.suggestions.join('; ')}`);
      }

      logger.info('');

      // Actionability
      logger.info('   ⚙️  Actionability:');
      logger.info(
        `      Status:     ${result.enhancedResult.actionability.actionable ? '✓ Actionable' : '✗ Not actionable'}`,
      );
      const [minAge, maxAge] = result.enhancedResult.actionability.targetAgeRange;
      const ageRangeValid =
        minAge >= VALIDATION_THRESHOLDS.actionability.minAge &&
        maxAge <= VALIDATION_THRESHOLDS.actionability.maxAge &&
        minAge <= maxAge;
      logger.info(`      Age Range:  [${minAge}, ${maxAge}] ${ageRangeValid ? '✓' : '✗'}`);
      if (result.enhancedResult.actionability.requirements.length > 0) {
        logger.info(`      Requirements: ${result.enhancedResult.actionability.requirements.join(', ')}`);
      }
      if (
        result.enhancedResult.actionability.missingInfo &&
        result.enhancedResult.actionability.missingInfo.length > 0
      ) {
        logger.info(`      Missing:    ${result.enhancedResult.actionability.missingInfo.join(', ')}`);
      }

      logger.info('');

      // Test result
      if (validationResult.valid !== test.expectedValid) {
        logger.info(
          `   ❌ TEST FAILED: Expected ${test.expectedValid ? 'VALID' : 'INVALID'} but got ${validationResult.valid ? 'VALID' : 'INVALID'}`,
        );
        failed++;
      } else {
        logger.info(`   ✅ TEST PASSED`);
        passed++;
      }

      // Errors (from top-level result or enhanced result)
      const errors = validationResult.errors || result.enhancedResult.errors;
      if (!validationResult.valid && errors && errors.length > 0) {
        logger.info('');
        logger.info('   ⚠️  Validation Errors:');
        errors.forEach((err: string) => logger.info(`      - ${err}`));
      }

      // Suggestions (from enhanced result)
      if (result.enhancedResult.suggestions && result.enhancedResult.suggestions.length > 0) {
        logger.info('');
        logger.info('   💡 Suggestions:');
        result.enhancedResult.suggestions.forEach((sug: string) => logger.info(`      - ${sug}`));
      }
    } catch (error) {
      logger.error(`   ❌ ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`);
      failed++;
    }
  }

  logger.info('\n' + '='.repeat(80));
  logger.info(
    `\n📊 Test Results: ${passed} passed, ${failed} failed out of ${OUTLINE_VALIDATION_FIXTURES.length} tests`,
  );

  if (schemaErrors > 0) {
    logger.info(`⚠️  Schema validation failures: ${schemaErrors}`);
  }

  if (failed > 0) {
    logger.info('\n⚠️  Some tests failed. This may be due to:');
    logger.info('   - LLM variability (different runs may produce different results)');
    logger.info('   - Model differences (different models may classify differently)');
    logger.info('   - Prompt engineering needs refinement');
  } else if (schemaErrors === 0) {
    logger.info('\n🎉 All tests passed with valid schema!');
  } else {
    logger.info('\n⚠️  All tests passed but some schema validation errors occurred');
  }

  if (!verbose) {
    logger.info('\n💡 Tip: Run with -v or --verbose to see full LLM output (JSON)');
  }

  logger.info('\n' + '='.repeat(80));
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
    logger.error('\n❌ Test execution failed:', error);
    process.exit(1);
  }
};

// Export for direct execution
export { main };

// Run if executed directly (Bun-specific)
// @ts-ignore - Bun-specific property not in standard TypeScript
if (import.meta.main) {
  main().catch(logger.error);
}
