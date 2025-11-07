/**
 * TypeScript Compiler Validator
 *
 * Validates TSX code using TypeScript Compiler API.
 * Returns structured validation errors for LLM retry feedback.
 *
 * Uses TypeScript Compiler API v5.x - https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API
 */

import ts from 'typescript';
import type { TSXValidationError } from '@/lib/types/validation.types';

/**
 * Template for wrapping generated TSX code in a complete TypeScript file
 *
 * Provides necessary imports and context for type checking.
 * Only imports React namespace to avoid unused import errors.
 * With React 17+ JSX transform, explicit React import not needed for JSX,
 * but types are still needed for TypeScript validation.
 *
 * @param tsxCode - The TSX component code to validate
 * @returns Complete TypeScript file content
 */
export const createValidationTemplate = (tsxCode: string): string => {
  // Note: With jsx: "react-jsx", we don't need to import React for JSX
  // But we may need it for types - let the code import what it needs
  return `${tsxCode}
`;
};

/**
 * Validate TSX code using TypeScript Compiler API
 *
 * Creates a virtual TypeScript program with the code wrapped in a template,
 * runs type checking, and returns structured errors.
 *
 * @param tsxCode - The TSX code to validate
 * @returns Array of validation errors (empty if valid)
 */
export const validateWithTypeScript = (tsxCode: string): TSXValidationError[] => {
  // Wrap code in template with necessary imports
  const fullCode = createValidationTemplate(tsxCode);

  // Create virtual source file
  const sourceFile = ts.createSourceFile(
    'virtual-lesson.tsx',
    fullCode,
    ts.ScriptTarget.ES2020,
    true,
    ts.ScriptKind.TSX,
  );

  // Configure compiler options to match project's tsconfig.json
  const compilerOptions: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2017,
    module: ts.ModuleKind.ESNext,
    jsx: ts.JsxEmit.ReactJSX, // React 17+ automatic JSX runtime
    strict: true,
    esModuleInterop: true,
    skipLibCheck: true,
    forceConsistentCasingInFileNames: true,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    lib: ['DOM', 'DOM.Iterable', 'ESNext'],
    resolveJsonModule: true,
    isolatedModules: true,
  };

  // Create compiler host that uses real filesystem for node_modules
  // but virtual file for our TSX code
  const defaultHost = ts.createCompilerHost(compilerOptions);

  const host: ts.CompilerHost = {
    ...defaultHost,
    getSourceFile: (fileName, languageVersion) => {
      if (fileName === 'virtual-lesson.tsx') {
        return sourceFile;
      }
      // Use default host for all other files (includes node_modules/@types)
      return defaultHost.getSourceFile(fileName, languageVersion);
    },
    fileExists: (fileName) => {
      if (fileName === 'virtual-lesson.tsx') {
        return true;
      }
      return defaultHost.fileExists(fileName);
    },
    readFile: (fileName) => {
      if (fileName === 'virtual-lesson.tsx') {
        return fullCode;
      }
      return defaultHost.readFile(fileName);
    },
  };

  // Create program
  const program = ts.createProgram(['virtual-lesson.tsx'], compilerOptions, host);

  // Get all diagnostics (syntax, semantic, and declaration errors)
  const diagnostics = ts.getPreEmitDiagnostics(program);

  // Convert TypeScript diagnostics to our error format
  const errors: TSXValidationError[] = diagnostics
    .filter((diagnostic) => diagnostic.file?.fileName === 'virtual-lesson.tsx')
    .map((diagnostic): TSXValidationError => {
      const { line, character } = diagnostic.file!.getLineAndCharacterOfPosition(diagnostic.start!);

      return {
        type: 'typescript',
        severity: diagnostic.category === ts.DiagnosticCategory.Error ? 'error' : 'warning',
        line: line + 1, // Convert to 1-indexed
        column: character + 1, // Convert to 1-indexed
        message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
        code: diagnostic.code,
      };
    });

  return errors;
};
