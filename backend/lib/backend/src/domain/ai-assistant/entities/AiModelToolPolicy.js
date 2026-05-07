"use strict";
/**
 * AiModelToolPolicy - Domain Entity
 *
 * Controls which tools a specific AI provider/model combination can use.
 * This is per-provider-model configuration, NOT per-company.
 *
 * Default policy:
 * - defaultToolPolicy = 'read-only'  (only read-only tools allowed)
 * - allowReadOnlyTools = true
 * - allowProposalTools = false
 * - allowWriteTools = false           (write tools ALWAYS blocked)
 * - requireExplicitUserIntent = true  (deterministic mapping only)
 * - requireDeterministicMapping = true (no free-form AI function calling)
 *
 * Super Admin can override these per provider/model.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiModelToolPolicy = void 0;
class AiModelToolPolicy {
    constructor(id, providerConfigId, providerType, model, defaultToolPolicy = 'read-only', allowedTools = [], disabledTools = [], allowReadOnlyTools = true, allowProposalTools = false, allowWriteTools = false, // ALWAYS false — write tools blocked
    maxToolCallsPerMessage = 2, maxToolResultBytes = 50000, requireExplicitUserIntent = true, requireDeterministicMapping = true, createdAt = new Date(), updatedAt = new Date()) {
        this.id = id;
        this.providerConfigId = providerConfigId;
        this.providerType = providerType;
        this.model = model;
        this.defaultToolPolicy = defaultToolPolicy;
        this.allowedTools = allowedTools;
        this.disabledTools = disabledTools;
        this.allowReadOnlyTools = allowReadOnlyTools;
        this.allowProposalTools = allowProposalTools;
        this.allowWriteTools = allowWriteTools;
        this.maxToolCallsPerMessage = maxToolCallsPerMessage;
        this.maxToolResultBytes = maxToolResultBytes;
        this.requireExplicitUserIntent = requireExplicitUserIntent;
        this.requireDeterministicMapping = requireDeterministicMapping;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }
    /**
     * Check if a specific tool is allowed for this provider/model combination.
     */
    isToolAllowed(toolName, toolMode) {
        // Write tools are ALWAYS blocked
        if (toolMode === 'write')
            return false;
        // Explicitly disabled = hard block
        if (this.disabledTools.includes(toolName))
            return false;
        // Explicitly allowed = hard allow (unless write)
        if (this.allowedTools.includes(toolName))
            return true;
        // Policy-based checks
        if (this.defaultToolPolicy === 'none')
            return false;
        if (toolMode === 'proposal' && !this.allowProposalTools)
            return false;
        if (toolMode === 'read-only' && !this.allowReadOnlyTools)
            return false;
        return true;
    }
    toJSON() {
        return {
            id: this.id,
            providerConfigId: this.providerConfigId,
            providerType: this.providerType,
            model: this.model,
            defaultToolPolicy: this.defaultToolPolicy,
            allowedTools: this.allowedTools,
            disabledTools: this.disabledTools,
            allowReadOnlyTools: this.allowReadOnlyTools,
            allowProposalTools: this.allowProposalTools,
            allowWriteTools: this.allowWriteTools,
            maxToolCallsPerMessage: this.maxToolCallsPerMessage,
            maxToolResultBytes: this.maxToolResultBytes,
            requireExplicitUserIntent: this.requireExplicitUserIntent,
            requireDeterministicMapping: this.requireDeterministicMapping,
            createdAt: this.createdAt.toISOString(),
            updatedAt: this.updatedAt.toISOString(),
        };
    }
    static fromJSON(data) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
        return new AiModelToolPolicy(data.id, data.providerConfigId, data.providerType, data.model, (_a = data.defaultToolPolicy) !== null && _a !== void 0 ? _a : 'read-only', (_b = data.allowedTools) !== null && _b !== void 0 ? _b : [], (_c = data.disabledTools) !== null && _c !== void 0 ? _c : [], (_d = data.allowReadOnlyTools) !== null && _d !== void 0 ? _d : true, (_e = data.allowProposalTools) !== null && _e !== void 0 ? _e : false, (_f = data.allowWriteTools) !== null && _f !== void 0 ? _f : false, (_g = data.maxToolCallsPerMessage) !== null && _g !== void 0 ? _g : 2, (_h = data.maxToolResultBytes) !== null && _h !== void 0 ? _h : 50000, (_j = data.requireExplicitUserIntent) !== null && _j !== void 0 ? _j : true, (_k = data.requireDeterministicMapping) !== null && _k !== void 0 ? _k : true, new Date(data.createdAt), new Date(data.updatedAt));
    }
}
exports.AiModelToolPolicy = AiModelToolPolicy;
//# sourceMappingURL=AiModelToolPolicy.js.map