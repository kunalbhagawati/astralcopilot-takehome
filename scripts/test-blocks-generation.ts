/**
 * Test script for blocks generation
 *
 * Validates that LLM generates blocks with correct format/schema.
 * Does NOT validate content quality (LLM non-deterministic).
 *
 * Run: bun run scripts/test-blocks-generation.ts
 * Run with verbose output: bun run scripts/test-blocks-generation.ts -v
 *
 * Note: Verbose mode shows all generated blocks (default shows first 2 only)
 */

import { createLLMClient } from '../lib/services/adapters/llm-client';
import { createOllamaHealthCheck } from '../lib/utils/ollama-health-check';
import { ActionableBlocksResultSchema } from '../lib/types/actionable-blocks.types';
import type { ActionableBlocksResult } from '../lib/types/actionable-blocks.types';
import { BLOCKS_GENERATION_FIXTURES } from './fixtures/blocks-generation-fixtures';
import type { BlockGenerationFixture } from './fixtures/blocks-generation-fixtures';

/**
 * Test result for a single fixture
 */
interface TestResult {
  name: string;
  passed: boolean;
  errors: string[];
  result?: ActionableBlocksResult;
}

/**
 * Validate blocks generation format (not content)
 */
const validateBlocksFormat = (
  result: ActionableBlocksResult,
  fixture: BlockGenerationFixture,
): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  // 1. Block count validation
  const blockCount = result.blocks.length;
  if (blockCount < fixture.expectedMetadata.minBlockCount) {
    errors.push(`Block count too low: ${blockCount} (expected at least ${fixture.expectedMetadata.minBlockCount})`);
  }
  if (blockCount > fixture.expectedMetadata.maxBlockCount) {
    errors.push(`Block count too high: ${blockCount} (expected at most ${fixture.expectedMetadata.maxBlockCount})`);
  }

  // 2. Block string validation
  result.blocks.forEach((block, index) => {
    if (typeof block !== 'string') {
      errors.push(`Block ${index + 1} is not a string: ${typeof block}`);
    } else if (block.length < 10) {
      errors.push(`Block ${index + 1} is too short: ${block.length} chars (minimum 10)`);
    }
  });

  // 3. Metadata validation
  if (result.metadata.originalOutline !== fixture.input.originalOutline) {
    errors.push(
      `Original outline mismatch: "${result.metadata.originalOutline}" !== "${fixture.input.originalOutline}"`,
    );
  }

  if (
    result.metadata.ageRange[0] !== fixture.input.validationFeedback.targetAgeRange[0] ||
    result.metadata.ageRange[1] !== fixture.input.validationFeedback.targetAgeRange[1]
  ) {
    errors.push(
      `Age range mismatch: [${result.metadata.ageRange}] !== [${fixture.input.validationFeedback.targetAgeRange}]`,
    );
  }

  // 4. Topic validation (flexible - case insensitive contains check)
  const resultTopicLower = result.metadata.topic.toLowerCase();
  const expectedTopicLower = fixture.expectedMetadata.topic.toLowerCase();
  const topicMatches = resultTopicLower.includes(expectedTopicLower) || expectedTopicLower.includes(resultTopicLower);

  if (!topicMatches) {
    errors.push(
      `Topic mismatch: "${result.metadata.topic}" doesn't match expected "${fixture.expectedMetadata.topic}"`,
    );
  }

  // 5. Domains validation (at least one domain should match)
  const resultDomainsLower = result.metadata.domains.map((d) => d.toLowerCase());
  const expectedDomainsLower = fixture.expectedMetadata.domains.map((d) => d.toLowerCase());
  const hasMatchingDomain = expectedDomainsLower.some((expected) =>
    resultDomainsLower.some((result) => result.includes(expected) || expected.includes(result)),
  );

  if (!hasMatchingDomain) {
    console.log(
      `   ⚠️  No matching domains (LLM variability): [${result.metadata.domains.join(', ')}] vs [${fixture.expectedMetadata.domains.join(', ')}]`,
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Run blocks generation test for a single fixture
 */
const runTest = async (
  client: ReturnType<typeof createLLMClient>,
  fixture: BlockGenerationFixture,
  verbose: boolean = false,
): Promise<TestResult> => {
  console.log('─'.repeat(80));
  console.log(`📝 Test: ${fixture.name}`);
  console.log(`   Outline: "${fixture.input.originalOutline}"`);
  console.log(
    `   Target Age Range: ${fixture.input.validationFeedback.targetAgeRange[0]}-${fixture.input.validationFeedback.targetAgeRange[1]}`,
  );
  console.log(
    `   Expected Block Count: ${fixture.expectedMetadata.minBlockCount}-${fixture.expectedMetadata.maxBlockCount}`,
  );

  try {
    // Generate blocks
    const result = await client.generateBlocks(fixture.input);

    // Schema validation
    try {
      ActionableBlocksResultSchema.parse(result);
      console.log('\n   ✅ Schema validation: PASSED');
    } catch (error) {
      console.log('\n   ❌ Schema validation: FAILED');
      return {
        name: fixture.name,
        passed: false,
        errors: [`Schema validation failed: ${error instanceof Error ? error.message : String(error)}`],
      };
    }

    // Format validation
    const formatValidation = validateBlocksFormat(result, fixture);

    console.log(`\n   📊 Generated ${result.blocks.length} blocks`);
    console.log(`   🏷️  Topic: ${result.metadata.topic}`);
    console.log(`   🗂️  Domains: ${result.metadata.domains.join(', ')}`);
    console.log(`   ⚙️  Complexity: ${result.metadata.complexity} (LLM-estimated)`);

    // Show blocks (full in verbose mode, sample in normal mode)
    if (verbose) {
      console.log('\n   📄 All generated blocks:');
      result.blocks.forEach((block, index) => {
        console.log(`\n      Block ${index + 1}:`);
        console.log(`      ${block}`);
      });
    } else {
      console.log('\n   📄 Sample blocks (first 2):');
      result.blocks.slice(0, 2).forEach((block, index) => {
        const preview = block.length > 100 ? block.substring(0, 100) + '...' : block;
        console.log(`      ${index + 1}. ${preview}`);
      });
      if (result.blocks.length > 2) {
        console.log(`      ... (${result.blocks.length - 2} more blocks, use -v to see all)`);
      }
    }

    if (formatValidation.valid) {
      console.log('\n   ✅ TEST PASSED');
      return {
        name: fixture.name,
        passed: true,
        errors: [],
        result,
      };
    } else {
      console.log('\n   ❌ TEST FAILED');
      formatValidation.errors.forEach((error) => {
        console.log(`      - ${error}`);
      });
      return {
        name: fixture.name,
        passed: false,
        errors: formatValidation.errors,
        result,
      };
    }
  } catch (error) {
    console.log('\n   ❌ TEST FAILED - Exception thrown');
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log(`      ${errorMessage}`);
    return {
      name: fixture.name,
      passed: false,
      errors: [errorMessage],
    };
  }
};

/**
 * Run all blocks generation tests
 */
const runTests = async (verbose: boolean = false): Promise<void> => {
  console.log('🚀 Starting Blocks Generation Tests (K-10 Education)');
  if (verbose) {
    console.log('   (Verbose mode: showing full LLM output)');
  }
  console.log('\n' + '='.repeat(80));

  // Ollama health check
  console.log('\n📡 Checking Ollama connection...');
  const healthCheck = createOllamaHealthCheck();
  const health = await healthCheck.checkHealth();

  if (!health.available) {
    console.error('❌ Ollama not available');
    console.error('   Please ensure Ollama is running with the required model');
    process.exit(1);
  }

  console.log('✅ Ollama is available');
  console.log(`📦 Available models: ${health.models?.join(', ') || 'unknown'}`);

  // Ensure required model is available
  console.log('\n📦 Ensuring required model is available...');
  try {
    await healthCheck.ensureModel('llama3.1');
    console.log('✅ llama3.1 model is ready');
  } catch (error) {
    console.error('❌ Failed to ensure model availability:', error);
    process.exit(1);
  }

  console.log('\n' + '='.repeat(80));
  console.log('🧪 Running blocks generation tests...\n');

  const client = createLLMClient();
  const results: TestResult[] = [];

  // Run all tests
  for (const fixture of BLOCKS_GENERATION_FIXTURES) {
    const result = await runTest(client, fixture, verbose);
    results.push(result);
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;

  console.log(`\n📊 Test Results: ${passedCount} passed, ${failedCount} failed out of ${results.length} tests\n`);

  if (failedCount === 0) {
    console.log('🎉 All tests passed!\n');
  } else {
    console.log('⚠️  Some tests failed. This may be due to:');
    console.log('   - LLM variability (different runs may produce different results)');
    console.log('   - Model differences (different models may generate different outputs)');
    console.log('   - Prompt engineering needs refinement\n');
  }

  console.log('='.repeat(80));
  console.log('\n💡 Note: Content quality is NOT validated (LLM non-deterministic)');
  console.log('   These tests only validate schema and format consistency.');
  if (!verbose) {
    console.log('\n💡 Tip: Run with -v or --verbose to see all generated blocks');
  }
  console.log();
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

// Run if executed directly
// @ts-ignore - Bun-specific property not in standard TypeScript
if (import.meta.main) {
  main().catch(console.error);
}
