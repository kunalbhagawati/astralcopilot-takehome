/**
 * Test script for TSX generation
 *
 * Validates that LLM generates valid TSX code from blocks.
 * Does NOT validate code quality/style (LLM non-deterministic).
 *
 * Run: bun run scripts/test-tsx-generation.ts
 * Run with verbose output: bun run scripts/test-tsx-generation.ts -v
 *
 * Note: Verbose mode shows full generated TSX (default shows truncated preview)
 */

import { createLLMClient } from '../lib/services/adapters/llm-client';
import { logger } from '../lib/services/logger';
import type { ActionableBlocksResult } from '../lib/types/actionable-blocks.types';
import type { TSXGenerationInput, TSXGenerationResult } from '../lib/types/tsx-generation.types';
import { TSXGenerationResultSchema } from '../lib/types/tsx-generation.types';
import { createOllamaHealthCheck } from '../lib/utils/ollama-health-check';

/**
 * Sample blocks result for testing
 * Simulates output from blocks generation stage
 */
const SAMPLE_BLOCKS: ActionableBlocksResult = {
  lessons: [
    {
      title: 'Introduction to Photosynthesis',
      blocks: [
        '**What is photosynthesis?** Plants make their own food using sunlight, like having a kitchen inside their leaves.',
        '**Three ingredients plants need:** Sunlight from the sun, water from soil (through roots), and carbon dioxide (CO2) from the air we breathe out.',
        "**Where it happens:** Inside tiny green parts called chloroplasts - they're like food factories in plant leaves.",
      ],
    },
    {
      title: 'The Process and Importance',
      blocks: [
        '**The recipe:** Plants combine sunlight + water + CO2 to create sugar (their food) and release oxygen as a byproduct.',
        "**Why it matters to us:** Plants feed themselves AND make oxygen for us to breathe. Without photosynthesis, we wouldn't have breathable air!",
      ],
    },
  ],
  metadata: {
    originalOutline: 'Create a lesson on photosynthesis for 5th graders',
    topic: 'Photosynthesis',
    domains: ['science', 'biology', 'plants'],
    ageRange: [10, 11],
    complexity: 'moderate',
    totalBlockCount: 5,
  },
};

/**
 * Test result
 */
interface TestResult {
  passed: boolean;
  errors: string[];
  result?: TSXGenerationResult;
}

/**
 * Validate TSX generation format (not code quality)
 */
const validateTSXFormat = (result: TSXGenerationResult): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  // 1. Lessons count matches input
  if (result.lessons.length !== SAMPLE_BLOCKS.lessons.length) {
    errors.push(`Lesson count mismatch: ${result.lessons.length} generated, ${SAMPLE_BLOCKS.lessons.length} expected`);
  }

  // 2. Each lesson has required fields
  result.lessons.forEach((lesson, idx) => {
    if (!lesson.title || lesson.title.length < 3) {
      errors.push(`Lesson ${idx + 1}: Invalid title`);
    }

    if (!lesson.tsxCode || lesson.tsxCode.length < 50) {
      errors.push(`Lesson ${idx + 1}: TSX code too short (minimum 50 characters)`);
    }

    // Basic TSX validation
    if (lesson.tsxCode) {
      // Must include export
      if (!lesson.tsxCode.includes('export')) {
        errors.push(`Lesson ${idx + 1}: TSX code missing export statement`);
      }

      // Must be a React component (has return or arrow function)
      if (!lesson.tsxCode.includes('return') && !lesson.tsxCode.includes('=>')) {
        errors.push(`Lesson ${idx + 1}: TSX code doesn't appear to be a valid React component`);
      }

      // Should include className (Tailwind indicator)
      if (!lesson.tsxCode.includes('className')) {
        logger.info(`   ⚠️  Lesson ${idx + 1}: No Tailwind classes found (optional but recommended)`);
      }

      // Should include semantic HTML
      const semanticTags = ['<main', '<section', '<article', '<header', '<nav'];
      const hasSemanticHTML = semanticTags.some((tag) => lesson.tsxCode.includes(tag));
      if (!hasSemanticHTML) {
        logger.info(`   ⚠️  Lesson ${idx + 1}: No semantic HTML5 tags found (optional but recommended)`);
      }
    }

    if (!lesson.originalBlocks || lesson.originalBlocks.length === 0) {
      errors.push(`Lesson ${idx + 1}: Missing originalBlocks`);
    }
  });

  // 3. Metadata validation
  if (result.metadata.lessonCount !== result.lessons.length) {
    errors.push(
      `Metadata lessonCount mismatch: ${result.metadata.lessonCount} in metadata, ${result.lessons.length} actual`,
    );
  }

  if (!result.metadata.model || result.metadata.model.length === 0) {
    errors.push('Metadata missing model name');
  }

  if (!result.metadata.generatedAt || result.metadata.generatedAt.length === 0) {
    errors.push('Metadata missing generatedAt timestamp');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Run TSX generation test
 */
const runTest = async (client: ReturnType<typeof createLLMClient>, verbose: boolean = false): Promise<TestResult> => {
  logger.info('─'.repeat(80));
  logger.info('📝 Test: TSX Generation from Blocks');
  logger.info(`   Topic: ${SAMPLE_BLOCKS.metadata.topic}`);
  logger.info(`   Lessons: ${SAMPLE_BLOCKS.lessons.length}`);
  logger.info(`   Total Blocks: ${SAMPLE_BLOCKS.metadata.totalBlockCount}`);
  logger.info(`   Age Range: ${SAMPLE_BLOCKS.metadata.ageRange[0]}-${SAMPLE_BLOCKS.metadata.ageRange[1]}`);

  try {
    // Generate TSX
    const input: TSXGenerationInput = {
      blocksResult: SAMPLE_BLOCKS,
    };

    const result = await client.generateTSXFromBlocks(input);

    // Schema validation
    try {
      TSXGenerationResultSchema.parse(result);
      logger.info('\n   ✅ Schema validation: PASSED');
    } catch (error) {
      logger.info('\n   ❌ Schema validation: FAILED');
      return {
        passed: false,
        errors: [`Schema validation failed: ${error instanceof Error ? error.message : String(error)}`],
      };
    }

    // Format validation
    const formatValidation = validateTSXFormat(result);

    logger.info(`\n   📊 Generated TSX for ${result.lessons.length} lessons`);
    logger.info(`   🏷️  Model: ${result.metadata.model}`);
    logger.info(`   🕐 Generated At: ${result.metadata.generatedAt}`);

    // Show TSX samples
    result.lessons.forEach((lesson, idx) => {
      logger.info(`\n   📄 Lesson ${idx + 1}: ${lesson.title}`);
      logger.info(`      Original Blocks: ${lesson.originalBlocks.length}`);
      logger.info(`      TSX Length: ${lesson.tsxCode.length} characters`);

      if (verbose) {
        logger.info('\n      === Generated TSX ===');
        logger.info(lesson.tsxCode);
        logger.info('      ' + '='.repeat(40));
      } else {
        const preview = lesson.tsxCode.substring(0, 200).replace(/\n/g, ' ').trim();
        logger.info(`      Preview: ${preview}...`);
      }
    });

    if (!verbose) {
      logger.info('\n   💡 Use -v or --verbose to see full TSX code');
    }

    if (formatValidation.valid) {
      logger.info('\n   ✅ TEST PASSED');
      return {
        passed: true,
        errors: [],
        result,
      };
    } else {
      logger.info('\n   ❌ TEST FAILED');
      formatValidation.errors.forEach((error) => {
        logger.info(`      - ${error}`);
      });
      return {
        passed: false,
        errors: formatValidation.errors,
        result,
      };
    }
  } catch (error) {
    logger.info('\n   ❌ TEST FAILED - Exception thrown');
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.info(`      ${errorMessage}`);
    return {
      passed: false,
      errors: [errorMessage],
    };
  }
};

/**
 * Run TSX generation test
 */
const runTests = async (verbose: boolean = false): Promise<void> => {
  logger.info('🚀 Starting TSX Generation Test');
  if (verbose) {
    logger.info('   (Verbose mode: showing full TSX output)');
  }
  logger.info('\n' + '='.repeat(80));

  // Ollama health check
  logger.info('\n📡 Checking Ollama connection...');
  const healthCheck = createOllamaHealthCheck();
  const health = await healthCheck.checkHealth();

  if (!health.available) {
    logger.error('❌ Ollama not available');
    logger.error('   Please ensure Ollama is running with the required model');
    process.exit(1);
  }

  logger.info('✅ Ollama is available');
  logger.info(`📦 Available models: ${health.models?.join(', ') || 'unknown'}`);

  // Determine which model to use
  const modelToUse = process.env.OLLAMA_GENERATION_MODEL || 'llama3.1';
  logger.info(`\n📦 Using model: ${modelToUse}`);
  logger.info('   💡 Recommended: deepseek-coder-v2 for best TSX generation');
  logger.info('      Run: ollama pull deepseek-coder-v2');
  logger.info('      Then set: OLLAMA_GENERATION_MODEL=deepseek-coder-v2');

  // Ensure model is available
  logger.info(`\n📦 Ensuring ${modelToUse} model is available...`);
  try {
    await healthCheck.ensureModel(modelToUse);
    logger.info(`✅ ${modelToUse} model is ready`);
  } catch (error) {
    logger.error('❌ Failed to ensure model availability:', error);
    process.exit(1);
  }

  logger.info('\n' + '='.repeat(80));
  logger.info('🧪 Running TSX generation test...\n');

  const client = createLLMClient();
  const result = await runTest(client, verbose);

  // Summary
  logger.info('\n' + '='.repeat(80));

  if (result.passed) {
    logger.info('\n🎉 Test passed!\n');
  } else {
    logger.info('\n⚠️  Test failed. This may be due to:');
    logger.info('   - LLM variability (different runs may produce different results)');
    logger.info('   - Model differences (deepseek-coder-v2 works best for TSX)');
    logger.info('   - Prompt engineering needs refinement\n');
  }

  logger.info('='.repeat(80));
  logger.info('\n💡 Note: Code quality/style is NOT validated (LLM non-deterministic)');
  logger.info('   This test only validates schema and basic TSX structure.');
  if (!verbose) {
    logger.info('\n💡 Tip: Run with -v or --verbose to see full generated TSX');
  }
  logger.info('');
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

// Run if executed directly
// @ts-ignore - Bun-specific property not in standard TypeScript
if (import.meta.main) {
  main().catch((error) => logger.error(error));
}
