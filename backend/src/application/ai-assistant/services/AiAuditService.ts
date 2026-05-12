/**
 * AiAuditService - Wraps IAuditLogRepository for AI-specific audit events
 *
 * Logs AI runtime events (AI_RUN_STARTED, AI_TOOL_CALL_APPROVED,
 * AI_TOOL_CALL_REJECTED, AI_RUN_COMPLETED, AI_RUN_FAILED,
 * AI_CREDIT_DEBIT_FAILED) for security and compliance.
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

import { IAuditLogRepository } from '../../../repository/interfaces/system/IAuditLogRepository';
import { AuditLog } from '../../../domain/system/entities/AuditLog';

export type AiAuditEventType =
  | 'AI_RUN_STARTED'
  | 'AI_TOOL_CALL_APPROVED'
  | 'AI_TOOL_CALL_REJECTED'
  | 'AI_RUN_COMPLETED'
  | 'AI_RUN_FAILED'
  | 'AI_CREDIT_DEBIT_FAILED';

export interface AiAuditMeta {
  companyId: string;
  userId?: string;
  conversationId: string;
  aiRunId: string;
  /** Provider and model, e.g. "mock/gpt-4" */
  providerModel?: string;
  /** Skills selected for this run */
  selectedSkills?: string[];
  /** Tools allowed for this run */
  allowedToolIds?: string[];
  /** Tool call requested (keys only, not values — may contain sensitive data) */
  toolCallKeys?: string[];
  /** Original tool name resolved from provider-safe name */
  resolvedOriginalName?: string;
  /** Operation type of the tool */
  operationType?: string;
  /** If rejected, the reason */
  rejectionReason?: string;
  /** If rejected, the machine-readable code */
  rejectionCode?: string;
  /** Token usage if available */
  tokenUsage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  /** Duration in milliseconds */
  durationMs?: number;
  /** Runtime status: 'completed' | 'failed' | 'partial' */
  runtimeStatus?: string;
  /** Model profile warnings */
  modelWarnings?: string[];
  /** If failed, the error message (sanitized — no secrets) */
  errorMessage?: string;
  /** Tool calls requested in this run */
  toolCallsRequested?: string[];
}

export class AiAuditService {
  constructor(private auditLogRepository: IAuditLogRepository) {}

  /**
   * Log an AI audit event. Never throws — errors are caught and logged to console.
   */
  async log(eventType: AiAuditEventType, meta: AiAuditMeta): Promise<void> {
    try {
      // Sanitize meta: never include secrets or raw tool arguments
      const sanitizedMeta = this.sanitizeMeta(meta);

      const entry = new AuditLog(
        `ai-audit-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
        eventType,
        'AiRun',
        meta.aiRunId,
        meta.userId ?? 'system',
        new Date(),
        sanitizedMeta,
      );

      await this.auditLogRepository.log(entry);
    } catch (error) {
      // Audit failure MUST NEVER block chat
      console.warn(
        `[AiAuditService] Failed to log audit event '${eventType}' for run '${meta.aiRunId}': ${(error as Error).message}`
      );
    }
  }

  /**
   * Sanitize meta before logging:
   * - Only include argument KEYS, not values (may contain sensitive data)
   * - Never include API keys or provider config
   * - Truncate long strings to prevent oversized audit entries
   */
  private sanitizeMeta(meta: AiAuditMeta): Record<string, unknown> {
    const result: Record<string, unknown> = {
      companyId: meta.companyId,
      userId: meta.userId,
      conversationId: meta.conversationId,
      aiRunId: meta.aiRunId,
    };

    if (meta.providerModel) result.providerModel = meta.providerModel;
    if (meta.selectedSkills) result.selectedSkills = meta.selectedSkills;
    if (meta.allowedToolIds) result.allowedToolIds = meta.allowedToolIds;
    if (meta.toolCallKeys) result.toolCallKeys = meta.toolCallKeys;
    if (meta.resolvedOriginalName) result.resolvedOriginalName = meta.resolvedOriginalName;
    if (meta.operationType) result.operationType = meta.operationType;
    if (meta.rejectionReason) result.rejectionReason = this.truncate(meta.rejectionReason, 500);
    if (meta.rejectionCode) result.rejectionCode = meta.rejectionCode;
    if (meta.tokenUsage) result.tokenUsage = meta.tokenUsage;
    if (meta.durationMs !== undefined) result.durationMs = meta.durationMs;
    if (meta.runtimeStatus) result.runtimeStatus = meta.runtimeStatus;
    if (meta.modelWarnings) result.modelWarnings = meta.modelWarnings;
    if (meta.toolCallsRequested) result.toolCallsRequested = meta.toolCallsRequested;
    if (meta.errorMessage) result.errorMessage = this.truncate(meta.errorMessage, 500);

    return result;
  }

  private truncate(str: string, maxLen: number): string {
    if (str.length <= maxLen) return str;
    return str.substring(0, maxLen) + '...[truncated]';
  }
}
