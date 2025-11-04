/**
 * LLM provider configuration for Vercel AI SDK
 * Using Vercel AI SDK v5.0+ - https://ai-sdk.dev/
 *
 * Supports:
 * - Ollama (local dev): https://ai-sdk.dev/providers/community-providers/ollama
 * - OpenAI (production): https://ai-sdk.dev/providers/ai-sdk-providers/openai
 */

import { ollama } from 'ollama-ai-provider-v2';
import type { LanguageModel } from 'ai';

export type LLMProvider = 'ollama' | 'openai';

/**
 * Get configured LLM provider from environment
 * Defaults to ollama for local dev
 */
export const getLLMProvider = (): LLMProvider => {
  return (process.env.LLM_PROVIDER as LLMProvider) || 'ollama';
};

/**
 * Create a Vercel AI SDK model instance
 *
 * @param modelName - Model identifier (e.g., 'llama3.1' for Ollama)
 * @param provider - Optional provider override (defaults to env LLM_PROVIDER)
 * @returns Vercel AI SDK LanguageModel instance
 *
 * @example
 * // Use Ollama locally
 * const model = createAIModel('llama3.1');
 *
 * @example
 * // Use OpenAI in production (future)
 * const model = createAIModel('gpt-4', 'openai');
 */
export const createAIModel = (modelName: string, provider?: LLMProvider): LanguageModel => {
  const selectedProvider = provider || getLLMProvider();

  switch (selectedProvider) {
    case 'ollama':
      // Ollama provider - local development
      // Reads OLLAMA_HOST from env (default: http://localhost:11434)
      return ollama(modelName);

    case 'openai':
      // OpenAI provider - placeholder for production
      // Will be implemented when needed
      throw new Error('OpenAI provider not yet implemented. Use Ollama for now.');

    default:
      throw new Error(`Unsupported provider: ${selectedProvider}`);
  }
};
