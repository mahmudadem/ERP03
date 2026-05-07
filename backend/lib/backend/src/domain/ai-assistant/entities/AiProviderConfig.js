"use strict";
/**
 * AiProviderConfig - Domain Entity
 *
 * Per-company AI provider configuration stored in company settings.
 * This entity manages HOW the AI assistant communicates with providers.
 * NOT the AI logic itself.
 *
 * Security:
 * - apiKey is NEVER included in toJSON() output (used for API responses)
 * - apiKey IS included in toPersistenceJSON() (used for DB storage ONLY)
 * - After encryption is implemented, toPersistenceJSON() stores the
 *   ENCRYPTED key — plaintext apiKey only exists in memory during a request
 *
 * Rate Limiting:
 * - dailyRequestCount tracks how many requests the company has made today
 * - dailyRequestDate tracks which UTC day the count belongs to
 * - These are incremented by AiRateLimiterService on each successful request
 * - Reset automatically when the day changes
 * - Deleting conversations does NOT affect the rate limit count
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiProviderConfig = void 0;
class AiProviderConfig {
    constructor(companyId, provider, model, apiKey, apiEndpoint, maxTokensPerRequest, maxRequestsPerDay, dailyRequestCount, dailyRequestDate, isEnabled = true, updatedAt = new Date()) {
        this.companyId = companyId;
        this.provider = provider;
        this.model = model;
        this.apiKey = apiKey;
        this.apiEndpoint = apiEndpoint;
        this.maxTokensPerRequest = maxTokensPerRequest;
        this.maxRequestsPerDay = maxRequestsPerDay;
        this.dailyRequestCount = dailyRequestCount;
        this.dailyRequestDate = dailyRequestDate;
        this.isEnabled = isEnabled;
        this.updatedAt = updatedAt;
    }
    static create(input) {
        return new AiProviderConfig(input.companyId, input.provider || 'mock', input.model, input.apiKey, input.apiEndpoint, 4096, // Default max tokens
        100, // Default max requests per day
        0, // dailyRequestCount starts at 0
        undefined, // dailyRequestDate — set on first request
        true, new Date());
    }
    /** Get the default config for a company — uses mock provider for local dev */
    static defaultForCompany(companyId) {
        return new AiProviderConfig(companyId, 'mock', 'mock-assistant', undefined, undefined, 4096, 100, 0, // dailyRequestCount starts at 0
        undefined, // dailyRequestDate not yet set
        true, new Date());
    }
    updateConfig(updates) {
        if (updates.provider !== undefined)
            this.provider = updates.provider;
        if (updates.model !== undefined)
            this.model = updates.model;
        if (updates.apiKey !== undefined)
            this.apiKey = updates.apiKey;
        if (updates.apiEndpoint !== undefined)
            this.apiEndpoint = updates.apiEndpoint;
        if (updates.maxTokensPerRequest !== undefined)
            this.maxTokensPerRequest = updates.maxTokensPerRequest;
        if (updates.maxRequestsPerDay !== undefined)
            this.maxRequestsPerDay = updates.maxRequestsPerDay;
        if (updates.isEnabled !== undefined)
            this.isEnabled = updates.isEnabled;
        // Note: dailyRequestCount and dailyRequestDate are NOT updated via updateConfig
        // They are managed exclusively by AiRateLimiterService
        this.updatedAt = new Date();
    }
    /**
     * Get today's UTC date string for rate limit tracking.
     * Format: 'YYYY-MM-DD'
     */
    static getTodayDateString() {
        const now = new Date();
        return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
    }
    /**
     * Check if the daily count is for today (UTC) and return the count.
     * If the date has changed, returns 0 (indicating the count should reset).
     */
    getTodaysRequestCount() {
        const today = AiProviderConfig.getTodayDateString();
        if (this.dailyRequestDate === today) {
            return this.dailyRequestCount || 0;
        }
        // Date changed — count resets to 0
        return 0;
    }
    /**
     * Increment the daily request count.
     * Automatically resets to 1 if the day has changed.
     */
    incrementDailyRequestCount() {
        const today = AiProviderConfig.getTodayDateString();
        if (this.dailyRequestDate === today) {
            this.dailyRequestCount = (this.dailyRequestCount || 0) + 1;
        }
        else {
            // New day — reset the count
            this.dailyRequestDate = today;
            this.dailyRequestCount = 1;
        }
        this.updatedAt = new Date();
    }
    /**
     * Safe serialization for API responses and any context.
     * NEVER includes the raw API key value.
     * Use hasApiKey boolean to indicate presence without revealing value.
     * Use toPersistenceJSON() for DB storage (includes encrypted apiKey).
     */
    toJSON() {
        // SECURITY: Never include raw apiKey in serialized output.
        // Use hasApiKey boolean instead to indicate presence.
        return {
            companyId: this.companyId,
            provider: this.provider,
            model: this.model || null,
            apiEndpoint: this.apiEndpoint || null,
            maxTokensPerRequest: this.maxTokensPerRequest || null,
            maxRequestsPerDay: this.maxRequestsPerDay || null,
            isEnabled: this.isEnabled,
            updatedAt: this.updatedAt.toISOString(),
            hasApiKey: !!this.apiKey, // Indicate presence without revealing value
        };
    }
    /**
     * Internal serialization for database persistence ONLY.
     * This includes the apiKey (encrypted) and should NEVER be sent to the frontend.
     * Firestore and Prisma repositories use this for storage.
     */
    toPersistenceJSON() {
        return {
            companyId: this.companyId,
            provider: this.provider,
            model: this.model || null,
            apiKey: this.apiKey || null,
            apiEndpoint: this.apiEndpoint || null,
            maxTokensPerRequest: this.maxTokensPerRequest || null,
            maxRequestsPerDay: this.maxRequestsPerDay || null,
            dailyRequestCount: this.dailyRequestCount || 0,
            dailyRequestDate: this.dailyRequestDate || null,
            isEnabled: this.isEnabled,
            updatedAt: this.updatedAt.toISOString(),
        };
    }
    static fromJSON(data) {
        var _a, _b, _c;
        return new AiProviderConfig(data.companyId, data.provider || 'mock', data.model || undefined, data.apiKey || undefined, data.apiEndpoint || undefined, data.maxTokensPerRequest || undefined, data.maxRequestsPerDay || undefined, (_a = data.dailyRequestCount) !== null && _a !== void 0 ? _a : 0, data.dailyRequestDate || undefined, data.isEnabled !== undefined ? data.isEnabled : true, ((_c = (_b = data.updatedAt) === null || _b === void 0 ? void 0 : _b.toDate) === null || _c === void 0 ? void 0 : _c.call(_b)) || new Date(data.updatedAt));
    }
}
exports.AiProviderConfig = AiProviderConfig;
//# sourceMappingURL=AiProviderConfig.js.map