/**
 * LLM Error Transformation Utility
 *
 * Consolidates error handling logic for LLM operations.
 * Transforms raw errors into user-friendly, actionable messages.
 *
 * Extracted from validation-core.ts and lesson-generator-core.ts
 * to follow DRY principle and centralize error handling.
 */

/**
 * Structured LLM error information
 */
export interface LLMError {
  /** User-friendly error message with actionable guidance */
  message: string;
  /** Original error for debugging */
  originalError: Error;
  /** Error type for programmatic handling */
  type: 'model_not_found' | 'connection_error' | 'api_error' | 'validation_error' | 'unknown';
  /** Additional context for debugging */
  context?: {
    modelName?: string;
    host?: string;
    operation?: string;
  };
}

/**
 * Transform raw LLM errors into structured, user-friendly error information
 *
 * Handles common LLM error patterns:
 * - Model not found
 * - Connection errors
 * - API errors
 * - Validation errors
 *
 * @param error - Raw error from LLM operation
 * @param context - Additional context (model name, host, operation)
 * @returns Structured LLM error with helpful message
 *
 * @example
 * ```typescript
 * try {
 *   await generateObject({ model, schema, prompt })
 * } catch (error) {
 *   const llmError = transformLLMError(error, {
 *     modelName: 'llama3.1',
 *     host: 'http://localhost:11434',
 *     operation: 'validation'
 *   })
 *   console.error(llmError.message)
 * }
 * ```
 */
export const transformLLMError = (
  error: unknown,
  context?: {
    modelName?: string;
    host?: string;
    operation?: string;
  },
): LLMError => {
  // Handle non-Error objects
  if (!(error instanceof Error)) {
    return {
      message: 'Unknown error occurred during LLM operation',
      originalError: new Error(String(error)),
      type: 'unknown',
      context,
    };
  }

  const errorMessage = error.message.toLowerCase();

  // Model not found
  if (errorMessage.includes('model') && (errorMessage.includes('not found') || errorMessage.includes('pull'))) {
    const modelName = context?.modelName || 'specified model';
    return {
      message: `Model '${modelName}' not found. Please run: ollama pull ${modelName}`,
      originalError: error,
      type: 'model_not_found',
      context,
    };
  }

  // Connection error
  if (errorMessage.includes('connection') || errorMessage.includes('econnrefused') || errorMessage.includes('fetch')) {
    const host = context?.host || 'Ollama server';
    return {
      message: `Cannot connect to ${host}. Please ensure Ollama is running and accessible.`,
      originalError: error,
      type: 'connection_error',
      context,
    };
  }

  // API error (rate limits, auth issues)
  if (
    errorMessage.includes('api') ||
    errorMessage.includes('rate limit') ||
    errorMessage.includes('unauthorized') ||
    errorMessage.includes('forbidden')
  ) {
    return {
      message: `API error: ${error.message}. Please check your configuration and try again.`,
      originalError: error,
      type: 'api_error',
      context,
    };
  }

  // Validation error (schema mismatch, invalid output)
  if (
    errorMessage.includes('validation') ||
    errorMessage.includes('schema') ||
    errorMessage.includes('parse') ||
    errorMessage.includes('invalid')
  ) {
    return {
      message: `LLM output validation failed: ${error.message}. The model may not be following the expected format.`,
      originalError: error,
      type: 'validation_error',
      context,
    };
  }

  // Unknown error
  const operation = context?.operation || 'LLM operation';
  return {
    message: `${operation} failed: ${error.message}`,
    originalError: error,
    type: 'unknown',
    context,
  };
};

/**
 * Create a user-facing error message for display in UI
 *
 * @param llmError - Structured LLM error
 * @returns User-friendly error message
 */
export const createUserMessage = (llmError: LLMError): string => {
  return llmError.message;
};

/**
 * Create a detailed error message for logging/debugging
 *
 * @param llmError - Structured LLM error
 * @returns Detailed error message with context
 */
export const createDebugMessage = (llmError: LLMError): string => {
  const parts = [
    `LLM Error [${llmError.type}]:`,
    llmError.message,
    '',
    'Original Error:',
    llmError.originalError.message,
  ];

  if (llmError.context) {
    parts.push('', 'Context:');
    Object.entries(llmError.context).forEach(([key, value]) => {
      if (value) parts.push(`  ${key}: ${value}`);
    });
  }

  if (llmError.originalError.stack) {
    parts.push('', 'Stack:', llmError.originalError.stack);
  }

  return parts.join('\n');
};
