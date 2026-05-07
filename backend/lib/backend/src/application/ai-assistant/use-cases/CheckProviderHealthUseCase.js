"use strict";
/**
 * CheckProviderHealthUseCase - Tests AI provider connectivity and inference readiness
 *
 * This use case performs two checks:
 * 1. Network check: Calls isAvailable() to test API connectivity
 * 2. Inference check: Sends a safe prompt "Reply with only: provider-ok"
 *    to verify the model can actually generate a response
 *
 * Important:
 * - The inference check consumes real tokens (costs money for paid providers)
 * - This should be called on-demand (e.g., "Test Connection" button), not on every page load
 * - The safe prompt does NOT include any ERP data
 * - The API key is NEVER exposed in the response
 * - Errors are sanitized to prevent information leakage
 * - A cooldown of 60 seconds per company prevents abuse
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CheckProviderHealthUseCase = void 0;
const AiProviderConfig_1 = require("../../../domain/ai-assistant/entities/AiProviderConfig");
const ProviderFactory_1 = require("../providers/ProviderFactory");
const ProviderErrors_1 = require("../../../errors/ProviderErrors");
const ApiError_1 = require("../../../api/errors/ApiError");
/** Cooldown period in milliseconds between health checks per company */
const HEALTH_CHECK_COOLDOWN_MS = 60000; // 60 seconds
/** Map of companyId → last health check timestamp */
const lastHealthCheck = new Map();
class CheckProviderHealthUseCase {
    constructor(settingsRepository, encryptionService, httpClient) {
        this.settingsRepository = settingsRepository;
        this.encryptionService = encryptionService;
        this.httpClient = httpClient;
    }
    async execute(companyId) {
        // Cooldown check: prevent spamming the health check endpoint
        const lastCheck = lastHealthCheck.get(companyId) || 0;
        const timeSinceLastCheck = Date.now() - lastCheck;
        if (timeSinceLastCheck < HEALTH_CHECK_COOLDOWN_MS) {
            const remainingSeconds = Math.ceil((HEALTH_CHECK_COOLDOWN_MS - timeSinceLastCheck) / 1000);
            throw ApiError_1.ApiError.custom(429, `Health check cooldown active. Please wait ${remainingSeconds} seconds before testing again.`, 'HEALTH_CHECK_COOLDOWN');
        }
        // Get config
        let config = await this.settingsRepository.getConfig(companyId);
        if (!config) {
            config = AiProviderConfig_1.AiProviderConfig.defaultForCompany(companyId);
        }
        else {
            config = this.decryptConfig(config);
        }
        // Check if AI is enabled
        if (!config.isEnabled) {
            return {
                ready: false,
                networkOk: false,
                inferenceOk: false,
                provider: config.provider,
                model: config.model || 'unknown',
                reason: 'AI Assistant is not enabled for this company',
            };
        }
        const provider = ProviderFactory_1.ProviderFactory.getProvider(config, this.httpClient);
        // Step 1: Network connectivity check
        let networkOk = false;
        let networkError;
        try {
            networkOk = await provider.isAvailable();
        }
        catch (error) {
            networkError = this.sanitizeError(error);
        }
        // Step 2: Inference check (safe prompt only)
        let inferenceOk = false;
        let inferenceError;
        try {
            const response = await provider.chat({
                messages: [
                    { role: 'user', content: 'Reply with only: provider-ok' },
                ],
                maxTokens: 10,
                temperature: 0,
            });
            // The provider responded without error — inference works
            // We don't strictly require the response to contain "provider-ok"
            // because some models add extra text. The fact that it returned
            // a non-error response is sufficient.
            inferenceOk = true;
        }
        catch (error) {
            inferenceError = this.sanitizeError(error);
        }
        // Determine overall ready status
        const ready = networkOk && inferenceOk;
        // Build reason message (never includes API key or sensitive data)
        let reason;
        if (!networkOk && !inferenceOk) {
            reason = inferenceError || networkError || 'Provider is not responding';
        }
        else if (!networkOk) {
            reason = networkError || 'Network connectivity check failed';
        }
        else if (!inferenceOk) {
            reason = inferenceError || 'Inference check failed — the model could not generate a response';
        }
        // Record the health check timestamp for cooldown
        lastHealthCheck.set(companyId, Date.now());
        return {
            ready,
            networkOk,
            inferenceOk,
            provider: config.provider,
            model: config.model || provider.providerName,
            reason,
        };
    }
    /**
     * Reset the health check cooldown for a company (useful for testing).
     */
    static resetCooldown(companyId) {
        if (companyId) {
            lastHealthCheck.delete(companyId);
        }
        else {
            lastHealthCheck.clear();
        }
    }
    /**
     * Decrypt the apiKey in an AiProviderConfig after loading from storage.
     */
    decryptConfig(config) {
        if (!config.apiKey) {
            return config;
        }
        if (config.apiKey.startsWith('plain:')) {
            const plainKey = config.apiKey.substring(6);
            return AiProviderConfig_1.AiProviderConfig.fromJSON(Object.assign(Object.assign({}, config.toJSON()), { apiKey: plainKey, updatedAt: config.updatedAt.toISOString() }));
        }
        try {
            const decrypted = this.encryptionService.decrypt(config.apiKey);
            return AiProviderConfig_1.AiProviderConfig.fromJSON(Object.assign(Object.assign({}, config.toJSON()), { apiKey: decrypted, updatedAt: config.updatedAt.toISOString() }));
        }
        catch (error) {
            console.warn(`[AI Assistant] Failed to decrypt API key for company ${config.companyId}. ` +
                `Error: ${error.message}`);
            return config;
        }
    }
    /**
     * Sanitize error messages to prevent API key or endpoint leakage.
     * Returns a generic, user-safe error description.
     */
    sanitizeError(error) {
        if (error instanceof ProviderErrors_1.ProviderError) {
            const pe = error;
            // Map to normalized status descriptions — never include raw messages
            const statusCode = pe.statusCode;
            if (statusCode === 401)
                return 'Authentication failed — check your API key';
            if (statusCode === 429)
                return 'Rate limit exceeded — try again later';
            if (statusCode === 503)
                return 'Provider is temporarily unavailable';
            if (statusCode === 502)
                return 'Provider returned an error response';
            return 'Provider error — please check your configuration';
        }
        if (error instanceof Error) {
            // Don't include raw error messages — they may contain URLs, keys, etc.
            if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
                return 'Request timed out — check your network connection';
            }
            if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
                return 'Could not connect to the provider — check the endpoint URL';
            }
            return 'An unexpected error occurred while checking the provider';
        }
        return 'An unknown error occurred';
    }
}
exports.CheckProviderHealthUseCase = CheckProviderHealthUseCase;
//# sourceMappingURL=CheckProviderHealthUseCase.js.map