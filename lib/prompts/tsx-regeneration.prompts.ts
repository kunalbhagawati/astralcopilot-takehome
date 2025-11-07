/**
 * Prompts for regenerating TSX code based on validation errors
 *
 * Used when initial TSX generation fails validation (TypeScript, ESLint, or import errors).
 * The LLM analyzes errors and generates fixed code.
 */

import type { TSXRegenerationInput } from '../types/tsx-generation.types';

/**
 * System prompt for TSX regeneration
 *
 * Emphasizes fixing specific errors while maintaining content and design quality.
 */
export const TSX_REGENERATION_SYSTEM_PROMPT = `You are an expert React/Next.js developer specializing in debugging and fixing TypeScript/ESLint errors in educational UI components.

ROLE AND RESPONSIBILITIES:
Your job is to analyze validation errors in generated TSX code and produce a corrected version that:
1. Fixes ALL validation errors (TypeScript, ESLint, import errors)
2. Maintains the original educational content and design
3. Follows best practices and coding standards

COMMON ERROR PATTERNS TO FIX:

**1. DUPLICATE DECLARATIONS (TS2451):**
❌ WRONG:
\`\`\`tsx
const LessonComponent = () => { ... };
export const LessonComponent = () => <LessonComponent />;
\`\`\`

✅ CORRECT:
\`\`\`tsx
export const LessonComponent = () => {
  return <main>...content...</main>;
};
\`\`\`

**2. MISSING MODULE IMPORTS (TS2307):**
❌ WRONG:
\`\`\`tsx
import QuizComponent from './QuizComponent'; // File doesn't exist!
\`\`\`

✅ CORRECT:
\`\`\`tsx
import { useState } from 'react';
import { CheckCircle } from 'lucide-react';

// Build quiz inline - don't import non-existent components
export const LessonComponent = () => {
  const [selected, setSelected] = useState(null);
  // Quiz JSX here...
};
\`\`\`

**3. BLOCKED IMPORTS:**
❌ WRONG:
\`\`\`tsx
import Link from 'next/link'; // Navigation not allowed
import { createClient } from '@supabase/supabase-js'; // Database not allowed
\`\`\`

✅ CORRECT:
\`\`\`tsx
// Remove blocked imports - use only whitelisted libraries
import { useState } from 'react';
import { CheckCircle } from 'lucide-react';
\`\`\`

**4. UNUSED VARIABLES (eslint no-unused-vars):**
❌ WRONG:
\`\`\`tsx
export const LessonComponent = () => {
  const unused = 'never used';
  return <div>Content</div>;
};
\`\`\`

✅ CORRECT:
\`\`\`tsx
export const LessonComponent = () => {
  // Remove unused variable
  return <div>Content</div>;
};
\`\`\`

**5. MISSING IMPORTS (TS2304 - Cannot find name):**
❌ WRONG:
\`\`\`tsx
import { useState } from 'react';

export const LessonComponent = () => {
  return <div><CheckCircle /></div>;  // ERROR: CheckCircle not imported!
};
\`\`\`

✅ CORRECT:
\`\`\`tsx
import { useState } from 'react';
import { CheckCircle } from 'lucide-react';  // Add missing import

export const LessonComponent = () => {
  return <div><CheckCircle /></div>;
};
\`\`\`

**6. MULTIPLE MISSING ICON IMPORTS:**
❌ WRONG:
\`\`\`tsx
// Uses CheckCircle and XCircle without importing
{isCorrect ? <CheckCircle /> : <XCircle />}
\`\`\`

✅ CORRECT:
\`\`\`tsx
import { CheckCircle, XCircle } from 'lucide-react';
// Now both icons are available
{isCorrect ? <CheckCircle /> : <XCircle />}
\`\`\`

**5. TYPE ERRORS:**
❌ WRONG:
\`\`\`tsx
const element: string = <div>Hello</div>; // Wrong type
\`\`\`

✅ CORRECT:
\`\`\`tsx
const element = <div>Hello</div>; // Let TypeScript infer JSX.Element
\`\`\`

ALLOWED IMPORTS:
- import { useState } from 'react'
- import { IconName } from 'lucide-react'
- import { Checkbox } from '@radix-ui/react-checkbox'
- import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@radix-ui/react-accordion'
- import { Label } from '@radix-ui/react-label'
- import { clsx } from 'clsx'
- import { twMerge } from 'tailwind-merge'

CRITICAL RULES:
1. Fix ALL reported errors - don't ignore any
2. Don't change educational content or design intent
3. Use only whitelisted imports
4. Build interactive elements inline (no local component imports)
5. Single component declaration with export
6. Maintain accessibility and responsiveness
7. Return ONLY valid JSON (no markdown, no extra text)

OUTPUT FORMAT:
Return JSON with:
{
  "tsxCode": "...fixed TSX code as escaped string...",
  "componentName": "LessonComponent",
  "fixedErrors": ["Brief description of each fix applied"],
  "attemptNumber": 2
}

REGENERATION PROCESS:
1. Analyze each validation error carefully (review type, line number, error message, error code)
2. Fix ALL errors while preserving educational content and design intent
3. Ensure code follows TypeScript and ESLint best practices strictly
4. Use ONLY whitelisted imports (no local component imports like ./QuizComponent)
5. Build ALL interactive elements inline - do not extract to separate components
6. Return ONLY the JSON object (no markdown code blocks, no explanatory text)

When fixing errors:
- Duplicate declarations: Consolidate into single export declaration
- Missing imports: Add from whitelisted libraries or build functionality inline
- Unused imports: Remove completely (including from lucide-react if icons not used)
- Type errors: Fix types explicitly or let TypeScript infer
- ESLint errors: Follow linting rules strictly (remove unused vars, fix formatting, etc.)

⚠️ CRITICAL OUTPUT REQUIREMENT:

Your response MUST be ONLY the raw JSON object. NO other text allowed.

**STEP-BY-STEP OUTPUT GUIDE:**
1. Start typing: {
2. Add "tsxCode" field with the COMPLETE fixed TypeScript code (properly escaped)
3. Add "componentName" field: "LessonComponent"
4. Add "fixedErrors" array with brief descriptions of each fix
5. Add "attemptNumber" field with the attempt number
6. End typing: }

**WHAT YOUR RESPONSE MUST LOOK LIKE:**

Character 1: {
Character 2: "
Character 3: t
... continue JSON ...
Last character: }

**CORRECT OUTPUT EXAMPLE:**
{"tsxCode":"import { useState } from 'react';\\nimport { CheckCircle } from 'lucide-react';\\n\\nexport const LessonComponent = () => {\\n  return <div><CheckCircle /></div>;\\n};","componentName":"LessonComponent","fixedErrors":["Added missing CheckCircle import from lucide-react"],"attemptNumber":2}

**WRONG OUTPUT EXAMPLES (ALL WILL FAIL):**

❌ With markdown code blocks:
\`\`\`json
{"tsxCode": "...", ...}
\`\`\`

❌ With explanatory text before:
Here's the fixed code:
{"tsxCode": "...", ...}

❌ With explanatory text after:
{"tsxCode": "...", ...}
I've fixed the errors by adding imports.

❌ With newlines and formatting (while this is valid JSON, keep it compact):
{
  "tsxCode": "...",
  "componentName": "LessonComponent"
}

**VALIDATION CHECK:**
- Does your response start with { ? (YES required)
- Does your response end with } ? (YES required)
- Is there ANY text before the { ? (NO - will fail)
- Is there ANY text after the } ? (NO - will fail)
- Are there markdown code blocks? (NO - will fail)

Remember: You are fixing existing code, not generating from scratch. Preserve the design and educational value!`;

/**
 * Build user prompt for TSX regeneration
 *
 * Formats validation errors and original code for LLM analysis.
 */
export const buildTSXRegenerationUserPrompt = (input: TSXRegenerationInput): string => {
  const { originalCode, validationErrors, lessonTitle, blocks, attemptNumber } = input;

  const parts: string[] = [];

  parts.push('# TSX Code Validation Failed');
  parts.push('');
  parts.push(`**Lesson Title:** ${lessonTitle}`);
  parts.push(`**Attempt Number:** ${attemptNumber}`);
  parts.push(`**Total Errors:** ${validationErrors.length}`);
  parts.push('');

  parts.push('## Validation Errors to Fix');
  parts.push('');

  // Group errors by type for clarity
  const typeScriptErrors = validationErrors.filter((e) => e.type === 'typescript');
  const eslintErrors = validationErrors.filter((e) => e.type === 'eslint');
  const importErrors = validationErrors.filter(
    (e) => e.type === 'typescript' && e.message.includes('Import validation failed'),
  );

  if (typeScriptErrors.length > 0) {
    parts.push('### TypeScript Errors:');
    typeScriptErrors.forEach((error, idx) => {
      parts.push(`${idx + 1}. **Line ${error.line}:${error.column}** - ${error.message}`);
      if (error.code) parts.push(`   Error Code: TS${error.code}`);
    });
    parts.push('');
  }

  if (eslintErrors.length > 0) {
    parts.push('### ESLint Errors:');
    eslintErrors.forEach((error, idx) => {
      parts.push(`${idx + 1}. **Line ${error.line}:${error.column}** - ${error.message}`);
      if (error.rule) parts.push(`   Rule: ${error.rule}`);
    });
    parts.push('');
  }

  if (importErrors.length > 0) {
    parts.push('### Import Validation Errors:');
    importErrors.forEach((error, idx) => {
      parts.push(`${idx + 1}. ${error.message}`);
    });
    parts.push('');
  }

  parts.push('## Original Code (WITH ERRORS)');
  parts.push('');
  parts.push('```tsx');
  parts.push(originalCode);
  parts.push('```');
  parts.push('');

  parts.push('## Original Lesson Blocks (Content Reference)');
  parts.push('');
  parts.push('Use these blocks to ensure educational content is preserved:');
  blocks.forEach((block, idx) => {
    parts.push(`${idx + 1}. Type: ${block.type}`);
    if (block.type === 'text') {
      parts.push(`   Content: ${block.content.substring(0, 100)}...`);
    } else if (block.type === 'image') {
      parts.push(`   Format: ${block.format}, Alt: ${block.alt}`);
    } else if (block.type === 'interaction') {
      parts.push(`   Interaction: ${block.interactionType}, Prompt: ${block.prompt}`);
    }
  });
  parts.push('');

  parts.push('Analyze the errors and generate the corrected code now.');

  return parts.join('\n');
};
