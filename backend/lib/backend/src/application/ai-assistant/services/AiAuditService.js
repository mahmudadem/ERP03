"use strict";
/**
 * AiAuditService - Wraps IAuditLogRepository for AI-specific audit events
 *
 * Logs AI runtime events (AI_RUN_STARTED, AI_TOOL_CALL_APPROVED,
 * AI_TOOL_CALL_REJECTED, AI_RUN_COMPLETED, AI_RUN_FAILED) for security
 * and compliance.
 *
 * CRITICAL RULES:
 * - Audit failures MUST NEVER block chat — errors are caught and logged
 * - Never log secrets, API keys, or raw provider config
 * - Never log raw tool arguments that may contain sensitive user data;
 *   log argument KEYS only
 * - Log companyId, conversationId, aiRunId, provider/model, and
 *   tool-related metadata
 *
 * This service uses the existing system IAuditLogRepository and maps
 * AI events to the AuditLog format.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiAuditService = void 0;
const AuditLog_1 = require("../../../domain/system/entities/AuditLog");
class AiAuditService {
    constructor(auditLogRepository) {
        this.auditLogRepository = auditLogRepository;
    }
    /**
     * Log an AI audit event. Never throws — errors are caught and logged to console.
     */
    async log(eventType, meta) {
        var _a;
        try {
            // Sanitize meta: never include secrets or raw tool arguments
            const sanitizedMeta = this.sanitizeMeta(meta);
            const entry = new AuditLog_1.AuditLog(`ai-audit-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`, eventType, 'AiRun', meta.aiRunId, (_a = meta.userId) !== null && _a !== void 0 ? _a : 'system', new Date(), sanitizedMeta);
            await this.auditLogRepository.log(entry);
        }
        catch (error) {
            // Audit failure MUST NEVER block chat
            console.warn(`[AiAuditService] Failed to log audit event '${eventType}' for run '${meta.aiRunId}': ${error.message}`);
        }
    }
    /**
     * Sanitize meta before logging:
     * - Only include argument KEYS, not values (may contain sensitive data)
     * - Never include API keys or provider config
     * - Truncate long strings to prevent oversized audit entries
     */
    sanitizeMeta(meta) {
        const result = {
            companyId: meta.companyId,
            userId: meta.userId,
            conversationId: meta.conversationId,
            aiRunId: meta.aiRunId,
        };
        if (meta.providerModel)
            result.providerModel = meta.providerModel;
        if (meta.selectedSkills)
            result.selectedSkills = meta.selectedSkills;
        if (meta.allowedToolIds)
            result.allowedToolIds = meta.allowedToolIds;
        if (meta.toolCallKeys)
            result.toolCallKeys = meta.toolCallKeys;
        if (meta.resolvedOriginalName)
            result.resolvedOriginalName = meta.resolvedOriginalName;
        if (meta.operationType)
            result.operationType = meta.operationType;
        if (meta.rejectionReason)
            result.rejectionReason = this.truncate(meta.rejectionReason, 500);
        if (meta.rejectionCode)
            result.rejectionCode = meta.rejectionCode;
        if (meta.tokenUsage)
            result.tokenUsage = meta.tokenUsage;
        if (meta.durationMs !== undefined)
            result.durationMs = meta.durationMs;
        if (meta.runtimeStatus)
            result.runtimeStatus = meta.runtimeStatus;
        if (meta.modelWarnings)
            result.modelWarnings = meta.modelWarnings;
        if (meta.toolCallsRequested)
            result.toolCallsRequested = meta.toolCallsRequested;
        if (meta.errorMessage)
            result.errorMessage = this.truncate(meta.errorMessage, 500);
        return result;
    }
    truncate(str, maxLen) {
        if (str.length <= maxLen)
            return str;
        return str.substring(0, maxLen) + '...[truncated]';
    }
}
exports.AiAuditService = AiAuditService;
//# sourceMappingURL=AiAuditService.js.map