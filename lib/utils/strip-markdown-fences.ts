/**
 * Strip markdown code fences from LLM-generated code
 *
 * Some LLMs ignore instructions and wrap code in markdown fences:
 * ```tsx
 * code here
 * ```
 *
 * This utility removes those fences to get clean code for validation/compilation.
 */

/**
 * Strip markdown code fences from code string
 *
 * Handles:
 * - ```tsx ... ```
 * - ```typescript ... ```
 * - ``` ... ```
 * - Fences at start/end of string
 *
 * @param code - Code string potentially wrapped in fences
 * @returns Clean code without markdown fences
 *
 * @example
 * ```typescript
 * const input = '```tsx\nconst x = 1;\n```';
 * const output = stripMarkdownFences(input);
 * // output: 'const x = 1;'
 * ```
 */
export const stripMarkdownFences = (code: string): string => {
  let cleaned = code.trim();

  // Remove opening fence: ```tsx, ```typescript, ```
  // Match at start of string (^) followed by optional language identifier
  cleaned = cleaned.replace(/^```(?:tsx|typescript|ts|javascript|js)?\s*\n?/i, '');

  // Remove closing fence: ```
  // Match at end of string ($) with optional whitespace before
  cleaned = cleaned.replace(/\s*```\s*$/i, '');

  return cleaned.trim();
};
