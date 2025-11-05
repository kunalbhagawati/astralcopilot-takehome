/**
 * Lesson TSX Renderer Component
 *
 * Renders TSX code from generated lessons using react-jsx-parser.
 * Uses the original TSX code from generated_code (not compiled JavaScript).
 *
 * Problem solved: Previously tried to parse compiled JavaScript (React.createElement)
 * as JSX, causing syntax errors. Now uses original TSX directly.
 */

'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import JsxParser from 'react-jsx-parser';

/**
 * Structure of generated_code stored in database
 */
interface GeneratedCode {
  tsxCode: string;
  componentName: string;
}

interface LessonTSXRendererProps {
  /** Generated code object containing TSX code and component name */
  generatedCode: GeneratedCode | null;
  /** Lesson title for error messages */
  lessonTitle?: string;
}

/**
 * Extract JSX markup from TSX component code
 *
 * Removes export statement, imports, and component wrapper to get pure JSX.
 * Works with both arrow functions and regular function components.
 *
 * @param code - Complete TSX component code
 * @returns Extracted JSX string or null if extraction fails
 */
const extractJSXFromTSX = (code: string): string | null => {
  try {
    // Remove imports
    let cleaned = code.replace(/import\s+.*?from\s+['"].*?['"];?\n?/g, '');

    // Remove export statement
    cleaned = cleaned.replace(/export\s+(default\s+)?/g, '');

    // Try to extract JSX from return statement
    const returnMatch = cleaned.match(/return\s*\(([\s\S]*)\);?\s*\}?;?$/);
    if (returnMatch) {
      return returnMatch[1].trim();
    }

    // Try arrow function with implicit return
    const arrowMatch = cleaned.match(/\(\)\s*=>\s*\(([\s\S]*)\);?$/);
    if (arrowMatch) {
      return arrowMatch[1].trim();
    }

    // Try arrow function without parentheses
    const arrowNoParenMatch = cleaned.match(/\(\)\s*=>\s*(<[\s\S]*)$/);
    if (arrowNoParenMatch) {
      return arrowNoParenMatch[1].trim();
    }

    return null;
  } catch (error) {
    console.error('Error extracting JSX from TSX:', error);
    return null;
  }
};

/**
 * Lesson TSX Renderer
 *
 * Renders TSX code safely using react-jsx-parser.
 * Handles errors and displays appropriate fallback UI.
 */
export const LessonTSXRenderer: React.FC<LessonTSXRendererProps> = ({ generatedCode, lessonTitle }) => {
  const [renderError, setRenderError] = useState<string | null>(null);
  const [jsxMarkup, setJsxMarkup] = useState<string | null>(null);

  // Extract JSX when generatedCode changes
  // Note: Moved out of useMemo to avoid setState-during-render React violation
  useEffect(() => {
    setRenderError(null);

    if (!generatedCode?.tsxCode) {
      setRenderError('No TSX code available');
      setJsxMarkup(null);
      return;
    }

    const extracted = extractJSXFromTSX(generatedCode.tsxCode);
    if (!extracted) {
      setRenderError('Could not extract JSX from TSX component code');
      setJsxMarkup(null);
      return;
    }

    setJsxMarkup(extracted);
  }, [generatedCode]);

  // Handle runtime render errors from JsxParser
  const handleError = (error: Error) => {
    console.error('JSX render error:', error);
    setRenderError(error.message);
  };

  // Show error state
  if (renderError || !jsxMarkup) {
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
            Failed to render lesson {lessonTitle ? `"${lessonTitle}"` : ''}. {renderError || 'Invalid TSX format.'}
          </CardDescription>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="lesson-jsx-container">
      <JsxParser
        jsx={jsxMarkup}
        onError={handleError}
        renderInWrapper={false}
        showWarnings={process.env.NODE_ENV === 'development'}
        disableKeyGeneration={false}
      />
    </div>
  );
};
