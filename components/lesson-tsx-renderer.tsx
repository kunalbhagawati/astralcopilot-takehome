/**
 * Lesson TSX Renderer Component
 *
 * Evaluates compiled JavaScript (React.createElement code) at runtime
 * to render full React components with hooks, state, and interactivity.
 *
 * Approach: Uses new Function() to execute validated and compiled JavaScript
 * in a controlled scope with React + module context. This enables:
 * - Full React hooks (useState, useEffect, etc.)
 * - Forms with state and event handlers
 * - Interactive components
 * - Phase 2: Whitelisted library imports (lucide-react, radix-ui, etc.)
 *
 * Security: Code is pre-validated through eslint/TypeScript validation cycle
 * before compilation, ensuring only safe code reaches this renderer.
 */

'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { parseImports } from '@/lib/services/imports/import-parser';
import {
  hasImports,
  stripImportsAndExports as simpleStrip,
  transformImports,
} from '@/lib/services/imports/import-transformer';
import { buildModuleContext } from '@/lib/services/imports/module-context';
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
 * Evaluate compiled JavaScript to get React component
 *
 * Phase 2: Supports whitelisted library imports via module context.
 * Falls back to Phase 1 (React-only) for code without imports.
 *
 * @param javascript - Compiled JavaScript code
 * @param componentName - Name of exported component
 * @returns Promise resolving to React component constructor
 * @throws Error if evaluation fails
 */
const evaluateComponent = async (javascript: string, componentName: string): Promise<React.ComponentType> => {
  try {
    // Check if code has imports (Phase 2) or not (Phase 1 backward compatibility)
    if (hasImports(javascript)) {
      // Phase 2: Parse, transform imports, and load modules
      const imports = parseImports(javascript);

      // Transform import statements to module access
      const transformedCode = transformImports(javascript, imports);

      // Remove export keywords (not valid in Function scope)
      const cleanedCode = transformedCode.replace(/export\s+(default\s+)?/g, '');

      // Build module context (loads all imported modules)
      const modules = await buildModuleContext(imports);

      // Create function with React and __modules in scope
      const componentFactory = new Function(
        'React',
        '__modules',
        `
        ${cleanedCode}
        return ${componentName};
      `,
      );

      // Execute with React and modules context
      const Component = componentFactory(React, modules);

      if (typeof Component !== 'function') {
        throw new Error(`${componentName} is not a valid React component`);
      }

      return Component;
    } else {
      // Phase 1 backward compatibility: No imports, simple strip
      const cleanedCode = simpleStrip(javascript);

      // Create function with only React in scope
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
    }
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
    let cancelled = false;

    const loadComponent = async (): Promise<void> => {
      setError(null);
      setComponent(null);

      if (!compiledCode?.javascript) {
        setError('No compiled code available');
        return;
      }

      try {
        const EvaluatedComponent = await evaluateComponent(compiledCode.javascript, compiledCode.componentName);

        if (!cancelled) {
          setComponent(() => EvaluatedComponent);
        }
      } catch (err) {
        if (!cancelled) {
          const errorMessage = err instanceof Error ? err.message : 'Failed to evaluate component';
          setError(errorMessage);
          console.error('Component evaluation failed:', err);
        }
      }
    };

    loadComponent();

    return () => {
      cancelled = true;
    };
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
