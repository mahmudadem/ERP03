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

export type AiUsageStatus = 'success' | 'failure';

export interface AiUsageLogProps {
  id: string;
  companyId: string;
  userId: string;
  providerType: string;       // 'mock' | 'openai_compatible' | 'ollama'
  model: string;               // Provider-specific model identifier
  messageCount: number;        // Number of messages in the request context
  promptTokens?: number;       // Tokens in the prompt (if provider reports them)
  completionTokens?: number;   // Tokens in the completion (if provider reports them)
  totalTokens?: number;        // Total tokens used (if provider reports them)
  status: AiUsageStatus;       // 'success' or 'failure'
  errorCode?: string;          // Normalized error code (e.g., 'AI_PROVIDER_AUTH_ERROR')
  latencyMs?: number;          // Time from request to response in milliseconds
  createdAt: Date;
}

export class AiUsageLog implements AiUsageLogProps {
  constructor(
    public id: string,
    public companyId: string,
    public userId: string,
    public providerType: string,
    public model: string,
    public messageCount: number,
    public promptTokens?: number,
    public completionTokens?: number,
    public totalTokens?: number,
    public status: AiUsageStatus = 'success',
    public errorCode?: string,
    public latencyMs?: number,
    public createdAt: Date = new Date()
  ) {}

  static create(input: {
    companyId: string;
    userId: string;
    providerType: string;
    model: string;
    messageCount: number;
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    status: AiUsageStatus;
    errorCode?: string;
    latencyMs?: number;
  }): AiUsageLog {
    const id = `aiul_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    return new AiUsageLog(
      id,
      input.companyId,
      input.userId,
      input.providerType,
      input.model,
      input.messageCount,
      input.promptTokens,
      input.completionTokens,
      input.totalTokens,
      input.status,
      input.errorCode,
      input.latencyMs,
      new Date()
    );
  }

  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      companyId: this.companyId,
      userId: this.userId,
      providerType: this.providerType,
      model: this.model,
      messageCount: this.messageCount,
      promptTokens: this.promptTokens ?? null,
      completionTokens: this.completionTokens ?? null,
      totalTokens: this.totalTokens ?? null,
      status: this.status,
      errorCode: this.errorCode ?? null,
      latencyMs: this.latencyMs ?? null,
      createdAt: this.createdAt.toISOString(),
    };
  }

  static fromJSON(data: Record<string, any>): AiUsageLog {
    return new AiUsageLog(
      data.id,
      data.companyId,
      data.userId,
      data.providerType,
      data.model,
      data.messageCount ?? 0,
      data.promptTokens ?? undefined,
      data.completionTokens ?? undefined,
      data.totalTokens ?? undefined,
      data.status || 'success',
      data.errorCode ?? undefined,
      data.latencyMs ?? undefined,
      data.createdAt?.toDate?.() || new Date(data.createdAt)
    );
  }
}