/**
 * Ollama-specific health check and model management utilities
 * Uses direct Ollama REST API calls - https://ollama.com/
 *
 * These utilities are primarily for:
 * - Test scripts (ensuring Ollama is running before tests)
 * - Development tooling (checking model availability)
 * - Future operational monitoring
 *
 * NOT used by the main application flow - errors bubble naturally from Vercel AI SDK
 */

/**
 * Configuration for Ollama health checks
 */
export interface OllamaHealthCheckConfig {
  /** Ollama server host (default: http://localhost:11434) */
  host?: string;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<OllamaHealthCheckConfig> = {
  host: process.env.OLLAMA_HOST || 'http://localhost:11434',
};

/**
 * Ollama health check and model management
 * Provider-specific utility for operational concerns
 */
export class OllamaHealthCheck {
  private config: Required<OllamaHealthCheckConfig>;

  constructor(config?: OllamaHealthCheckConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Check if Ollama is available and list available models
   * Uses Ollama REST API: GET /api/tags
   *
   * @returns Health status and list of available models
   */
  async checkHealth(): Promise<{ available: boolean; models: string[] }> {
    try {
      const response = await fetch(`${this.config.host}/api/tags`);
      if (!response.ok) {
        return { available: false, models: [] };
      }
      const data = await response.json();
      const modelNames = data.models?.map((m: { name: string }) => m.name) || [];
      return { available: true, models: modelNames };
    } catch {
      return { available: false, models: [] };
    }
  }

  /**
   * Pull a model if not available locally
   * Uses Ollama REST API: POST /api/pull
   *
   * @param modelName - Name of the model to pull (e.g., 'llama3.1')
   * @throws Error if pull fails
   */
  async ensureModel(modelName: string): Promise<void> {
    try {
      const health = await this.checkHealth();
      if (!health.models.some((m) => m.startsWith(modelName))) {
        console.log(`Pulling model ${modelName}...`);
        const response = await fetch(`${this.config.host}/api/pull`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: modelName }),
        });
        if (!response.ok) {
          throw new Error(`Failed to pull model: ${response.statusText}`);
        }
      }
    } catch (error) {
      throw new Error(
        `Failed to ensure model ${modelName}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}

/**
 * Factory function to create an Ollama health check instance
 *
 * @param config - Optional configuration override
 * @returns OllamaHealthCheck instance
 *
 * @example
 * ```typescript
 * const healthCheck = createOllamaHealthCheck();
 * const { available, models } = await healthCheck.checkHealth();
 * if (available) {
 *   await healthCheck.ensureModel('llama3.1');
 * }
 * ```
 */
export const createOllamaHealthCheck = (config?: OllamaHealthCheckConfig): OllamaHealthCheck => {
  return new OllamaHealthCheck(config);
};
