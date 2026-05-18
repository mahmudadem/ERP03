/**
 * AiPlatformApiKey — Super Admin's personal API key vault.
 *
 * This is a NEW first-class entity (separate from AiPlatformRuntimeProfile)
 * that lets the super admin save multiple API keys per provider, label them,
 * validate them, and reuse them when wiring up runtime profiles.
 *
 * Key separation of concerns:
 *   - AiPlatformApiKey         : "I have this OpenRouter key, here it is, it's valid"
 *   - AiPlatformRuntimeProfile : "Use that OpenRouter key for model X, with budget Y"
 *
 * In a follow-up commit, runtime profiles will reference vault keys by id
 * (`apiKeyId`) instead of embedding their own encryptedCredential. For now,
 * the vault is additive — runtime profiles keep their inline keys, and
 * superadmins can use the vault as a reference book.
 */

export type AiPlatformApiKeyValidationStatus = 'unknown' | 'valid' | 'invalid';

export interface AiPlatformApiKeyProps {
  id: string;
  label: string;
  providerId: string;
  providerName: string;
  encryptedKey: string;
  credentialHint: string;
  lastValidatedAt?: Date;
  lastValidationStatus: AiPlatformApiKeyValidationStatus;
  lastValidationDetail?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class AiPlatformApiKey implements AiPlatformApiKeyProps {
  constructor(
    public readonly id: string,
    public readonly label: string,
    public readonly providerId: string,
    public readonly providerName: string,
    public readonly encryptedKey: string,
    public readonly credentialHint: string,
    public readonly lastValidatedAt: Date | undefined = undefined,
    public readonly lastValidationStatus: AiPlatformApiKeyValidationStatus = 'unknown',
    public readonly lastValidationDetail: string | undefined = undefined,
    public readonly notes: string | undefined = undefined,
    public readonly createdAt: Date = new Date(),
    public readonly updatedAt: Date = new Date(),
  ) {
    if (!id.trim()) throw new Error('AiPlatformApiKey.id is required');
    if (!label.trim()) throw new Error('AiPlatformApiKey.label is required');
    if (!providerId.trim()) throw new Error('AiPlatformApiKey.providerId is required');
    if (!encryptedKey.trim()) throw new Error('AiPlatformApiKey.encryptedKey is required');
  }

  static buildCredentialHint(apiKey: string): string {
    const trimmed = apiKey.trim();
    if (!trimmed) return 'configured';
    const suffix = trimmed.slice(-4);
    return suffix ? `****${suffix}` : 'configured';
  }

  withValidation(
    status: AiPlatformApiKeyValidationStatus,
    detail?: string,
    now: Date = new Date(),
  ): AiPlatformApiKey {
    return new AiPlatformApiKey(
      this.id,
      this.label,
      this.providerId,
      this.providerName,
      this.encryptedKey,
      this.credentialHint,
      now,
      status,
      detail,
      this.notes,
      this.createdAt,
      now,
    );
  }

  /** Safe for API responses — never includes the encrypted key. */
  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      label: this.label,
      providerId: this.providerId,
      providerName: this.providerName,
      credentialHint: this.credentialHint,
      lastValidatedAt: this.lastValidatedAt?.toISOString() || null,
      lastValidationStatus: this.lastValidationStatus,
      lastValidationDetail: this.lastValidationDetail || null,
      notes: this.notes || null,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }

  toPersistenceJSON(): Record<string, unknown> {
    return {
      id: this.id,
      label: this.label,
      providerId: this.providerId,
      providerName: this.providerName,
      encryptedKey: this.encryptedKey,
      credentialHint: this.credentialHint,
      lastValidatedAt: this.lastValidatedAt?.toISOString() || null,
      lastValidationStatus: this.lastValidationStatus,
      lastValidationDetail: this.lastValidationDetail || null,
      notes: this.notes || null,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }

  static fromJSON(data: Record<string, any>): AiPlatformApiKey {
    return new AiPlatformApiKey(
      data.id,
      data.label || '',
      data.providerId || '',
      data.providerName || '',
      data.encryptedKey || '',
      data.credentialHint || 'configured',
      data.lastValidatedAt?.toDate?.() || (data.lastValidatedAt ? new Date(data.lastValidatedAt) : undefined),
      data.lastValidationStatus || 'unknown',
      data.lastValidationDetail || undefined,
      data.notes || undefined,
      data.createdAt?.toDate?.() || (data.createdAt ? new Date(data.createdAt) : new Date()),
      data.updatedAt?.toDate?.() || (data.updatedAt ? new Date(data.updatedAt) : new Date()),
    );
  }
}
