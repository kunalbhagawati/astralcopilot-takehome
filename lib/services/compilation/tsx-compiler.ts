/**
 * TSX Compiler
 *
 * Compiles TypeScript/TSX code to JavaScript using TypeScript compiler.
 * Strips type annotations and transforms JSX to React.createElement calls.
 *
 * Uses TypeScript Compiler API - https://www.typescriptlang.org/docs/handbook/compiler-options.html
 */

import ts from 'typescript';
import { logger } from '../logger';

/**
 * Compile TSX code to JavaScript
 *
 * Uses ts.transpileModule() for fast, isolated transpilation.
 * Does not perform type checking (validation should be done separately).
 *
 * Configuration:
 * - Target: ES2020 (modern JavaScript)
 * - Module: ESNext (ES modules)
 * - JSX: React (classic React.createElement transform)
 *
 * @param tsxCode - The TSX code to compile
 * @returns Compiled JavaScript code
 * @throws Error if compilation fails
 */
export const compileTSX = (tsxCode: string): string => {
  try {
    logger.info('Compiling TSX to JavaScript...');

    // Transpile TypeScript/TSX to JavaScript
    const result = ts.transpileModule(tsxCode, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2020,
        module: ts.ModuleKind.ESNext,
        jsx: ts.JsxEmit.React,
        esModuleInterop: true,
        skipLibCheck: true,
        // Don't emit declarations or source maps
        declaration: false,
        declarationMap: false,
        sourceMap: false,
        // Remove comments for smaller output
        removeComments: true,
      },
    });

    if (!result.outputText) {
      throw new Error('Compilation produced no output');
    }

    logger.info('TSX compilation successful');
    return result.outputText;
  } catch (error) {
    logger.error('Error during TSX compilation:', error);
    throw new Error(`Failed to compile TSX: ${error instanceof Error ? error.message : 'Unknown compilation error'}`);
  }
};
