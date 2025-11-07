/**
 * Whitelist configuration for allowed imports in lesson components
 *
 * Phase 2 import system: Defines which libraries can be imported in dynamically
 * generated lesson code and provides dynamic loaders for them.
 *
 * SECURITY: Only libraries listed here can be imported. This prevents:
 * - Access to Next.js router/navigation
 * - Access to Supabase client or database
 * - Access to server-side only libraries
 * - Arbitrary module loading
 *
 * Based on project's package.json, filtered for educational utility.
 */

/**
 * Allowed import paths mapped to their dynamic loaders
 *
 * Each entry:
 * - Key: Import path as it appears in code (e.g., 'lucide-react')
 * - Value: Function that returns a Promise resolving to the module
 */
export const ALLOWED_IMPORTS = {
  // React (for hooks like useState)
  'react': () => import('react'),

  // Icons (lucide-react)
  'lucide-react': () => import('lucide-react'),

  // UI Components (Radix UI)
  '@radix-ui/react-checkbox': () => import('@radix-ui/react-checkbox'),
  '@radix-ui/react-accordion': () => import('@radix-ui/react-accordion'),
  '@radix-ui/react-label': () => import('@radix-ui/react-label'),

  // Styling Utilities
  'clsx': () => import('clsx'),
  'tailwind-merge': () => import('tailwind-merge'),
} as const;

/**
 * Type for allowed import paths
 */
export type AllowedImportPath = keyof typeof ALLOWED_IMPORTS;

/**
 * Array of allowed import paths (for validation)
 */
export const ALLOWED_IMPORT_PATHS: AllowedImportPath[] = Object.keys(ALLOWED_IMPORTS) as AllowedImportPath[];

/**
 * Check if an import path is allowed
 *
 * @param importPath - The import path to check
 * @returns True if allowed, false otherwise
 */
export const isAllowedImport = (importPath: string): importPath is AllowedImportPath => {
  return importPath in ALLOWED_IMPORTS;
};

/**
 * Explicitly blocked imports (for clear error messages)
 *
 * These are commonly attempted imports that should never be allowed.
 */
export const BLOCKED_IMPORTS = {
  // Next.js routing/navigation
  'next/link': 'Navigation is not allowed in lesson components',
  'next/navigation': 'Navigation is not allowed in lesson components',
  'next/router': 'Navigation is not allowed in lesson components',

  // Supabase (database access)
  '@supabase/supabase-js': 'Database access is not allowed in lesson components',
  '@supabase/ssr': 'Server-side functionality is not allowed in lesson components',

  // Server-only
  'next/server': 'Server-side functionality is not allowed in lesson components',
  'next/headers': 'Server-side functionality is not allowed in lesson components',
} as const;

/**
 * Get a descriptive error message for a blocked import
 *
 * @param importPath - The import path that was blocked
 * @returns Error message explaining why it's blocked
 */
export const getBlockedImportMessage = (importPath: string): string => {
  if (importPath in BLOCKED_IMPORTS) {
    return BLOCKED_IMPORTS[importPath as keyof typeof BLOCKED_IMPORTS];
  }

  return `Import "${importPath}" is not in the whitelist. Only approved educational libraries can be imported.`;
};
