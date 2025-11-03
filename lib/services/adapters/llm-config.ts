/**
 * Simple LLM provider configuration
 * POC - keeps it minimal
 */

export type LLMProvider = 'ollama' | 'openai';

/**
 * Get configured LLM provider from environment
 * Defaults to ollama for local dev
 */
export const getLLMProvider = (): LLMProvider => {
  return (process.env.LLM_PROVIDER as LLMProvider) || 'ollama';
};
