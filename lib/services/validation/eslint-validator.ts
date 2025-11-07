/**
 * ESLint Validator
 *
 * Validates TSX code using ESLint programmatic API.
 * Returns structured validation errors for LLM retry feedback.
 *
 * Uses ESLint v9.x - https://eslint.org/docs/latest/integrate/nodejs-api
 */

import { ESLint } from 'eslint';
import type { TSXValidationError } from '@/lib/types/validation.types';
import { createValidationTemplate } from './typescript-validator';

/**
 * Validate TSX code using ESLint
 *
 * Wraps code in template (same as TypeScript validator) and runs ESLint.
 * Uses project's existing ESLint configuration.
 *
 * @param tsxCode - The TSX code to validate
 * @returns Array of validation errors (empty if valid)
 */
export const validateWithESLint = async (tsxCode: string): Promise<TSXValidationError[]> => {
  // Wrap code in template with necessary imports (same template as TypeScript)
  const fullCode = createValidationTemplate(tsxCode);

  // Create ESLint instance with project configuration
  const eslint = new ESLint({
    overrideConfigFile: 'eslint.config.mjs',
    // Run on virtual file in memory
    cwd: process.cwd(),
  });

  // Lint the code
  const results = await eslint.lintText(fullCode, {
    filePath: 'virtual-lesson.tsx',
  });

  // Convert ESLint results to our error format
  const errors: TSXValidationError[] = [];

  for (const result of results) {
    for (const message of result.messages) {
      // Skip warnings unless they're critical
      // (ESLint warnings often don't block code execution)
      if (message.severity === 1) {
        continue; // Skip warnings
      }

      errors.push({
        type: 'eslint',
        severity: message.severity === 2 ? 'error' : 'warning',
        line: message.line,
        column: message.column,
        message: message.message,
        rule: message.ruleId ?? undefined,
      });
    }
  }

  return errors;
};
