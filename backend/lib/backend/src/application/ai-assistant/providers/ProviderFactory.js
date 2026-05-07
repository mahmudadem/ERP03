"use strict";
/**
 * ProviderFactory - Creates the appropriate AI provider based on company config
 *
 * This factory determines which provider to use for a given company configuration:
 * - 'mock' → MockProvider (always available, no keys needed)
 * - 'openai_compatible' → OpenAICompatibleProvider (needs API key + endpoint)
 * - 'ollama' → OpenAICompatibleProvider with local endpoint
 *
 * Design goals:
 * - Provider selection is based on company config (AiProviderConfig)
 * - No hardcoded provider strategies
 * - Easy to add new providers
 * - MockProvider is the safe default for development
 * - Falls back to MockProvider if real provider configuration is invalid
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProviderFactory = void 0;
const MockProvider_1 = require("./MockProvider");
const OpenAICompatibleProvider_1 = require("./OpenAICompatibleProvider");
// Cache providers per company to avoid re-creating on every request
const providerCache = new Map();
class ProviderFactory {
    /**
     * Get or create the appropriate AI provider for a company.
     *
     * Falls back to MockProvider if:
     * - Provider type is 'mock'
     * - Provider type is unknown
     * - OpenAI-compatible provider has no API key
     * - Provider construction fails for any reason
     *
     * @param config - The company's AI provider configuration
     * @param httpClient - HTTP client for making API calls to external providers
     * @returns The appropriate IAiProvider instance
     */
    static getProvider(config, httpClient) {
        const cacheKey = `${config.companyId}:${config.provider}:${config.model || 'default'}`;
        // Return cached provider if config hasn't changed
        const cached = providerCache.get(cacheKey);
        if (cached) {
            return cached;
        }
        let provider;
        switch (config.provider) {
            case 'mock':
                provider = new MockProvider_1.MockProvider();
                break;
            case 'openai_compatible':
                provider = ProviderFactory.createOpenAICompatibleProvider(config, httpClient);
                break;
            case 'ollama':
                provider = ProviderFactory.createOllamaProvider(config, httpClient);
                break;
            default:
                console.warn(`[AI Assistant] Unknown provider '${config.provider}' for company ${config.companyId}. ` +
                    `Falling back to mock provider.`);
                provider = new MockProvider_1.MockProvider();
        }
        providerCache.set(cacheKey, provider);
        return provider;
    }
    /**
     * Create an OpenAI-compatible provider.
     * Falls back to MockProvider if no API key is configured.
     */
    static createOpenAICompatibleProvider(config, httpClient) {
        if (!config.apiKey) {
            console.warn(`[AI Assistant] Company ${config.companyId} has OpenAI-compatible provider ` +
                `configured but no API key. Falling back to mock provider.`);
            return new MockProvider_1.MockProvider();
        }
        try {
            return new OpenAICompatibleProvider_1.OpenAICompatibleProvider({
                apiKey: config.apiKey,
                apiEndpoint: config.apiEndpoint || 'https://api.openai.com/v1',
                model: config.model || 'gpt-3.5-turbo',
                maxTokens: config.maxTokensPerRequest || 4096,
            }, httpClient);
        }
        catch (error) {
            console.warn(`[AI Assistant] Failed to create OpenAI-compatible provider for company ${config.companyId}: ` +
                `${error.message}. Falling back to mock provider.`);
            return new MockProvider_1.MockProvider();
        }
    }
    /**
     * Create an Ollama (local) provider.
     * Ollama doesn't require an API key — uses a sentinel value.
     */
    static createOllamaProvider(config, httpClient) {
        try {
            return new OpenAICompatibleProvider_1.OpenAICompatibleProvider({
                apiKey: 'local-no-key',
                apiEndpoint: config.apiEndpoint || 'http://localhost:11434/v1',
                model: config.model || 'llama3',
                maxTokens: config.maxTokensPerRequest || 4096,
            }, httpClient);
        }
        catch (error) {
            console.warn(`[AI Assistant] Failed to create Ollama provider for company ${config.companyId}: ` +
                `${error.message}. Falling back to mock provider.`);
            return new MockProvider_1.MockProvider();
        }
    }
    /**
     * Clear the provider cache (useful for testing or when config changes).
     */
    static clearCache() {
        providerCache.clear();
    }
    /**
     * Remove a specific company's cached provider (called when config updates).
     */
    static invalidateCompany(companyId) {
        for (const key of providerCache.keys()) {
            if (key.startsWith(`${companyId}:`)) {
                providerCache.delete(key);
            }
        }
    }
}
exports.ProviderFactory = ProviderFactory;
//# sourceMappingURL=ProviderFactory.js.map