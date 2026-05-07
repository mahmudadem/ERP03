"use strict";
/**
 * AiUsageLog - Domain Entity
 *
 * Tracks per-request AI usage for analytics, auditing, and billing.
 * This entity is ANALYTICS ONLY — it must NOT be used for rate limiting.
 * Rate limiting is handled by AiRateLimiterService using config-based counters.
 *
 * Security:
 * - NEVER includes raw apiKey
 * - errorCode is a normalized code (not a raw HTTP status or provider error message)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiUsageLog = void 0;
class AiUsageLog {
    constructor(id, companyId, userId, providerType, model, messageCount, promptTokens, completionTokens, totalTokens, status = 'success', errorCode, latencyMs, createdAt = new Date()) {
        this.id = id;
        this.companyId = companyId;
        this.userId = userId;
        this.providerType = providerType;
        this.model = model;
        this.messageCount = messageCount;
        this.promptTokens = promptTokens;
        this.completionTokens = completionTokens;
        this.totalTokens = totalTokens;
        this.status = status;
        this.errorCode = errorCode;
        this.latencyMs = latencyMs;
        this.createdAt = createdAt;
    }
    static create(input) {
        const id = `aiul_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        return new AiUsageLog(id, input.companyId, input.userId, input.providerType, input.model, input.messageCount, input.promptTokens, input.completionTokens, input.totalTokens, input.status, input.errorCode, input.latencyMs, new Date());
    }
    toJSON() {
        var _a, _b, _c, _d, _e;
        return {
            id: this.id,
            companyId: this.companyId,
            userId: this.userId,
            providerType: this.providerType,
            model: this.model,
            messageCount: this.messageCount,
            promptTokens: (_a = this.promptTokens) !== null && _a !== void 0 ? _a : null,
            completionTokens: (_b = this.completionTokens) !== null && _b !== void 0 ? _b : null,
            totalTokens: (_c = this.totalTokens) !== null && _c !== void 0 ? _c : null,
            status: this.status,
            errorCode: (_d = this.errorCode) !== null && _d !== void 0 ? _d : null,
            latencyMs: (_e = this.latencyMs) !== null && _e !== void 0 ? _e : null,
            createdAt: this.createdAt.toISOString(),
        };
    }
    static fromJSON(data) {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        return new AiUsageLog(data.id, data.companyId, data.userId, data.providerType, data.model, (_a = data.messageCount) !== null && _a !== void 0 ? _a : 0, (_b = data.promptTokens) !== null && _b !== void 0 ? _b : undefined, (_c = data.completionTokens) !== null && _c !== void 0 ? _c : undefined, (_d = data.totalTokens) !== null && _d !== void 0 ? _d : undefined, data.status || 'success', (_e = data.errorCode) !== null && _e !== void 0 ? _e : undefined, (_f = data.latencyMs) !== null && _f !== void 0 ? _f : undefined, ((_h = (_g = data.createdAt) === null || _g === void 0 ? void 0 : _g.toDate) === null || _h === void 0 ? void 0 : _h.call(_g)) || new Date(data.createdAt));
    }
}
exports.AiUsageLog = AiUsageLog;
//# sourceMappingURL=AiUsageLog.js.map