export type AiPlatformRuntimeProfileStatus = 'active' | 'paused' | 'disabled';
export type AiPlatformRuntimeInterval = 'minute' | 'hour' | 'day' | 'month';

export interface AiPlatformRuntimeProfileProps {
  id: string;
  providerId: string;
  providerType: string;
  providerName: string;
  modelProfileId: string;
  modelId: string;
  modelDisplayName: string;
  encryptedCredential?: string;
  credentialHint?: string;
  status: AiPlatformRuntimeProfileStatus;
  maxRequestsPerInterval?: number;
  requestInterval: AiPlatformRuntimeInterval;
  currentWindowRequestCount: number;
  currentWindowStartedAt?: Date;
  totalSuccessfulRequests: number;
  lastUsedAt?: Date;
  lastFailureAt?: Date;
  lastFailureReason?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class AiPlatformRuntimeProfile implements AiPlatformRuntimeProfileProps {
  constructor(
    public readonly id: string,
    public readonly providerId: string,
    public readonly providerType: string,
    public readonly providerName: string,
    public readonly modelProfileId: string,
    public readonly modelId: string,
    public readonly modelDisplayName: string,
    public readonly encryptedCredential: string | undefined = undefined,
    public readonly credentialHint: string | undefined = undefined,
    public readonly status: AiPlatformRuntimeProfileStatus = 'paused',
    public readonly maxRequestsPerInterval: number | undefined = undefined,
    public readonly requestInterval: AiPlatformRuntimeInterval = 'day',
    public readonly currentWindowRequestCount: number = 0,
    public readonly currentWindowStartedAt: Date | undefined = undefined,
    public readonly totalSuccessfulRequests: number = 0,
    public readonly lastUsedAt: Date | undefined = undefined,
    public readonly lastFailureAt: Date | undefined = undefined,
    public readonly lastFailureReason: string | undefined = undefined,
    public readonly notes: string | undefined = undefined,
    public readonly createdAt: Date = new Date(),
    public readonly updatedAt: Date = new Date(),
  ) {
    if (!id.trim()) throw new Error('AI runtime profile id is required');
    if (!providerId.trim()) throw new Error('AI runtime profile providerId is required');
    if (!modelProfileId.trim()) throw new Error('AI runtime profile modelProfileId is required');
  }

  static makeId(providerId: string, modelProfileId: string): string {
    return [
      encodeURIComponent(providerId.trim().toLowerCase()),
      encodeURIComponent(modelProfileId.trim().toLowerCase()),
    ].join(':');
  }

  static buildCredentialHint(apiKey: string | undefined): string | undefined {
    if (!apiKey) return undefined;
    const trimmed = apiKey.trim();
    if (!trimmed) return undefined;
    const suffix = trimmed.slice(-4);
    return suffix ? `****${suffix}` : 'configured';
  }

  private getWindowStart(now: Date): Date {
    switch (this.requestInterval) {
      case 'minute':
        return new Date(Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate(),
          now.getUTCHours(),
          now.getUTCMinutes(),
          0,
          0,
        ));
      case 'hour':
        return new Date(Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate(),
          now.getUTCHours(),
          0,
          0,
          0,
        ));
      case 'month':
        return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
      case 'day':
      default:
        return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
    }
  }

  getCurrentWindowCount(now: Date = new Date()): number {
    const windowStart = this.getWindowStart(now);
    if (!this.currentWindowStartedAt || this.currentWindowStartedAt.getTime() < windowStart.getTime()) {
      return 0;
    }
    return this.currentWindowRequestCount || 0;
  }

  canConsume(now: Date = new Date()): { allowed: boolean; reason?: string } {
    if (this.status !== 'active') {
      return {
        allowed: false,
        reason: this.status === 'paused'
          ? 'Platform AI runtime is paused by Super Admin.'
          : 'Platform AI runtime is disabled by Super Admin.',
      };
    }

    if (!this.encryptedCredential) {
      return { allowed: false, reason: 'No platform credential is configured for this runtime profile.' };
    }

    if (!this.maxRequestsPerInterval || this.maxRequestsPerInterval <= 0) {
      return { allowed: true };
    }

    const currentCount = this.getCurrentWindowCount(now);
    if (currentCount >= this.maxRequestsPerInterval) {
      return {
        allowed: false,
        reason: `Platform AI runtime request cap reached (${this.maxRequestsPerInterval}/${this.requestInterval}).`,
      };
    }

    return { allowed: true };
  }

  recordSuccessfulRequest(now: Date = new Date()): AiPlatformRuntimeProfile {
    const windowStart = this.getWindowStart(now);
    const currentCount = this.getCurrentWindowCount(now);
    return new AiPlatformRuntimeProfile(
      this.id,
      this.providerId,
      this.providerType,
      this.providerName,
      this.modelProfileId,
      this.modelId,
      this.modelDisplayName,
      this.encryptedCredential,
      this.credentialHint,
      this.status,
      this.maxRequestsPerInterval,
      this.requestInterval,
      currentCount + 1,
      windowStart,
      this.totalSuccessfulRequests + 1,
      now,
      this.lastFailureAt,
      this.lastFailureReason,
      this.notes,
      this.createdAt,
      now,
    );
  }

  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      providerId: this.providerId,
      providerType: this.providerType,
      providerName: this.providerName,
      modelProfileId: this.modelProfileId,
      modelId: this.modelId,
      modelDisplayName: this.modelDisplayName,
      hasCredential: !!this.encryptedCredential,
      credentialHint: this.credentialHint || null,
      status: this.status,
      maxRequestsPerInterval: this.maxRequestsPerInterval ?? null,
      requestInterval: this.requestInterval,
      currentWindowRequestCount: this.currentWindowRequestCount,
      currentWindowStartedAt: this.currentWindowStartedAt?.toISOString() || null,
      totalSuccessfulRequests: this.totalSuccessfulRequests,
      lastUsedAt: this.lastUsedAt?.toISOString() || null,
      lastFailureAt: this.lastFailureAt?.toISOString() || null,
      lastFailureReason: this.lastFailureReason || null,
      notes: this.notes || null,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }

  toPersistenceJSON(): Record<string, unknown> {
    return {
      id: this.id,
      providerId: this.providerId,
      providerType: this.providerType,
      providerName: this.providerName,
      modelProfileId: this.modelProfileId,
      modelId: this.modelId,
      modelDisplayName: this.modelDisplayName,
      encryptedCredential: this.encryptedCredential || null,
      credentialHint: this.credentialHint || null,
      status: this.status,
      maxRequestsPerInterval: this.maxRequestsPerInterval ?? null,
      requestInterval: this.requestInterval,
      currentWindowRequestCount: this.currentWindowRequestCount,
      currentWindowStartedAt: this.currentWindowStartedAt?.toISOString() || null,
      totalSuccessfulRequests: this.totalSuccessfulRequests,
      lastUsedAt: this.lastUsedAt?.toISOString() || null,
      lastFailureAt: this.lastFailureAt?.toISOString() || null,
      lastFailureReason: this.lastFailureReason || null,
      notes: this.notes || null,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }

  static fromJSON(data: Record<string, any>): AiPlatformRuntimeProfile {
    return new AiPlatformRuntimeProfile(
      data.id || AiPlatformRuntimeProfile.makeId(data.providerId || '', data.modelProfileId || ''),
      data.providerId || '',
      data.providerType || '',
      data.providerName || '',
      data.modelProfileId || '',
      data.modelId || '',
      data.modelDisplayName || data.modelId || '',
      data.encryptedCredential || undefined,
      data.credentialHint || undefined,
      data.status || 'paused',
      typeof data.maxRequestsPerInterval === 'number'
        ? data.maxRequestsPerInterval
        : (data.maxRequestsPerInterval ? Number(data.maxRequestsPerInterval) : undefined),
      data.requestInterval || 'day',
      Number(data.currentWindowRequestCount || 0),
      data.currentWindowStartedAt?.toDate?.() || (data.currentWindowStartedAt ? new Date(data.currentWindowStartedAt) : undefined),
      Number(data.totalSuccessfulRequests || 0),
      data.lastUsedAt?.toDate?.() || (data.lastUsedAt ? new Date(data.lastUsedAt) : undefined),
      data.lastFailureAt?.toDate?.() || (data.lastFailureAt ? new Date(data.lastFailureAt) : undefined),
      data.lastFailureReason || undefined,
      data.notes || undefined,
      data.createdAt?.toDate?.() || (data.createdAt ? new Date(data.createdAt) : new Date()),
      data.updatedAt?.toDate?.() || (data.updatedAt ? new Date(data.updatedAt) : new Date()),
    );
  }
}
