/**
 * Import parser and validator for Phase 2 dynamic imports
 *
 * Parses import statements from compiled JavaScript code and validates them
 * against the whitelist of allowed imports.
 *
 * Reference: docs/dynamic-imports-strategy.md
 */

import { getBlockedImportMessage, isAllowedImport } from '@/lib/config/allowed-imports';

/**
 * Represents a parsed import declaration
 */
export interface ImportDeclaration {
  /** The import source/path (e.g., 'lucide-react', '@radix-ui/react-checkbox') */
  source: string;
  /** Named imports (e.g., ['CheckCircle', 'XCircle'] from import { CheckCircle, XCircle } from '...') */
  namedImports: string[];
  /** Default import name (e.g., 'React' from import React from 'react') */
  defaultImport?: string;
  /** Namespace import name (e.g., 'R' from import * as R from 'ramda') */
  namespaceImport?: string;
  /** The full original import statement */
  rawStatement: string;
}

/**
 * Parse import statements from JavaScript code
 *
 * Extracts all import declarations using regex patterns.
 * Handles:
 * - Named imports: import { a, b } from 'module'
 * - Default imports: import React from 'react'
 * - Namespace imports: import * as R from 'ramda'
 * - Mixed imports: import React, { useState } from 'react'
 *
 * @param code - Compiled JavaScript code
 * @returns Array of parsed import declarations
 */
export const parseImports = (code: string): ImportDeclaration[] => {
  const imports: ImportDeclaration[] = [];

  // Regex to match import statements
  // Handles: import { a, b } from 'module'; import * as X from 'module'; import Default from 'module'
  const importRegex =
    /import\s+(?:(?:(\w+)\s*,\s*)?(?:\{([^}]+)\}|\*\s+as\s+(\w+))\s+from\s+['"]([^'"]+)['"]|(\w+)\s+from\s+['"]([^'"]+)['"])/g;

  let match;
  while ((match = importRegex.exec(code)) !== null) {
    const [rawStatement, defaultWithNamed, namedList, namespace, sourceWithSpecifiers, defaultOnly, sourceDefaultOnly] =
      match;

    const source = sourceWithSpecifiers || sourceDefaultOnly;
    const namedImports: string[] = [];
    let defaultImport: string | undefined;
    let namespaceImport: string | undefined;

    // Handle named imports
    if (namedList) {
      namedImports.push(
        ...namedList
          .split(',')
          .map((name) => name.trim())
          .filter(Boolean),
      );
    }

    // Handle default import
    if (defaultWithNamed) {
      defaultImport = defaultWithNamed;
    } else if (defaultOnly) {
      defaultImport = defaultOnly;
    }

    // Handle namespace import
    if (namespace) {
      namespaceImport = namespace;
    }

    imports.push({
      source,
      namedImports,
      defaultImport,
      namespaceImport,
      rawStatement,
    });
  }

  return imports;
};

/**
 * Validation error for imports
 */
export interface ImportValidationError {
  /** The import source that failed validation */
  source: string;
  /** Error message explaining why validation failed */
  message: string;
  /** The original import statement */
  rawStatement: string;
}

/**
 * Result of import validation
 */
export interface ImportValidationResult {
  /** Whether all imports are valid */
  valid: boolean;
  /** Array of validation errors (empty if valid) */
  errors: ImportValidationError[];
  /** Array of valid imports that passed validation */
  validImports: ImportDeclaration[];
}

/**
 * Validate imports against the whitelist
 *
 * Checks each parsed import declaration to ensure its source is in the
 * allowed imports list. Returns validation result with errors for any
 * non-whitelisted imports.
 *
 * @param imports - Array of parsed import declarations
 * @returns Validation result with any errors
 */
export const validateImports = (imports: ImportDeclaration[]): ImportValidationResult => {
  const errors: ImportValidationError[] = [];
  const validImports: ImportDeclaration[] = [];

  for (const imp of imports) {
    if (!isAllowedImport(imp.source)) {
      errors.push({
        source: imp.source,
        message: getBlockedImportMessage(imp.source),
        rawStatement: imp.rawStatement,
      });
    } else {
      validImports.push(imp);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    validImports,
  };
};

/**
 * Parse and validate imports in one step
 *
 * Convenience function that parses imports from code and immediately validates them.
 *
 * @param code - Compiled JavaScript code
 * @returns Validation result
 */
export const parseAndValidateImports = (code: string): ImportValidationResult => {
  const imports = parseImports(code);
  return validateImports(imports);
};

/**
 * Extract unique import sources from code
 *
 * Returns just the list of unique module names being imported,
 * useful for tracking which libraries a lesson uses.
 *
 * @param code - Compiled JavaScript code
 * @returns Array of unique import sources
 */
export const extractImportSources = (code: string): string[] => {
  const imports = parseImports(code);
  const sources = new Set(imports.map((imp) => imp.source));
  return Array.from(sources);
};
