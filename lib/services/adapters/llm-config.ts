/**
 * LLM provider configuration for Vercel AI SDK v5
 * Using Vercel AI SDK v5.0+ - https://ai-sdk.dev/
 *
 * Supports:
 * - Ollama (local/remote): https://ai-sdk.dev/providers/community-providers/ollama
 * - OpenAI (direct or via gateway): https://ai-sdk.dev/providers/ai-sdk-providers/openai
 *
 * Configuration via environment variables (see .env.example):
 * - LLM_PROVIDER: 'ollama' or 'openai' (required)
 * - OLLAMA_HOST: Ollama server URL (optional, defaults to http://localhost:11434)
 * - OPENAI_API_KEY: OpenAI API key (required when LLM_PROVIDER=openai)
 * - OPENAI_BASE_URL: Custom OpenAI endpoint (optional, for Vercel AI Gateway, Azure, etc.)
 */

import { ollama } from 'ollama-ai-provider-v2';
import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';

export type LLMProvider = 'ollama' | 'openai';

/**
 * Provider configuration interface
 */
interface ProviderConfig {
  createModel: (modelName: string) => LanguageModel;
  validate: () => { valid: boolean; errors: string[] };
  requiredEnvVars: string[];
}

/**
 * Provider registry - maps provider names to factory functions
 *
 * To add a new provider:
 * 1. Add provider to LLMProvider type
 * 2. Add entry to PROVIDERS registry
 * 3. Implement createModel and validate functions
 */
const PROVIDERS: Record<LLMProvider, ProviderConfig> = {
  ollama: {
    createModel: (modelName: string) => {
      // Ollama provider reads OLLAMA_HOST from env
      // Defaults to http://localhost:11434 if not set
      return ollama(modelName);
    },
    validate: () => {
      const errors: string[] = [];

      // Validate OLLAMA_HOST format if provided
      const host = process.env.OLLAMA_HOST;
      if (host && !host.startsWith('http')) {
        errors.push('OLLAMA_HOST must start with http:// or https://');
      }

      return { valid: errors.length === 0, errors };
    },
    requiredEnvVars: [], // OLLAMA_HOST is optional (has default)
  },

  openai: {
    createModel: (modelName: string) => {
      const apiKey = process.env.OPENAI_API_KEY;
      const baseURL = process.env.OPENAI_BASE_URL;

      // Create OpenAI provider instance
      // If baseURL is set, can point to Vercel AI Gateway, Azure, or custom endpoint
      const openai = createOpenAI({
        apiKey, // SDK auto-detects from OPENAI_API_KEY env var if not provided
        ...(baseURL && { baseURL }), // Optional custom endpoint
      });

      return openai(modelName);
    },
    validate: () => {
      const errors: string[] = [];

      // Check required env vars
      if (!process.env.OPENAI_API_KEY) {
        errors.push('OPENAI_API_KEY is required when using OpenAI provider');
      }

      // Validate baseURL format if provided
      const baseURL = process.env.OPENAI_BASE_URL;
      if (baseURL && !baseURL.startsWith('http')) {
        errors.push('OPENAI_BASE_URL must start with http:// or https://');
      }

      return { valid: errors.length === 0, errors };
    },
    requiredEnvVars: ['OPENAI_API_KEY'],
  },
};

/**
 * Get configured LLM provider from environment
 *
 * @throws Error if LLM_PROVIDER not set or invalid
 */
export const getLLMProvider = (): LLMProvider => {
  const provider = process.env.LLM_PROVIDER as LLMProvider;

  if (!provider) {
    throw new Error('LLM_PROVIDER environment variable is required. Set to "ollama" or "openai" in your .env file');
  }

  if (!PROVIDERS[provider]) {
    throw new Error(`Invalid LLM_PROVIDER: "${provider}". Supported providers: ${Object.keys(PROVIDERS).join(', ')}`);
  }

  return provider;
};

/**
 * Validate current provider configuration
 *
 * Use this at app startup to fail fast with clear error messages.
 *
 * @returns Validation result with errors if any
 *
 * @example
 * // In app initialization
 * const validation = validateLLMConfig();
 * if (!validation.valid) {
 *   console.error('LLM configuration invalid:', validation.errors);
 *   process.exit(1);
 * }
 */
export const validateLLMConfig = (): { valid: boolean; errors: string[] } => {
  try {
    const provider = getLLMProvider();
    const config = PROVIDERS[provider];
    return config.validate();
  } catch (error) {
    return {
      valid: false,
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }
};

/**
 * Create a Vercel AI SDK model instance
 *
 * Provider is determined by LLM_PROVIDER environment variable.
 * Configuration validated before creating model (fails fast).
 *
 * @param modelName - Model identifier (e.g., 'llama3.1', 'gpt-4o')
 * @returns Vercel AI SDK LanguageModel instance
 * @throws Error if configuration invalid
 *
 * @example
 * // Ollama (LLM_PROVIDER=ollama)
 * const model = createAIModel('llama3.1');
 *
 * @example
 * // OpenAI direct (LLM_PROVIDER=openai)
 * const model = createAIModel('gpt-4o');
 *
 * @example
 * // OpenAI via Vercel AI Gateway (LLM_PROVIDER=openai, OPENAI_BASE_URL=https://gateway.vercel.app)
 * const model = createAIModel('gpt-4o');
 */
export const createAIModel = (modelName: string): LanguageModel => {
  const provider = getLLMProvider();
  const config = PROVIDERS[provider];

  // Validate configuration before creating model
  const validation = config.validate();
  if (!validation.valid) {
    throw new Error(
      `Invalid ${provider} provider configuration:\n${validation.errors.map((e) => `  - ${e}`).join('\n')}`,
    );
  }

  return config.createModel(modelName);
};
