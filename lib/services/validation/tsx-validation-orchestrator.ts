/**
 * TSX Validation Orchestrator
 *
 * Combines TypeScript compiler validation and ESLint validation
 * into a single validation result.
 *
 * Runs TypeScript validation first (fail fast on syntax errors),
 * then runs ESLint if TypeScript passes.
 */

import type { TSXValidationResult } from '@/lib/types/validation.types';
import { logger } from '../logger';
import { validateWithESLint } from './eslint-validator';
import { validateWithTypeScript } from './typescript-validator';

/**
 * Validate TSX code using both TypeScript compiler and ESLint
 *
 * Strategy:
 * 1. Run TypeScript validation first (fail fast on type/syntax errors)
 * 2. If TypeScript passes, run ESLint validation
 * 3. Combine all errors into single result
 *
 * @param tsxCode - The TSX code to validate
 * @returns Validation result with combined errors from both validators
 */
export const validateTSX = async (tsxCode: string): Promise<TSXValidationResult> => {
  const allErrors: TSXValidationResult['errors'] = [];

  try {
    // Step 1: TypeScript validation (synchronous)
    logger.info('Running TypeScript validation...');
    const tsErrors = validateWithTypeScript(tsxCode);

    if (tsErrors.length > 0) {
      logger.warn(`TypeScript validation found ${tsErrors.length} error(s)`);
      allErrors.push(...tsErrors);

      // If TypeScript has errors, skip ESLint (no point linting broken code)
      return {
        valid: false,
        errors: allErrors,
      };
    }

    logger.info('TypeScript validation passed');

    // Step 2: ESLint validation (asynchronous)
    logger.info('Running ESLint validation...');
    const eslintErrors = await validateWithESLint(tsxCode);

    if (eslintErrors.length > 0) {
      logger.warn(`ESLint validation found ${eslintErrors.length} error(s)`);
      allErrors.push(...eslintErrors);
    } else {
      logger.info('ESLint validation passed');
    }

    // Validation passes if no errors from either validator
    return {
      valid: allErrors.length === 0,
      errors: allErrors,
    };
  } catch (error) {
    // System error during validation (not a validation failure)
    logger.error('Error during TSX validation:', error);

    // Return validation failure with system error message
    return {
      valid: false,
      errors: [
        {
          type: 'typescript',
          severity: 'error',
          line: 1,
          column: 1,
          message: error instanceof Error ? error.message : 'Unknown validation system error',
        },
      ],
    };
  }
};
