/**
 * LLM Configuration for Vercel AI SDK
 *
 * This project ALWAYS uses Vercel AI SDK: https://ai-sdk.dev/docs/introduction
 *
 * Two runtime modes:
 * 1. Ollama - Local models via ollama-ai-provider-v2
 * 2. Gateway - ANY provider via Vercel AI Gateway (OpenAI, Anthropic, Google, xAI, etc.)
 *
 * Configuration via environment variables:
 * - LLM_PROVIDER: 'ollama' | 'gateway' (required)
 *
 * When LLM_PROVIDER=ollama:
 * - OLLAMA_HOST: Ollama server URL (optional, defaults to http://localhost:11434)
 * - Model names: Simple format (e.g., 'llama3.1', 'qwen2.5-coder:latest')
 *
 * When LLM_PROVIDER=gateway:
 * - AI_GATEWAY_API_KEY or OPENAI_API_KEY: API key (required)
 * - OPENAI_BASE_URL: Gateway endpoint (required, e.g., https://gateway.vercel.app)
 * - Model names: Provider-prefixed format (e.g., 'anthropic/claude-haiku-4.5', 'openai/gpt-4o')
 * - See all available models: https://vercel.com/docs/ai-gateway/models-and-providers
 */

import { ollama } from 'ollama-ai-provider-v2';
import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';

/**
 * Create a Vercel AI SDK model instance
 *
 * Provider determined by LLM_PROVIDER environment variable.
 * Validates configuration and fails fast with clear error messages.
 *
 * @param modelName - Model identifier
 *   - Ollama: Simple name (e.g., 'llama3.1', 'qwen2.5-coder:latest')
 *   - Gateway: Provider-prefixed (e.g., 'anthropic/claude-haiku-4.5', 'openai/gpt-4o')
 * @returns Vercel AI SDK LanguageModel instance
 * @throws Error if configuration invalid or incomplete
 *
 * @example
 * // Ollama - local development
 * // LLM_PROVIDER=ollama
 * // OLLAMA_HOST=http://localhost:11434 (optional)
 * const model = createAIModel('llama3.1');
 *
 * @example
 * // Gateway - Anthropic via Vercel AI Gateway
 * // LLM_PROVIDER=gateway
 * // AI_GATEWAY_API_KEY=vck_xxx
 * // OPENAI_BASE_URL=https://gateway.vercel.app
 * const model = createAIModel('anthropic/claude-haiku-4.5');
 *
 * @example
 * // Gateway - OpenAI via Vercel AI Gateway
 * // LLM_PROVIDER=gateway
 * // AI_GATEWAY_API_KEY=vck_xxx
 * // OPENAI_BASE_URL=https://gateway.vercel.app
 * const model = createAIModel('openai/gpt-4o');
 */
export const createAIModel = (modelName: string): LanguageModel => {
  const provider = process.env.LLM_PROVIDER;

  // Validate LLM_PROVIDER is set
  if (!provider) {
    throw new Error('LLM_PROVIDER environment variable is required. Set to "ollama" or "gateway" in your .env file');
  }

  // Ollama provider - local or remote Ollama server
  if (provider === 'ollama') {
    const host = process.env.OLLAMA_HOST;

    // Validate OLLAMA_HOST format if provided
    if (host && !host.startsWith('http')) {
      throw new Error('OLLAMA_HOST must start with http:// or https://');
    }

    // ollama-ai-provider-v2 reads OLLAMA_HOST from env
    // Defaults to http://localhost:11434 if not set
    return ollama(modelName);
  }

  // Gateway provider - Vercel AI Gateway (supports all providers)
  if (provider === 'gateway') {
    // Support both Vercel AI Gateway key and direct OpenAI key
    const apiKey = process.env.AI_GATEWAY_API_KEY || process.env.OPENAI_API_KEY;
    const baseURL = process.env.OPENAI_BASE_URL;

    // Validate required configuration
    if (!apiKey) {
      throw new Error(
        'AI_GATEWAY_API_KEY or OPENAI_API_KEY is required when LLM_PROVIDER=gateway\n' +
          'Get your Vercel AI Gateway key at: https://vercel.com/ai-gateway',
      );
    }

    if (!baseURL) {
      throw new Error(
        'OPENAI_BASE_URL is required when LLM_PROVIDER=gateway\n' +
          'Set to your gateway endpoint, e.g., OPENAI_BASE_URL=https://gateway.vercel.app',
      );
    }

    // Validate baseURL format
    if (!baseURL.startsWith('http')) {
      throw new Error('OPENAI_BASE_URL must start with http:// or https://');
    }

    // Create OpenAI-compatible client
    // Works with Vercel AI Gateway, Azure OpenAI, OpenRouter, etc.
    const gateway = createOpenAI({
      apiKey,
      baseURL,
    });

    return gateway(modelName);
  }

  // Invalid provider
  throw new Error(`Invalid LLM_PROVIDER: "${provider}". Supported values: "ollama", "gateway"`);
};
