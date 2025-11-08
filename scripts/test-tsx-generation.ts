/**
 * Test script for TSX generation
 *
 * Validates that LLM generates valid TSX code from blocks.
 * Does NOT validate code quality/style (LLM non-deterministic).
 *
 * Tests both:
 * - Batch generation (legacy, for testing)
 * - Single-lesson generation (used by actor machine for sequential generation)
 *
 * Run: bun run scripts/test-tsx-generation.ts
 * Run with verbose output: bun run scripts/test-tsx-generation.ts -v
 * Run only single-lesson test: bun run scripts/test-tsx-generation.ts --single
 *
 * Note: Verbose mode shows full generated TSX (default shows truncated preview)
 * Note: Actor machine uses sequential generation (1 prompt = 1 lesson = 1 table row)
 */

import {
  TSX_GENERATION_SYSTEM_PROMPT,
  buildSingleLessonTSXPrompt,
  buildTSXGenerationUserPrompt,
} from '../lib/prompts/tsx-generation.prompts';
import { createAIModel } from '../lib/services/adapters/llm-config';
import { generateSingleLessonTSX, generateTSX } from '../lib/services/adapters/tsx-generator-core';
import { logger } from '../lib/services/logger';
import type { ActionableBlocksResult } from '../lib/types/actionable-blocks.types';
import type { SingleLessonTSXInput, TSXGenerationInput, TSXGenerationResult } from '../lib/types/tsx-generation.types';
import { SingleLessonTSXResultSchema, TSXGenerationResultSchema } from '../lib/types/tsx-generation.types';
import { createOllamaHealthCheck } from '../lib/utils/ollama-health-check';

/**
 * Sample blocks result for testing
 * Simulates output from blocks generation stage with structured blocks
 */
const SAMPLE_BLOCKS: ActionableBlocksResult = {
  lessons: [
    {
      title: 'Introduction to Photosynthesis',
      blocks: [
        {
          type: 'text',
          content:
            '**What is photosynthesis?** Plants make their own food using sunlight, like having a kitchen inside their leaves.',
        },
        {
          type: 'image',
          format: 'svg',
          content:
            'A simple diagram of a plant showing: sunlight rays from top pointing to leaves, water droplets with arrows from roots going up, CO2 molecules from air with arrows pointing to leaves, and O2 molecules with arrows leaving the leaves',
          alt: 'Diagram showing photosynthesis inputs (sunlight, water, CO2) and output (oxygen)',
          caption: 'How plants make food from light',
        },
        {
          type: 'text',
          content:
            '**Three ingredients plants need:** Sunlight from the sun, water from soil (through roots), and carbon dioxide (CO2) from the air we breathe out.',
        },
      ],
    },
    {
      title: 'The Process and Importance',
      blocks: [
        {
          type: 'text',
          content:
            '**The recipe:** Plants combine sunlight + water + CO2 to create sugar (their food) and release oxygen as a byproduct.',
        },
        {
          type: 'interaction',
          interactionType: 'quiz',
          prompt: 'What do plants produce during photosynthesis?',
          metadata: {
            options: ['Sugar and oxygen', 'Only sugar', 'Only oxygen', 'Water and CO2'],
            answer: 'Sugar and oxygen',
          },
        },
        {
          type: 'text',
          content:
            "**Why it matters to us:** Plants feed themselves AND make oxygen for us to breathe. Without photosynthesis, we wouldn't have breathable air!",
        },
      ],
    },
  ],
  metadata: {
    originalOutline: 'Create a lesson on photosynthesis for 5th graders',
    topic: 'Photosynthesis',
    domains: ['science', 'biology', 'plants'],
    ageRange: [10, 11],
    complexity: 'moderate',
    totalBlockCount: 6,
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

    // Parse imports from TSX code for validation
    const importMatches = lesson.tsxCode.match(/import .+ from ['"]([^'"]+)['"]/g) || [];
    const imports = importMatches
      .map((imp) => {
        const match = imp.match(/from ['"]([^'"]+)['"]/);
        return match ? match[1] : '';
      })
      .filter(Boolean);

    // Import validation (Phase 2)
    if (imports.length > 0) {
      const allowedImports = [
        'lucide-react',
        '@radix-ui/react-checkbox',
        '@radix-ui/react-accordion',
        '@radix-ui/react-label',
        'clsx',
        'tailwind-merge',
      ];
      const blockedImports = ['next/link', 'next/navigation', 'next/router', '@supabase/supabase-js', '@supabase/ssr'];

      imports.forEach((importPath) => {
        if (blockedImports.includes(importPath)) {
          errors.push(`Lesson ${idx + 1}: Uses blocked import "${importPath}" (navigation/database not allowed)`);
        } else if (!allowedImports.includes(importPath)) {
          logger.info(
            `   ⚠️  Lesson ${idx + 1}: Uses non-whitelisted import "${importPath}" (may need to add to whitelist)`,
          );
        }
      });
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
const runTest = async (verbose: boolean = false): Promise<TestResult> => {
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

    const modelName = process.env.CODE_GENERATION_MODEL || 'qwen2.5-coder';
    const model = createAIModel(modelName);

    const result = await generateTSX(input, {
      model,
      systemPrompt: TSX_GENERATION_SYSTEM_PROMPT,
      buildUserPrompt: buildTSXGenerationUserPrompt,
      temperature: 0.4,
    });

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

      // Get original blocks count from input
      const originalLesson = SAMPLE_BLOCKS.lessons[idx];
      if (originalLesson) {
        logger.info(`      Original Blocks: ${originalLesson.blocks.length}`);
      }

      logger.info(`      TSX Length: ${lesson.tsxCode.length} characters`);

      // Parse imports from TSX code
      const importMatches = lesson.tsxCode.match(/import .+ from ['"]([^'"]+)['"]/g) || [];
      const imports = importMatches
        .map((imp) => {
          const match = imp.match(/from ['"]([^'"]+)['"]/);
          return match ? match[1] : '';
        })
        .filter(Boolean);

      if (imports.length > 0) {
        logger.info(`      Imports: ${imports.join(', ')}`);
      } else {
        logger.info(`      Imports: None`);
      }

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
 * Run single-lesson TSX generation test
 * Tests the sequential generation approach used by the actor machine
 */
const runSingleLessonTest = async (verbose: boolean = false): Promise<TestResult> => {
  logger.info('─'.repeat(80));
  logger.info('📝 Test: Single-Lesson TSX Generation (Sequential)');
  logger.info(`   Testing first lesson from sample: ${SAMPLE_BLOCKS.lessons[0].title}`);
  logger.info(`   Blocks: ${SAMPLE_BLOCKS.lessons[0].blocks.length}`);

  try {
    const input: SingleLessonTSXInput = {
      title: SAMPLE_BLOCKS.lessons[0].title,
      blocks: SAMPLE_BLOCKS.lessons[0].blocks,
      context: {
        topic: SAMPLE_BLOCKS.metadata.topic,
        ageRange: SAMPLE_BLOCKS.metadata.ageRange,
        complexity: SAMPLE_BLOCKS.metadata.complexity,
        domains: SAMPLE_BLOCKS.metadata.domains,
      },
    };

    const modelName = process.env.CODE_GENERATION_MODEL || 'qwen2.5-coder';
    const model = createAIModel(modelName);

    const result = await generateSingleLessonTSX(input, {
      model,
      systemPrompt: TSX_GENERATION_SYSTEM_PROMPT,
      buildUserPrompt: buildSingleLessonTSXPrompt,
      temperature: 0.4,
    });

    // Schema validation
    try {
      SingleLessonTSXResultSchema.parse(result);
      logger.info('\n   ✅ Schema validation: PASSED');
    } catch (error) {
      logger.info('\n   ❌ Schema validation: FAILED');
      return {
        passed: false,
        errors: [`Schema validation failed: ${error instanceof Error ? error.message : String(error)}`],
      };
    }

    // Basic validation
    const errors: string[] = [];

    if (!result.tsxCode || result.tsxCode.length < 50) {
      errors.push('TSX code too short');
    }

    if (!result.tsxCode.includes('export')) {
      errors.push('TSX code missing export statement');
    }

    if (!result.tsxCode.includes('return') && !result.tsxCode.includes('=>')) {
      errors.push("TSX code doesn't appear to be a valid React component");
    }

    if (!result.tsxCode.includes('LessonComponent')) {
      errors.push('TSX code must export LessonComponent');
    }

    logger.info(`\n   📄 Lesson: ${input.title}`);
    logger.info(`      Component Name: LessonComponent (expected)`);
    logger.info(`      TSX Length: ${result.tsxCode.length} characters`);
    logger.info(`      Original Blocks: ${input.blocks.length}`);

    // Parse imports from TSX code
    const importMatches = result.tsxCode.match(/import .+ from ['"]([^'"]+)['"]/g) || [];
    const imports = importMatches
      .map((imp) => {
        const match = imp.match(/from ['"]([^'"]+)['"]/);
        return match ? match[1] : '';
      })
      .filter(Boolean);

    if (imports.length > 0) {
      logger.info(`      Imports: ${imports.join(', ')}`);
    } else {
      logger.info(`      Imports: None`);
    }

    if (verbose) {
      logger.info('\n      === Generated TSX ===');
      logger.info(result.tsxCode);
      logger.info('      ' + '='.repeat(40));
    } else {
      const preview = result.tsxCode.substring(0, 200).replace(/\n/g, ' ').trim();
      logger.info(`      Preview: ${preview}...`);
    }

    if (errors.length === 0) {
      logger.info('\n   ✅ TEST PASSED');
      return {
        passed: true,
        errors: [],
      };
    } else {
      logger.info('\n   ❌ TEST FAILED');
      errors.forEach((error) => {
        logger.info(`      - ${error}`);
      });
      return {
        passed: false,
        errors,
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
const runTests = async (verbose: boolean = false, singleOnly: boolean = false): Promise<void> => {
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
  const modelToUse = process.env.CODE_GENERATION_MODEL || 'llama3.1';
  logger.info(`\n📦 Using model: ${modelToUse}`);
  logger.info('   💡 Recommended: deepseek-coder-v2 for best TSX generation');
  logger.info('      Run: ollama pull deepseek-coder-v2');
  logger.info('      Then set: CODE_GENERATION_MODEL=deepseek-coder-v2');

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
  logger.info('🧪 Running TSX generation tests...\n');

  const results: TestResult[] = [];

  if (singleOnly) {
    // Only run single-lesson test
    logger.info('   (Running single-lesson test only)\n');
    const singleResult = await runSingleLessonTest(verbose);
    results.push(singleResult);
  } else {
    // Run both batch and single-lesson tests
    logger.info('   (Running both batch and single-lesson tests)\n');
    const batchResult = await runTest(verbose);
    results.push(batchResult);

    logger.info('\n');
    const singleResult = await runSingleLessonTest(verbose);
    results.push(singleResult);
  }

  // Summary
  logger.info('\n' + '='.repeat(80));

  const allPassed = results.every((r) => r.passed);
  const passedCount = results.filter((r) => r.passed).length;

  if (allPassed) {
    logger.info(`\n🎉 All tests passed! (${passedCount}/${results.length})\n`);
  } else {
    logger.info(`\n⚠️  Some tests failed (${passedCount}/${results.length} passed)`);
    logger.info('   This may be due to:');
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
  logger.info('   💡 Tip: Run with --single to test only single-lesson generation');
  logger.info('');
};

/**
 * Main execution
 */
const main = async (): Promise<void> => {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const verbose = args.includes('-v') || args.includes('--verbose');
  const singleOnly = args.includes('--single');

  try {
    await runTests(verbose, singleOnly);
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
