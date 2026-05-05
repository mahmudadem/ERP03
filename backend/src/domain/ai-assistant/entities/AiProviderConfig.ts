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

export type AiProviderType = 'mock' | 'openai_compatible' | 'ollama';

export interface AiProviderConfigProps {
  companyId: string;
  provider: AiProviderType;
  model?: string;              // Provider-specific model (e.g., 'gpt-4o', 'llama3')
  apiKey?: string;             // Encrypted at rest (AES-256-GCM via AesEncryptionService)
  apiEndpoint?: string;        // Custom endpoint URL for BYOK or local providers
  maxTokensPerRequest?: number; // Limit tokens per request
  maxRequestsPerDay?: number;  // Rate limiting per company per day
  dailyRequestCount?: number;  // Number of requests made today (UTC)
  dailyRequestDate?: string;   // UTC date string for the current count (e.g., '2026-05-05')
  isEnabled: boolean;           // Company admin can disable AI without removing config
  updatedAt: Date;
}

export class AiProviderConfig implements AiProviderConfigProps {
  constructor(
    public companyId: string,
    public provider: AiProviderType,
    public model?: string,
    public apiKey?: string,
    public apiEndpoint?: string,
    public maxTokensPerRequest?: number,
    public maxRequestsPerDay?: number,
    public dailyRequestCount?: number,
    public dailyRequestDate?: string,
    public isEnabled: boolean = true,
    public updatedAt: Date = new Date()
  ) {}

  static create(input: {
    companyId: string;
    provider?: AiProviderType;
    model?: string;
    apiKey?: string;
    apiEndpoint?: string;
  }): AiProviderConfig {
    return new AiProviderConfig(
      input.companyId,
      input.provider || 'mock',
      input.model,
      input.apiKey,
      input.apiEndpoint,
      4096,                // Default max tokens
      100,                  // Default max requests per day
      0,                    // dailyRequestCount starts at 0
      undefined,            // dailyRequestDate — set on first request
      true,
      new Date()
    );
  }

  /** Get the default config for a company — uses mock provider for local dev */
  static defaultForCompany(companyId: string): AiProviderConfig {
    return new AiProviderConfig(
      companyId,
      'mock',
      'mock-assistant',
      undefined,
      undefined,
      4096,
      100,
      0,            // dailyRequestCount starts at 0
      undefined,    // dailyRequestDate not yet set
      true,
      new Date()
    );
  }

  updateConfig(updates: Partial<Omit<AiProviderConfigProps, 'companyId' | 'updatedAt'>>): void {
    if (updates.provider !== undefined) this.provider = updates.provider;
    if (updates.model !== undefined) this.model = updates.model;
    if (updates.apiKey !== undefined) this.apiKey = updates.apiKey;
    if (updates.apiEndpoint !== undefined) this.apiEndpoint = updates.apiEndpoint;
    if (updates.maxTokensPerRequest !== undefined) this.maxTokensPerRequest = updates.maxTokensPerRequest;
    if (updates.maxRequestsPerDay !== undefined) this.maxRequestsPerDay = updates.maxRequestsPerDay;
    if (updates.isEnabled !== undefined) this.isEnabled = updates.isEnabled;
    // Note: dailyRequestCount and dailyRequestDate are NOT updated via updateConfig
    // They are managed exclusively by AiRateLimiterService
    this.updatedAt = new Date();
  }

  /**
   * Get today's UTC date string for rate limit tracking.
   * Format: 'YYYY-MM-DD'
   */
  static getTodayDateString(): string {
    const now = new Date();
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
  }

  /**
   * Check if the daily count is for today (UTC) and return the count.
   * If the date has changed, returns 0 (indicating the count should reset).
   */
  getTodaysRequestCount(): number {
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
  incrementDailyRequestCount(): void {
    const today = AiProviderConfig.getTodayDateString();
    if (this.dailyRequestDate === today) {
      this.dailyRequestCount = (this.dailyRequestCount || 0) + 1;
    } else {
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
  toJSON(): Record<string, unknown> {
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
  toPersistenceJSON(): Record<string, unknown> {
    return {
      companyId: this.companyId,
      provider: this.provider,
      model: this.model || null,
      apiKey: this.apiKey || null, // Encrypted by AiSettingsUseCase before storage
      apiEndpoint: this.apiEndpoint || null,
      maxTokensPerRequest: this.maxTokensPerRequest || null,
      maxRequestsPerDay: this.maxRequestsPerDay || null,
      dailyRequestCount: this.dailyRequestCount || 0,
      dailyRequestDate: this.dailyRequestDate || null,
      isEnabled: this.isEnabled,
      updatedAt: this.updatedAt.toISOString(),
    };
  }

  static fromJSON(data: Record<string, any>): AiProviderConfig {
    return new AiProviderConfig(
      data.companyId,
      data.provider || 'mock',
      data.model || undefined,
      data.apiKey || undefined,
      data.apiEndpoint || undefined,
      data.maxTokensPerRequest || undefined,
      data.maxRequestsPerDay || undefined,
      data.dailyRequestCount ?? 0,
      data.dailyRequestDate || undefined,
      data.isEnabled !== undefined ? data.isEnabled : true,
      data.updatedAt?.toDate?.() || new Date(data.updatedAt)
    );
  }
}