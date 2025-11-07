/**
 * Lesson TSX Renderer Component
 *
 * Evaluates compiled JavaScript (React.createElement code) at runtime
 * to render full React components with hooks, state, and interactivity.
 *
 * Approach: Uses new Function() to execute validated and compiled JavaScript
 * in a controlled scope with React context. This enables:
 * - Full React hooks (useState, useEffect, etc.)
 * - Forms with state and event handlers
 * - Interactive components
 *
 * Security: Code is pre-validated through eslint/TypeScript validation cycle
 * before compilation, ensuring only safe code reaches this renderer.
 */

'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';
import React, { useEffect, useState } from 'react';

/**
 * Structure of compiled_code stored in database
 */
interface CompiledCode {
  javascript: string;
  componentName: string;
}

interface LessonTSXRendererProps {
  /** Compiled code object containing JavaScript and component name */
  compiledCode: CompiledCode | null;
  /** Lesson title for error messages */
  lessonTitle?: string;
}

/**
 * Strip import and export statements from JavaScript code
 *
 * Phase 1: Remove all imports and exports since we only provide React context.
 * Components should use HTML elements and Tailwind CSS only.
 *
 * Export statements must be removed because they are not valid inside
 * Function constructor scope (module-level syntax only).
 *
 * Phase 2 (future): Parse imports and provide module context.
 * See docs/dynamic-imports-strategy.md
 *
 * @param code - JavaScript code potentially containing imports and exports
 * @returns Code with imports and exports removed
 */
const stripImportsAndExports = (code: string): string => {
  // Remove ES6 import statements
  let cleaned = code.replace(/import\s+.*?from\s+['"].*?['"];?\s*/g, '');

  // Remove export keywords (export const, export default, export)
  cleaned = cleaned.replace(/export\s+(default\s+)?/g, '');

  return cleaned;
};

/**
 * Evaluate compiled JavaScript to get React component
 *
 * Uses Function constructor to execute code in controlled scope.
 * Only React is provided in context (Phase 1).
 *
 * @param javascript - Compiled JavaScript code
 * @param componentName - Name of exported component
 * @returns React component constructor
 * @throws Error if evaluation fails
 */
const evaluateComponent = (javascript: string, componentName: string): React.ComponentType => {
  try {
    // Strip imports and exports (Phase 1: no external dependencies)
    const cleanedCode = stripImportsAndExports(javascript);

    // Create function that returns the component

    const componentFactory = new Function(
      'React',
      `
      ${cleanedCode}
      return ${componentName};
    `,
    );

    // Execute with React context
    const Component = componentFactory(React);

    if (typeof Component !== 'function') {
      throw new Error(`${componentName} is not a valid React component`);
    }

    return Component;
  } catch (error) {
    console.error('Component evaluation error:', error);
    throw error;
  }
};

/**
 * Lesson TSX Renderer
 *
 * Renders compiled JavaScript as a full React component.
 * Handles errors and displays appropriate fallback UI.
 */
export const LessonTSXRenderer: React.FC<LessonTSXRendererProps> = ({ compiledCode, lessonTitle }) => {
  const [Component, setComponent] = useState<React.ComponentType | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Evaluate component when compiledCode changes
  useEffect(() => {
    setError(null);
    setComponent(null);

    if (!compiledCode?.javascript) {
      setError('No compiled code available');
      return;
    }

    try {
      const EvaluatedComponent = evaluateComponent(compiledCode.javascript, compiledCode.componentName);
      setComponent(() => EvaluatedComponent);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to evaluate component';
      setError(errorMessage);
      console.error('Component evaluation failed:', err);
    }
  }, [compiledCode]);

  // Show error state
  if (error || !Component) {
    return (
      <Card className="border-destructive">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <CardTitle className="text-destructive">Rendering Error</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <CardDescription className="text-destructive">
            Failed to render lesson {lessonTitle ? `"${lessonTitle}"` : ''}. {error || 'Component could not be loaded.'}
          </CardDescription>
        </CardContent>
      </Card>
    );
  }

  // Render component with error boundary
  return (
    <ErrorBoundary lessonTitle={lessonTitle}>
      <div className="lesson-component-container">
        <Component />
      </div>
    </ErrorBoundary>
  );
};

/**
 * Error Boundary for catching runtime errors in rendered components
 */
class ErrorBoundary extends React.Component<
  { children: React.ReactNode; lessonTitle?: string },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode; lessonTitle?: string }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Component runtime error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Card className="border-destructive">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <CardTitle className="text-destructive">Component Runtime Error</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription className="text-destructive">
              The lesson component {this.props.lessonTitle ? `"${this.props.lessonTitle}"` : ''} encountered an error
              during rendering.
            </CardDescription>
            {this.state.error && (
              <pre className="mt-4 text-xs bg-muted p-4 rounded overflow-auto">
                {this.state.error.message}
                {this.state.error.stack}
              </pre>
            )}
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}
