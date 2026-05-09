"use strict";
/**
 * AiSettingsUseCase - Manage AI provider configuration per company
 *
 * Handles getting and updating the AI provider config.
 * Enforces that the mock provider is always available as a fallback.
 *
 * ENCRYPTION BOUNDARY:
 * This use case is the encryption boundary for API keys.
 * - On updateSettings: Encrypt apiKey before saving to repository
 * - On getSettings: Decrypt apiKey after loading from repository
 * Repositories store/retrieve whatever they're given — they are DB-agnostic
 * and know nothing about encryption.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiSettingsUseCase = void 0;
const AiProviderConfig_1 = require("../../../domain/ai-assistant/entities/AiProviderConfig");
const ProviderFactory_1 = require("../providers/ProviderFactory");
const ApiError_1 = require("../../../api/errors/ApiError");
class AiSettingsUseCase {
    constructor(settingsRepository, encryptionService) {
        this.settingsRepository = settingsRepository;
        this.encryptionService = encryptionService;
    }
    /**
     * Get the AI provider configuration for a company.
     * Returns a safe representation without exposing the API key.
     * Decryption happens here — the domain entity gets the plaintext key
     * but toJSON() strips it from API responses.
     */
    async getSettings(companyId) {
        let config = await this.settingsRepository.getConfig(companyId);
        if (!config) {
            // Return default config (mock provider) if none exists
            config = AiProviderConfig_1.AiProviderConfig.defaultForCompany(companyId);
        }
        else {
            // Decrypt apiKey from storage so the entity has the plaintext value
            // (needed for ProviderFactory to pass to the provider)
            config = this.decryptConfig(config);
        }
        return {
            config: config.toJSON(),
        };
    }
    /**
     * Update the AI provider configuration for a company.
     * Encrypts the API key before storage, then invalidates the provider cache.
     */
    async updateSettings(input) {
        var _a;
        const { companyId } = input;
        // Get existing config or create default
        let config = await this.settingsRepository.getConfig(companyId);
        if (!config) {
            config = AiProviderConfig_1.AiProviderConfig.defaultForCompany(companyId);
        }
        else {
            // Decrypt existing apiKey so entity has plaintext for comparison
            config = this.decryptConfig(config);
        }
        // Validate provider type
        if (input.provider && !this.isValidProviderType(input.provider)) {
            throw ApiError_1.ApiError.badRequest(`Invalid provider type: ${input.provider}. Supported: mock, openai_compatible, ollama`);
        }
        // Validate API key requirements for non-mock providers
        if (input.provider === 'openai_compatible' && !input.apiKey && !config.apiKey) {
            console.warn(`[AI Settings] Company ${companyId} switching to OpenAI-compatible provider without an API key. ` +
                `The system will fall back to mock provider until a key is provided.`);
        }
        // Apply updates to the entity (in plaintext)
        const requestedMode = (_a = input.mode) !== null && _a !== void 0 ? _a : (input.selectedModelProfileId && input.selectedProfileHash
            ? 'certified_profile'
            : undefined);
        config.updateConfig({
            provider: input.provider,
            mode: requestedMode,
            providerId: input.providerId,
            selectedModelProfileId: input.selectedModelProfileId,
            selectedProfileHash: input.selectedProfileHash,
            model: input.model,
            apiKey: input.apiKey,
            apiEndpoint: input.apiEndpoint,
            maxTokensPerRequest: input.maxTokensPerRequest,
            maxRequestsPerDay: input.maxRequestsPerDay,
            conversationContextMode: input.conversationContextMode,
            includePreviousToolResults: input.includePreviousToolResults,
            isEnabled: input.isEnabled,
        });
        // Encrypt apiKey before saving to repository
        const configForStorage = this.encryptConfig(config);
        await this.settingsRepository.saveConfig(configForStorage);
        // Invalidate provider cache for this company
        ProviderFactory_1.ProviderFactory.invalidateCompany(companyId);
        // Return safe config (no API key in output)
        return {
            config: config.toJSON(),
        };
    }
    /**
     * Check if a provider type is supported.
     */
    isValidProviderType(provider) {
        return ['mock', 'openai_compatible', 'ollama'].includes(provider);
    }
    /**
     * Encrypt the apiKey in an AiProviderConfig for storage.
     * Returns a new entity with the encrypted apiKey.
     */
    encryptConfig(config) {
        if (!config.apiKey) {
            // No API key to encrypt (e.g., mock provider or ollama local)
            return config;
        }
        const encrypted = this.encryptionService.encrypt(config.apiKey);
        // Create a copy with encrypted apiKey for storage
        const stored = AiProviderConfig_1.AiProviderConfig.fromJSON(Object.assign(Object.assign({}, config.toJSON()), { apiKey: encrypted, updatedAt: config.updatedAt.toISOString() }));
        return stored;
    }
    /**
     * Decrypt the apiKey in an AiProviderConfig after loading from storage.
     * Returns a new entity with the decrypted (plaintext) apiKey.
     */
    decryptConfig(config) {
        if (!config.apiKey) {
            // No API key to decrypt
            return config;
        }
        // Check if this is a plaintext passthrough from development mode
        // (passthrough is stored as `plain:<value>` by AesEncryptionService)
        if (!config.apiKey.includes(':')) {
            // Likely unencrypted plaintext from before encryption was enabled
            // This can happen during migration — treat as plaintext
            return config;
        }
        try {
            const decrypted = this.encryptionService.decrypt(config.apiKey);
            // Create a copy with decrypted apiKey for the domain entity
            const plain = AiProviderConfig_1.AiProviderConfig.fromJSON(Object.assign(Object.assign({}, config.toJSON()), { apiKey: decrypted, updatedAt: config.updatedAt.toISOString() }));
            return plain;
        }
        catch (error) {
            // If decryption fails, the key might be plaintext from before encryption
            // Log a warning and treat the config as having no valid key
            console.warn(`[AI Settings] Failed to decrypt API key for company ${config.companyId}. ` +
                `The key may be stored in plaintext (pre-encryption). Error: ${error.message}`);
            // Return config as-is — ProviderFactory will fall back to mock if the key is invalid
            return config;
        }
    }
}
exports.AiSettingsUseCase = AiSettingsUseCase;
//# sourceMappingURL=AiSettingsUseCase.js.map