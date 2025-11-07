/**
 * TSX Compiler
 *
 * Compiles TypeScript/TSX code to JavaScript using TypeScript compiler.
 * Strips type annotations and transforms JSX to React.createElement calls.
 *
 * Uses TypeScript Compiler API - https://www.typescriptlang.org/docs/handbook/compiler-options.html
 */

import ts from 'typescript';
import { promises as fs } from 'fs';
import path from 'path';
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

/**
 * Compile TSX and write both source and compiled files to disk
 *
 * Creates directory structure: ./tmp/generated/{lessonId}/
 * Writes two files:
 * - page.tsx (component source - internal naming convention)
 * - page.js (compiled JavaScript)
 *
 * @param tsxCode - The TSX component code to compile
 * @param lessonId - The lesson ID (used for directory name)
 * @returns Object with paths to both files
 * @throws Error if compilation or file writing fails
 */
export const compileAndWriteTSX = async (
  tsxCode: string,
  lessonId: string,
): Promise<{ tsxPath: string; jsPath: string }> => {
  try {
    // Create output directory
    const outputDir = path.join(process.cwd(), 'tmp', 'generated', lessonId);
    await fs.mkdir(outputDir, { recursive: true });
    logger.info(`Created directory: ${outputDir}`);

    // Write TSX source file
    const tsxPath = path.join(outputDir, 'page.tsx');
    await fs.writeFile(tsxPath, tsxCode, 'utf-8');
    logger.info(`Wrote TSX source: ${tsxPath}`);

    // Compile to JavaScript
    const compiledJS = compileTSX(tsxCode);

    // Write compiled JS file
    const jsPath = path.join(outputDir, 'page.js');
    await fs.writeFile(jsPath, compiledJS, 'utf-8');
    logger.info(`Wrote compiled JS: ${jsPath}`);

    return { tsxPath, jsPath };
  } catch (error) {
    logger.error('Error during compile and write:', error);
    throw new Error(`Failed to compile and write TSX: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};
