/**
 * Module context builder for Phase 2 dynamic imports
 *
 * Loads and caches modules that are imported by lesson components.
 * Provides them as a context object to the Function constructor.
 *
 * Reference: docs/dynamic-imports-strategy.md
 */

'use client';

import { ALLOWED_IMPORTS, type AllowedImportPath } from '@/lib/config/allowed-imports';
import React from 'react';
import type { ImportDeclaration } from './import-parser';

/**
 * Module cache to avoid re-loading the same modules
 *
 * Key: import source path
 * Value: loaded module
 */
const moduleCache = new Map<string, unknown>();

/**
 * Module context object shape
 *
 * This is the __modules object that will be provided to evaluated code.
 */
export type ModuleContext = Record<string, unknown>;

/**
 * Load a single module from the allowed imports
 *
 * Uses the dynamic import loader defined in ALLOWED_IMPORTS config.
 * Caches the loaded module to avoid redundant loading.
 *
 * @param source - The import source path
 * @returns Promise resolving to the loaded module
 */
const loadModule = async (source: AllowedImportPath): Promise<unknown> => {
  // Check cache first
  if (moduleCache.has(source)) {
    return moduleCache.get(source);
  }

  // Load module using the defined loader
  const loader = ALLOWED_IMPORTS[source];
  const loadedModule = await loader();

  // Cache for future use
  moduleCache.set(source, loadedModule);

  return loadedModule;
};

/**
 * Build module context from import declarations
 *
 * Loads all imported modules and returns them as a context object.
 * React is always included in the context.
 *
 * @param imports - Array of validated import declarations
 * @returns Promise resolving to module context object
 */
export const buildModuleContext = async (imports: ImportDeclaration[]): Promise<ModuleContext> => {
  const modules: ModuleContext = {
    // Always provide React
    react: React,
  };

  // Extract unique sources
  const uniqueSources = new Set(imports.map((imp) => imp.source));

  // Load each module
  await Promise.all(
    Array.from(uniqueSources).map(async (source) => {
      // Type assertion: at this point imports should be validated
      const loadedModule = await loadModule(source as AllowedImportPath);
      modules[source] = loadedModule;
    }),
  );

  return modules;
};

/**
 * Build module context from source paths
 *
 * Convenience function that takes just the source paths instead of full import declarations.
 * Useful when you just have a list of module names.
 *
 * @param sources - Array of import source paths
 * @returns Promise resolving to module context object
 */
export const buildModuleContextFromSources = async (sources: string[]): Promise<ModuleContext> => {
  const modules: ModuleContext = {
    // Always provide React
    react: React,
  };

  // Load each module
  await Promise.all(
    sources.map(async (source) => {
      // Type assertion: assume sources have been validated
      const loadedModule = await loadModule(source as AllowedImportPath);
      modules[source] = loadedModule;
    }),
  );

  return modules;
};

/**
 * Clear the module cache
 *
 * Useful for testing or if modules need to be reloaded.
 */
export const clearModuleCache = (): void => {
  moduleCache.clear();
};

/**
 * Get the size of the module cache
 *
 * @returns Number of cached modules
 */
export const getModuleCacheSize = (): number => {
  return moduleCache.size;
};
