/**
 * Import transformer for Phase 2 dynamic imports
 *
 * Transforms ES6 import statements into module access patterns that can be
 * used in the Function constructor with a __modules context object.
 *
 * Example transformation:
 * INPUT:  import { CheckCircle } from 'lucide-react';
 * OUTPUT: const { CheckCircle } = __modules['lucide-react'];
 *
 * Reference: docs/dynamic-imports-strategy.md
 */

import type { ImportDeclaration } from './import-parser';

/**
 * Build module access statement for an import declaration
 *
 * Converts import declaration to const assignment from __modules object.
 *
 * Examples:
 * - import { a, b } from 'mod' → const { a, b } = __modules['mod'];
 * - import X from 'mod' → const X = __modules['mod'].default;
 * - import * as X from 'mod' → const X = __modules['mod'];
 * - import Y, { a } from 'mod' → const { default: Y, a } = __modules['mod'];
 *
 * @param imp - Parsed import declaration
 * @returns Transformed module access statement
 */
const buildModuleAccessStatement = (imp: ImportDeclaration): string => {
  const { source, namedImports, defaultImport, namespaceImport } = imp;

  // Handle namespace import: import * as X from 'mod'
  if (namespaceImport) {
    return `const ${namespaceImport} = __modules['${source}'];`;
  }

  // Handle mixed: import Default, { named } from 'mod'
  if (defaultImport && namedImports.length > 0) {
    const specifiers = [`default: ${defaultImport}`, ...namedImports].join(', ');
    return `const { ${specifiers} } = __modules['${source}'];`;
  }

  // Handle default only: import Default from 'mod'
  if (defaultImport) {
    return `const ${defaultImport} = __modules['${source}'].default;`;
  }

  // Handle named only: import { a, b } from 'mod'
  if (namedImports.length > 0) {
    const specifiers = namedImports.join(', ');
    return `const { ${specifiers} } = __modules['${source}'];`;
  }

  // Side-effect only import (rare, but handle it): import 'mod'
  return `// Side-effect import: ${source}`;
};

/**
 * Transform import statements in code
 *
 * Replaces all ES6 import statements with module access patterns.
 * The original import statements are removed and replaced with const assignments.
 *
 * @param code - Compiled JavaScript code with import statements
 * @param imports - Parsed import declarations to transform
 * @returns Transformed code with module access patterns
 */
export const transformImports = (code: string, imports: ImportDeclaration[]): string => {
  let transformed = code;

  // Replace each import statement with module access
  for (const imp of imports) {
    const replacement = buildModuleAccessStatement(imp);
    // Escape special regex characters in the raw statement
    const escapedStatement = imp.rawStatement.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedStatement, 'g');
    transformed = transformed.replace(regex, replacement);
  }

  return transformed;
};

/**
 * Remove all import and export statements from code
 *
 * This is used in Phase 1 (current) where imports are simply stripped.
 * In Phase 2, use transformImports() instead.
 *
 * @param code - Compiled JavaScript code
 * @returns Code with imports and exports removed
 */
export const stripImportsAndExports = (code: string): string => {
  // Remove import statements
  let cleaned = code.replace(/import\s+.*?from\s+['"][^'"]+['"];?\s*/g, '');

  // Remove export keywords (but keep the declarations)
  cleaned = cleaned.replace(/export\s+(default\s+)?/g, '');

  return cleaned;
};

/**
 * Check if code contains any import statements
 *
 * @param code - JavaScript code to check
 * @returns True if code contains imports, false otherwise
 */
export const hasImports = (code: string): boolean => {
  return /import\s+.*?from\s+['"][^'"]+['"]/g.test(code);
};
