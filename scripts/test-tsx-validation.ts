/**
 * Test script for TSX validation logic
 *
 * Tests the validation used in outline-request.actor-machine.ts:
 * - TypeScript compiler validation
 * - ESLint validation - DISABLED for generated files
 * - Combined validation orchestrator
 *
 * Run: bun run scripts/test-tsx-validation.ts
 * Run with verbose output: bun run scripts/test-tsx-validation.ts -v
 */

import { validateTSX } from '../lib/services/validation/tsx-validation-orchestrator';
import { validateWithTypeScript } from '../lib/services/validation/typescript-validator';
// import { validateWithESLint } from '../lib/services/validation/eslint-validator';
import type { TSXValidationResult, TSXValidationError } from '../lib/types/validation.types';
import { TSX_VALIDATION_FIXTURES } from './fixtures/tsx-validation.fixtures';

/**
 * Console logger for test output
 * Using console.log instead of logger service (which only outputs to files)
 */
const log = console.log;

// Alias for backward compatibility
const FIXTURES = TSX_VALIDATION_FIXTURES;

/**
 * Test case definition
 */
interface TestCase {
  name: string;
  fixture: string;
  expectedValid: boolean;
  expectedErrorTypes?: ('typescript' | 'eslint')[];
  description: string;
}

/**
 * Test cases to run
 */
const TEST_CASES: TestCase[] = [
  {
    name: 'Valid Component',
    fixture: FIXTURES.validComponent,
    expectedValid: true,
    description: 'Complete valid React component with Tailwind CSS',
  },
  {
    name: 'Type Error (undefined)',
    fixture: FIXTURES.typeError,
    expectedValid: false,
    expectedErrorTypes: ['typescript'],
    description: 'Calling method on possibly undefined value',
  },
  {
    name: 'Missing Export',
    fixture: FIXTURES.noExport,
    expectedValid: true, // ESLint disabled - only checking compilation
    // expectedErrorTypes: ['eslint'],
    description: 'Component without export statement (ESLint disabled - compilation passes)',
  },
  {
    name: 'Syntax Error (unclosed tag)',
    fixture: FIXTURES.syntaxError,
    expectedValid: false,
    expectedErrorTypes: ['typescript'],
    description: 'Invalid JSX syntax with unclosed tag',
  },
  {
    name: 'Type Error (JSX element)',
    fixture: FIXTURES.typeErrorJSX,
    expectedValid: false,
    expectedErrorTypes: ['typescript'],
    description: 'Assigning JSX element to wrong type',
  },
  {
    name: 'Prop Type Errors',
    fixture: FIXTURES.propTypeError,
    expectedValid: false,
    expectedErrorTypes: ['typescript'],
    description: 'Multiple prop type assignment errors',
  },
  {
    name: 'Unused Variables',
    fixture: FIXTURES.unusedVars,
    expectedValid: true, // ESLint disabled - only checking compilation
    // expectedErrorTypes: ['eslint'],
    description: 'Unused variables (ESLint disabled - compilation passes)',
  },
  {
    name: 'Valid Component with Allowed Imports',
    fixture: FIXTURES.validComponentWithImports,
    expectedValid: true,
    description: 'Component using lucide-react, @radix-ui, and clsx (all whitelisted imports)',
  },
  {
    name: 'Blocked Import (next/link)',
    fixture: FIXTURES.blockedImportNavigation,
    expectedValid: false,
    expectedErrorTypes: ['typescript'], // Import validation errors reported as typescript type
    description: 'Component using next/link which is explicitly blocked (no navigation allowed)',
  },
  {
    name: 'Blocked Import (@supabase)',
    fixture: FIXTURES.blockedImportDatabase,
    expectedValid: false,
    expectedErrorTypes: ['typescript'], // Import validation errors reported as typescript type
    description: 'Component using @supabase/supabase-js which is explicitly blocked (no database access)',
  },
  {
    name: 'Duplicate Declaration',
    fixture: FIXTURES.duplicateDeclaration,
    expectedValid: false,
    expectedErrorTypes: ['typescript'],
    description: 'Component name declared twice (const then export) - common LLM mistake',
  },
  {
    name: 'Missing Module Import',
    fixture: FIXTURES.missingModuleImport,
    expectedValid: false,
    expectedErrorTypes: ['typescript'],
    description: 'Imports non-existent local module ./QuizComponent - common LLM mistake',
  },
  {
    name: 'Infinite Loop (Self-Reference)',
    fixture: FIXTURES.infiniteLoop,
    expectedValid: true, // TypeScript doesn't catch runtime infinite loops
    description: 'Component calls itself - valid TypeScript but causes runtime error',
  },
  {
    name: 'Missing React Import',
    fixture: FIXTURES.missingReactImport,
    expectedValid: true, // Valid in React 17+ with new JSX transform
    description: 'JSX without React import (valid with React 17+ JSX transform)',
  },
  {
    name: 'LLM Generated Buggy Code',
    fixture: FIXTURES.llmGeneratedBuggy,
    expectedValid: false,
    expectedErrorTypes: ['typescript'],
    description: 'Real LLM output: duplicate declaration + missing import + self-reference',
  },
];

/**
 * Test result
 */
interface TestResult {
  testName: string;
  passed: boolean;
  validationResult: TSXValidationResult;
  expectedValid: boolean;
  actualValid: boolean;
  errorCount: number;
  errors: string[];
}

/**
 * Run a single test case
 */
const runTestCase = async (testCase: TestCase, verbose: boolean): Promise<TestResult> => {
  log(`\n${'─'.repeat(80)}`);
  log(`📝 Test: ${testCase.name}`);
  log(`   Description: ${testCase.description}`);
  log(`   Expected: ${testCase.expectedValid ? '✅ Valid' : '❌ Invalid'}`);

  // Run validation
  const validationResult = await validateTSX(testCase.fixture);

  const passed = validationResult.valid === testCase.expectedValid;

  // Log results
  log(`   Actual: ${validationResult.valid ? '✅ Valid' : '❌ Invalid'}`);
  log(`   Errors Found: ${validationResult.errors.length}`);

  if (validationResult.errors.length > 0) {
    log(`\n   📋 Validation Errors:`);
    validationResult.errors.forEach((error: TSXValidationError, idx: number) => {
      log(`      ${idx + 1}. [${error.type}] Line ${error.line}:${error.column} - ${error.message}`);
      if (error.code) {
        log(`         Code: ${error.code}`);
      }
      if (error.rule) {
        log(`         Rule: ${error.rule}`);
      }
    });
  }

  if (verbose && !passed) {
    log(`\n   📄 Code Sample:`);
    const lines = testCase.fixture.split('\n');
    lines.slice(0, 10).forEach((line: string, idx: number) => {
      log(`      ${idx + 1}: ${line}`);
    });
    if (lines.length > 10) {
      log(`      ... (${lines.length - 10} more lines)`);
    }
  }

  log(`\n   ${passed ? '✅ TEST PASSED' : '❌ TEST FAILED'}`);

  return {
    testName: testCase.name,
    passed,
    validationResult,
    expectedValid: testCase.expectedValid,
    actualValid: validationResult.valid,
    errorCount: validationResult.errors.length,
    errors: validationResult.errors.map((e: TSXValidationError) => e.message),
  };
};

/**
 * Run individual validator tests
 */
const runIndividualValidatorTests = async (): Promise<void> => {
  log(`\n${'═'.repeat(80)}`);
  log('🔬 Individual Validator Tests');
  log('═'.repeat(80));

  // Test TypeScript validator independently
  log('\n📘 TypeScript Validator Test');
  log('─'.repeat(80));

  const tsErrors = validateWithTypeScript(FIXTURES.typeError);
  log(`   Errors found: ${tsErrors.length}`);
  if (tsErrors.length > 0) {
    tsErrors.forEach((error: TSXValidationError, idx: number) => {
      log(`   ${idx + 1}. Line ${error.line}:${error.column} - ${error.message}`);
    });
  }

  // Test ESLint validator independently - DISABLED for generated files
  // log('\n📗 ESLint Validator Test');
  // log('─'.repeat(80));
  //
  // const eslintErrors = await validateWithESLint(FIXTURES.validComponent);
  // log(`   Errors found: ${eslintErrors.length}`);
  // if (eslintErrors.length > 0) {
  //   eslintErrors.forEach((error: TSXValidationError, idx: number) => {
  //     log(`   ${idx + 1}. Line ${error.line}:${error.column} - ${error.message}`);
  //   });
  // }
};

/**
 * Run all tests
 */
const runTests = async (verbose: boolean): Promise<void> => {
  log('🚀 Starting TSX Validation Tests');
  if (verbose) {
    log('   (Verbose mode: showing detailed error info)');
  }
  log('\n' + '═'.repeat(80));

  // Run individual validator tests first
  if (verbose) {
    await runIndividualValidatorTests();
  }

  // Run orchestrator tests
  log(`\n${'═'.repeat(80)}`);
  log('🎭 Orchestrator Tests (TypeScript only - ESLint disabled)');
  log('═'.repeat(80));

  const results: TestResult[] = [];

  for (const testCase of TEST_CASES) {
    const result = await runTestCase(testCase, verbose);
    results.push(result);
  }

  // Summary
  log(`\n${'═'.repeat(80)}`);
  log('📊 Test Summary');
  log('═'.repeat(80));

  const passedCount = results.filter((r: TestResult) => r.passed).length;
  const failedCount = results.filter((r: TestResult) => !r.passed).length;

  log(`\n   Total Tests: ${results.length}`);
  log(`   ✅ Passed: ${passedCount}`);
  log(`   ❌ Failed: ${failedCount}`);

  if (failedCount > 0) {
    log(`\n   Failed Tests:`);
    results
      .filter((r: TestResult) => !r.passed)
      .forEach((r: TestResult) => {
        log(`      - ${r.testName}`);
        log(`        Expected: ${r.expectedValid ? 'valid' : 'invalid'}`);
        log(`        Got: ${r.actualValid ? 'valid' : 'invalid'}`);
      });
  }

  log(`\n${'═'.repeat(80)}`);

  if (passedCount === results.length) {
    log('\n🎉 All tests passed!\n');
  } else {
    log(`\n⚠️  ${failedCount} test(s) failed\n`);
  }

  log('💡 Note: This tests the same validation logic used in outline-request-pipeline.ts');
  if (!verbose) {
    log('💡 Tip: Run with -v or --verbose for detailed validator tests and error info');
  }
  log('');
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
  main().catch((error) => console.error(error));
}
