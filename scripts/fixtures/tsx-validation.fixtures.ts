/**
 * Test fixtures for TSX validation
 *
 * Contains sample TSX code for testing validation logic:
 * - Valid components with and without imports
 * - TypeScript errors (type mismatches, undefined access)
 * - ESLint errors (unused vars, missing exports)
 * - Syntax errors (unclosed tags)
 * - Import validation (allowed vs blocked imports)
 */

/**
 * Test fixtures for TSX validation
 */
export const TSX_VALIDATION_FIXTURES = {
  /**
   * Valid TSX component - should pass both TypeScript and ESLint
   */
  validComponent: `export const LessonComponent = () => {
  return (
    <div className="bg-gradient-to-b from-green-50 to-blue-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-green-800 mb-2">
            Introduction to Photosynthesis
          </h1>
          <div className="h-1 w-24 bg-green-600 mx-auto rounded-full"></div>
        </header>

        <section className="space-y-6">
          <article className="bg-white rounded-xl shadow-lg p-8 hover:shadow-xl transition-shadow">
            <h2 className="text-2xl font-bold text-green-700 mb-4">
              What is photosynthesis?
            </h2>
            <p className="text-lg text-gray-700 leading-relaxed">
              Plants make their own food using sunlight, like having a{' '}
              <span className="font-bold text-green-600">kitchen inside their leaves</span>.
            </p>
          </article>
        </section>
      </div>
    </div>
  );
};`,

  /**
   * Type error - undefined variable
   */
  typeError: `export const LessonComponent = () => {
  const title = undefined;

  return (
    <div className="p-4">
      <h1>{title.toUpperCase()}</h1>
    </div>
  );
};`,

  /**
   * Missing export statement
   */
  noExport: `const LessonComponent = () => {
  return (
    <div className="p-4">
      <h1>Missing Export</h1>
    </div>
  );
};`,

  /**
   * Invalid JSX syntax - unclosed tag
   */
  syntaxError: `export const LessonComponent = () => {
  return (
    <div className="p-4">
      <h1>Unclosed heading
    </div>
  );
};`,

  /**
   * Wrong React element type
   */
  typeErrorJSX: `export const LessonComponent = () => {
  const element: string = <div>Hello</div>;

  return (
    <div className="p-4">
      {element}
    </div>
  );
};`,

  /**
   * Component with TypeScript errors (wrong prop types)
   */
  propTypeError: `interface Props {
  title: string;
  count: number;
}

export const LessonComponent = ({ title, count }: Props) => {
  const badTitle: number = title; // Type error
  const badCount: string = count; // Type error

  return (
    <div className="p-4">
      <h1>{badTitle}</h1>
      <p>{badCount}</p>
    </div>
  );
};`,

  /**
   * Component with unused variables (ESLint warning, not error)
   */
  unusedVars: `export const LessonComponent = () => {
  const unused = 'This variable is never used';
  const alsoUnused = 42;

  return (
    <div className="p-4">
      <h1>Hello World</h1>
    </div>
  );
};`,

  /**
   * Valid component with allowed imports (Phase 2)
   */
  validComponentWithImports: `import { CheckCircle, XCircle } from 'lucide-react';
import { clsx } from 'clsx';

export const LessonComponent = () => {
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center space-x-2">
        <CheckCircle className={clsx('w-6 h-6', 'text-green-500')} />
        <span>Interactive lesson with allowed imports</span>
      </div>
      <div className="flex gap-2">
        <XCircle className="w-6 h-6 text-gray-400" />
        <p className="text-gray-700">Using lucide-react icons and clsx utility</p>
      </div>
    </div>
  );
};`,

  /**
   * Component using blocked import (next/link) - Phase 2
   */
  blockedImportNavigation: `import Link from 'next/link';

export const LessonComponent = () => {
  return (
    <div className="p-4">
      <h1>Lesson Content</h1>
      <Link href="/somewhere">Go to next lesson</Link>
    </div>
  );
};`,

  /**
   * Component using blocked import (Supabase) - Phase 2
   */
  blockedImportDatabase: `import { createClient } from '@supabase/supabase-js';

export const LessonComponent = () => {
  const supabase = createClient('url', 'key');

  return (
    <div className="p-4">
      <h1>Accessing Database (not allowed)</h1>
    </div>
  );
};`,

  /**
   * Duplicate component declaration - LLM sometimes generates this pattern
   * Error: Cannot redeclare block-scoped variable
   */
  duplicateDeclaration: `import React from 'react';

const LessonComponent = () => {
  return (
    <div>
      <h1>Photosynthesis Basics</h1>
      <p>Plants convert sunlight into energy through photosynthesis.</p>
    </div>
  );
};

export const LessonComponent = () => {
  return (
    <LessonComponent />
  );
};`,

  /**
   * Missing local module import - LLM sometimes imports non-existent components
   * Error: Cannot find module './QuizComponent'
   */
  missingModuleImport: `import React from 'react';
import QuizComponent from './QuizComponent';

export const LessonComponent = () => {
  return (
    <div>
      <h1>Photosynthesis and You</h1>
      <p>Plants make their own food using sunlight.</p>
      <QuizComponent
        prompt='Why is it important for us to support plant growth?'
        options={{A: 'To produce more oxygen', B: 'For their beauty'}}
        answer={{correct: 'A'}}
      />
    </div>
  );
};`,

  /**
   * Self-referencing component (infinite loop pattern)
   * Valid TypeScript but would cause runtime error
   */
  infiniteLoop: `export const LessonComponent = () => {
  return (
    <div>
      <h1>This will loop forever</h1>
      <LessonComponent />
    </div>
  );
};`,

  /**
   * Missing React import (pre-React 17 pattern)
   * Error when JSX is used without React in scope
   */
  missingReactImport: `export const LessonComponent = () => {
  return (
    <div>
      <h1>Missing React Import</h1>
    </div>
  );
};`,

  /**
   * LLM-generated code with duplicate declaration and missing import
   * Real example from generation output
   */
  llmGeneratedBuggy: `import React from 'react';
import QuizComponent from './QuizComponent';

const LessonComponent = () => {
  return (
    <div>
      <h1>Photosynthesis and You</h1>
      <p><strong>How you contribute:</strong> Breathing in the morning refreshes your cells, which might be helped by plants that have done their photosynthesis during the night.</p>
      <QuizComponent
        prompt='Why is it important for us to support plant growth?'
        options={{A: 'To produce more oxygen', B: 'For their beauty and ambiance', C: 'As a source of food', D: 'For scientific research'}}
        answer={{correct: 'A'}}
      />
      <p><strong>In conclusion:</strong> Photosynthesis is not only essential for plants but also crucial for maintaining the balance of oxygen and carbon dioxide in our atmosphere.</p>
    </div>
  );
};

export const LessonComponent = () => {
  return (
    <LessonComponent />
  );
};`,
};
