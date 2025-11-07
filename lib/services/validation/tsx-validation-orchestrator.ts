/**
 * TSX Validation Orchestrator
 *
 * Combines TypeScript compiler validation, import validation, and ESLint validation
 * into a single validation result.
 *
 * Runs validations in order:
 * 1. TypeScript validation (fail fast on syntax errors)
 * 2. Import validation (check whitelist)
 * 3. ESLint validation (code quality)
 */

import type { TSXValidationResult } from '@/lib/types/validation.types';
import { parseAndValidateImports } from '../imports/import-parser';
import { logger } from '../logger';
import { validateWithESLint } from './eslint-validator';
import { validateWithTypeScript } from './typescript-validator';

/**
 * Validate TSX code using TypeScript, import whitelist, and ESLint
 *
 * Strategy:
 * 1. Run TypeScript validation first (fail fast on type/syntax errors)
 * 2. If TypeScript passes, validate imports against whitelist
 * 3. If imports pass, run ESLint validation
 * 4. Combine all errors into single result
 *
 * @param tsxCode - The TSX code to validate
 * @returns Validation result with combined errors from all validators
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

      // If TypeScript has errors, skip remaining validation (no point checking broken code)
      return {
        valid: false,
        errors: allErrors,
      };
    }

    logger.info('TypeScript validation passed');

    // Step 2: Import validation (synchronous)
    logger.info('Running import validation...');
    const importValidation = parseAndValidateImports(tsxCode);

    if (!importValidation.valid) {
      logger.warn(`Import validation found ${importValidation.errors.length} error(s)`);

      // Convert import errors to TSXValidationError format
      const importErrors = importValidation.errors.map((err) => ({
        type: 'typescript' as const,
        severity: 'error' as const,
        line: 1,
        column: 1,
        message: `Import validation failed: ${err.source} - ${err.message}`,
      }));

      allErrors.push(...importErrors);

      // If imports are invalid, skip ESLint
      return {
        valid: false,
        errors: allErrors,
      };
    }

    logger.info('Import validation passed');

    // Step 3: ESLint validation (asynchronous)
    logger.info('Running ESLint validation...');
    const eslintErrors = await validateWithESLint(tsxCode);

    if (eslintErrors.length > 0) {
      logger.warn(`ESLint validation found ${eslintErrors.length} error(s)`);
      allErrors.push(...eslintErrors);
    } else {
      logger.info('ESLint validation passed');
    }

    // Validation passes if no errors from any validator
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
