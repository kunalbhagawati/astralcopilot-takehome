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

import { createContextForBlocksGeneration, generateBlocks } from '../lib/services/adapters/blocks-generator-core';
import { logger } from '../lib/services/logger';
import type { ActionableBlocksResult } from '../lib/types/actionable-blocks.types';
import { ActionableBlocksResultSchema } from '../lib/types/actionable-blocks.types';
import { createOllamaHealthCheck } from '../lib/utils/ollama-health-check';
import type { BlockGenerationFixture } from './fixtures/blocks-generation-fixtures';
import { BLOCKS_GENERATION_FIXTURES } from './fixtures/blocks-generation-fixtures';

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

  // 1. Block count validation (across all lessons)
  const totalBlockCount = result.lessons.reduce((sum, lesson) => sum + lesson.blocks.length, 0);
  if (totalBlockCount < fixture.expectedMetadata.minBlockCount) {
    errors.push(
      `Block count too low: ${totalBlockCount} (expected at least ${fixture.expectedMetadata.minBlockCount})`,
    );
  }
  if (totalBlockCount > fixture.expectedMetadata.maxBlockCount) {
    errors.push(
      `Block count too high: ${totalBlockCount} (expected at most ${fixture.expectedMetadata.maxBlockCount})`,
    );
  }

  // 1a. Verify totalBlockCount in metadata matches actual count
  if (result.metadata.totalBlockCount !== totalBlockCount) {
    errors.push(
      `Metadata totalBlockCount mismatch: ${result.metadata.totalBlockCount} (metadata) vs ${totalBlockCount} (actual)`,
    );
  }

  // 1b. Lesson structure validation
  if (result.lessons.length === 0) {
    errors.push('Must have at least 1 lesson');
  }
  result.lessons.forEach((lesson, idx) => {
    if (!lesson.title || lesson.title.length < 3) {
      errors.push(`Lesson ${idx + 1} has invalid title (must be at least 3 characters)`);
    }
    if (lesson.blocks.length === 0) {
      errors.push(`Lesson ${idx + 1} ("${lesson.title}") has no blocks`);
    }
  });

  // 2. Structured block validation (across all lessons)
  result.lessons.forEach((lesson, lessonIdx) => {
    lesson.blocks.forEach((block, blockIdx) => {
      // Check if block is an object (structured format)
      if (typeof block !== 'object' || block === null) {
        errors.push(`Lesson ${lessonIdx + 1}, Block ${blockIdx + 1} is not a structured block object: ${typeof block}`);
        return;
      }

      // Check for type field
      if (!('type' in block) || typeof block.type !== 'string') {
        errors.push(`Lesson ${lessonIdx + 1}, Block ${blockIdx + 1} missing valid 'type' field`);
        return;
      }

      // Extract type for error messaging (TypeScript narrows to never in default case)
      const blockType = block.type;

      // Validate based on block type
      switch (block.type) {
        case 'text':
          if (!('content' in block) || typeof block.content !== 'string') {
            errors.push(`Lesson ${lessonIdx + 1}, Block ${blockIdx + 1} (TextBlock) missing 'content' field`);
          } else if (block.content.length < 10) {
            errors.push(
              `Lesson ${lessonIdx + 1}, Block ${blockIdx + 1} (TextBlock) content too short: ${block.content.length} chars (minimum 10)`,
            );
          }
          break;

        case 'image':
          if (!('format' in block) || !['svg', 'url'].includes(block.format as string)) {
            errors.push(
              `Lesson ${lessonIdx + 1}, Block ${blockIdx + 1} (ImageBlock) invalid or missing 'format' (must be 'svg' or 'url')`,
            );
          }
          if (!('content' in block) || typeof block.content !== 'string' || block.content.length < 10) {
            errors.push(
              `Lesson ${lessonIdx + 1}, Block ${blockIdx + 1} (ImageBlock) invalid or missing 'content' (minimum 10 chars)`,
            );
          }
          if (!('alt' in block) || typeof block.alt !== 'string' || block.alt.length < 3) {
            errors.push(
              `Lesson ${lessonIdx + 1}, Block ${blockIdx + 1} (ImageBlock) invalid or missing 'alt' text (minimum 3 chars)`,
            );
          }
          break;

        case 'interaction':
          if (
            !('interactionType' in block) ||
            !['input', 'quiz', 'visualization', 'dragdrop'].includes(block.interactionType as string)
          ) {
            errors.push(
              `Lesson ${lessonIdx + 1}, Block ${blockIdx + 1} (InteractionBlock) invalid or missing 'interactionType'`,
            );
          }
          if (!('prompt' in block) || typeof block.prompt !== 'string' || block.prompt.length < 5) {
            errors.push(
              `Lesson ${lessonIdx + 1}, Block ${blockIdx + 1} (InteractionBlock) invalid or missing 'prompt' (minimum 5 chars)`,
            );
          }
          if (!('metadata' in block) || typeof block.metadata !== 'object') {
            errors.push(`Lesson ${lessonIdx + 1}, Block ${blockIdx + 1} (InteractionBlock) missing 'metadata' object`);
          }
          break;

        default:
          errors.push(
            `Lesson ${lessonIdx + 1}, Block ${blockIdx + 1} has unknown type: "${blockType}" (must be 'text', 'image', or 'interaction')`,
          );
      }
    });
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
    logger.info(
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
const runTest = async (fixture: BlockGenerationFixture, verbose: boolean = false): Promise<TestResult> => {
  logger.info('─'.repeat(80));
  logger.info(`📝 Test: ${fixture.name}`);
  logger.info(`   Outline: "${fixture.input.originalOutline}"`);
  logger.info(
    `   Target Age Range: ${fixture.input.validationFeedback.targetAgeRange[0]}-${fixture.input.validationFeedback.targetAgeRange[1]}`,
  );
  logger.info(
    `   Expected Block Count: ${fixture.expectedMetadata.minBlockCount}-${fixture.expectedMetadata.maxBlockCount}`,
  );

  try {
    // Generate blocks
    const context = createContextForBlocksGeneration();
    const result = await generateBlocks(context, fixture.input);

    // Schema validation
    try {
      ActionableBlocksResultSchema.parse(result);
      logger.info('\n   ✅ Schema validation: PASSED');
    } catch (error) {
      logger.info('\n   ❌ Schema validation: FAILED');
      return {
        name: fixture.name,
        passed: false,
        errors: [`Schema validation failed: ${error instanceof Error ? error.message : String(error)}`],
      };
    }

    // Format validation
    const formatValidation = validateBlocksFormat(result, fixture);

    const totalBlocks = result.lessons.reduce((sum, lesson) => sum + lesson.blocks.length, 0);
    logger.info(`\n   📊 Generated ${result.lessons.length} lessons with ${totalBlocks} total blocks`);
    logger.info(`   🏷️  Topic: ${result.metadata.topic}`);
    logger.info(`   🗂️  Domains: ${result.metadata.domains.join(', ')}`);
    logger.info(`   ⚙️  Complexity: ${result.metadata.complexity} (LLM-estimated)`);

    // Show lessons and blocks (full in verbose mode, sample in normal mode)
    if (verbose) {
      logger.info('\n   📄 All generated lessons and blocks:');
      result.lessons.forEach((lesson, lessonIdx) => {
        logger.info(`\n      Lesson ${lessonIdx + 1}: ${lesson.title}`);
        lesson.blocks.forEach((block, blockIdx) => {
          if (typeof block === 'object' && block !== null && 'type' in block) {
            // Display structured block
            if (block.type === 'text') {
              logger.info(`         Block ${blockIdx + 1} [Text]: ${block.content}`);
            } else if (block.type === 'image') {
              const caption = 'caption' in block ? ` | Caption: "${block.caption}"` : '';
              logger.info(
                `         Block ${blockIdx + 1} [Image/${block.format}]: Alt="${block.alt}"${caption} | Content: ${block.content.substring(0, 60)}...`,
              );
            } else if (block.type === 'interaction') {
              logger.info(`         Block ${blockIdx + 1} [Interaction/${block.interactionType}]: ${block.prompt}`);
            }
          } else {
            // Fallback for non-structured blocks (backward compatibility)
            logger.info(`         Block ${blockIdx + 1}: ${String(block)}`);
          }
        });
      });
    } else {
      logger.info('\n   📄 Sample lessons (first 2):');
      result.lessons.slice(0, 2).forEach((lesson, lessonIdx) => {
        logger.info(`\n      Lesson ${lessonIdx + 1}: ${lesson.title}`);
        lesson.blocks.slice(0, 2).forEach((block, blockIdx) => {
          if (typeof block === 'object' && block !== null && 'type' in block) {
            // Display structured block preview
            if (block.type === 'text') {
              const preview = block.content.length > 80 ? block.content.substring(0, 80) + '...' : block.content;
              logger.info(`         ${blockIdx + 1}. [Text] ${preview}`);
            } else if (block.type === 'image') {
              logger.info(`         ${blockIdx + 1}. [Image/${block.format}] Alt: "${block.alt}"`);
            } else if (block.type === 'interaction') {
              logger.info(`         ${blockIdx + 1}. [${block.interactionType}] ${block.prompt}`);
            }
          } else {
            // Fallback for non-structured blocks
            const blockStr = String(block);
            const preview = blockStr.length > 80 ? blockStr.substring(0, 80) + '...' : blockStr;
            logger.info(`         ${blockIdx + 1}. ${preview}`);
          }
        });
        if (lesson.blocks.length > 2) {
          logger.info(`         ... (${lesson.blocks.length - 2} more blocks in this lesson)`);
        }
      });
      if (result.lessons.length > 2) {
        logger.info(`\n      ... (${result.lessons.length - 2} more lessons, use -v to see all)`);
      }
    }

    if (formatValidation.valid) {
      logger.info('\n   ✅ TEST PASSED');
      return {
        name: fixture.name,
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
        name: fixture.name,
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
  logger.info('🚀 Starting Blocks Generation Tests (K-10 Education)');
  if (verbose) {
    logger.info('   (Verbose mode: showing full LLM output)');
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

  // Ensure required model is available
  logger.info('\n📦 Ensuring required model is available...');
  try {
    await healthCheck.ensureModel('llama3.1');
    logger.info('✅ llama3.1 model is ready');
  } catch (error) {
    logger.error('❌ Failed to ensure model availability:', error);
    process.exit(1);
  }

  logger.info('\n' + '='.repeat(80));
  logger.info('🧪 Running blocks generation tests...\n');

  const results: TestResult[] = [];

  // Run all tests
  for (const fixture of BLOCKS_GENERATION_FIXTURES) {
    const result = await runTest(fixture, verbose);
    results.push(result);
  }

  // Summary
  logger.info('\n' + '='.repeat(80));
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;

  logger.info(`\n📊 Test Results: ${passedCount} passed, ${failedCount} failed out of ${results.length} tests\n`);

  if (failedCount === 0) {
    logger.info('🎉 All tests passed!\n');
  } else {
    logger.info('⚠️  Some tests failed. This may be due to:');
    logger.info('   - LLM variability (different runs may produce different results)');
    logger.info('   - Model differences (different models may generate different outputs)');
    logger.info('   - Prompt engineering needs refinement\n');
  }

  logger.info('='.repeat(80));
  logger.info('\n💡 Note: Content quality is NOT validated (LLM non-deterministic)');
  logger.info('   These tests only validate schema and format consistency.');
  if (!verbose) {
    logger.info('\n💡 Tip: Run with -v or --verbose to see all generated blocks');
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
