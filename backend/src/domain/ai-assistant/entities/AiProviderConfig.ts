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
export type AiConversationContextMode = 'minimal' | 'balanced' | 'deep';
export type AiTenantModelMode = 'certified_profile' | 'custom_uncertified' | 'legacy_unverified';

/**
 * RuntimeMode determines HOW tenant chat resolves credentials.
 * - BYOK: Tenant must provide their own API key. No platform fallback.
 * - CREDITS: Platform uses its runtime credential. Tenant pays via credit balance.
 * - DISABLED: AI is turned off for this tenant.
 *
 * allowedRuntimeModes is set by Super Admin to restrict which modes a tenant may select.
 * Defaults to BYOK + CREDITS. Tenant picks one from the allowed list.
 *
 * Legacy note: 'PLATFORM_MANAGED' is mapped to 'CREDITS' in fromJSON() for backward compat.
 */
export type AiTenantRuntimeMode = 'BYOK' | 'CREDITS' | 'DISABLED';
export type AiReportMode = 'standard' | 'authoritative';

export interface AiProviderConfigProps {
  companyId: string;
  provider: AiProviderType;
  mode?: AiTenantModelMode;
  providerId?: string;
  selectedModelProfileId?: string;
  selectedProfileHash?: string;
  model?: string;              // Provider-specific model (e.g., 'gpt-4o', 'llama3')
  apiKey?: string;             // Encrypted at rest (AES-256-GCM via AesEncryptionService)
  apiEndpoint?: string;        // Custom endpoint URL for BYOK or local providers
  maxTokensPerRequest?: number; // Limit tokens per request
  maxRequestsPerDay?: number;  // Rate limiting per company per day
  conversationContextMode?: AiConversationContextMode; // Controls how much prior chat context is sent to the model
  includePreviousToolResults?: boolean; // Whether prior read-only tool results are included in follow-up context
  dailyRequestCount?: number;  // Number of requests made today (UTC)
  dailyRequestDate?: string;   // UTC date string for the current count (e.g., '2026-05-05')
  isEnabled: boolean;           // Company admin can disable AI without removing config
  runtimeMode?: AiTenantRuntimeMode; // How credentials are resolved for tenant chat
  allowedRuntimeModes?: AiTenantRuntimeMode[]; // Super Admin restriction: which modes tenant may select
  allowUnverifiedModels?: boolean; // HYBRID LOGIC: Allow models without full certification (Warn but Allow)
  aiReportMode?: AiReportMode; // 'standard' = old summary tools, 'authoritative' = registry-based full-context tools
  showFloatingAssistant?: boolean; // Whether the global floating AI launcher is shown in the ERP shell
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
    public updatedAt: Date = new Date(),
    public conversationContextMode: AiConversationContextMode = 'balanced',
    public includePreviousToolResults: boolean = true,
    public mode: AiTenantModelMode = 'legacy_unverified',
    public providerId?: string,
    public selectedModelProfileId?: string,
    public selectedProfileHash?: string,
    /** How credentials are resolved for tenant chat */
    public runtimeMode: AiTenantRuntimeMode = 'BYOK',
    /** Super Admin restriction: which modes tenant may select */
    public allowedRuntimeModes: AiTenantRuntimeMode[] = ['BYOK', 'CREDITS'],
    /** HYBRID LOGIC: Allow models without full certification (Warn but Allow) */
    public allowUnverifiedModels: boolean = false,
    public aiReportMode: AiReportMode = 'standard',
    /** Whether the global floating AI launcher is shown in the ERP shell */
    public showFloatingAssistant: boolean = true,
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
      new Date(),
      'balanced',           // Default conversation context mode
      true,                 // Include prior read-only tool results by default
      'legacy_unverified',
      input.provider || 'mock',
      undefined,
      undefined,
      'BYOK',
      ['BYOK', 'CREDITS'],
      false,                // allowUnverifiedModels
      'standard',
      true                  // showFloatingAssistant
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
      new Date(),
      'balanced',
      true,
      'legacy_unverified',
      'mock',
      undefined,
      undefined,
      'BYOK',
      ['BYOK', 'CREDITS'],
      false,        // allowUnverifiedModels
      'standard',
      true          // showFloatingAssistant
    );
  }

  updateConfig(updates: Partial<Omit<AiProviderConfigProps, 'companyId' | 'updatedAt'>>): void {
    if (updates.provider !== undefined) this.provider = updates.provider;
    if (updates.mode !== undefined) this.mode = updates.mode;
    if (updates.providerId !== undefined) this.providerId = updates.providerId;
    if (updates.selectedModelProfileId !== undefined) this.selectedModelProfileId = updates.selectedModelProfileId;
    if (updates.selectedProfileHash !== undefined) this.selectedProfileHash = updates.selectedProfileHash;
    if (updates.model !== undefined) this.model = updates.model;
    if (updates.apiKey !== undefined) this.apiKey = updates.apiKey;
    if (updates.apiEndpoint !== undefined) this.apiEndpoint = updates.apiEndpoint;
    if (updates.maxTokensPerRequest !== undefined) this.maxTokensPerRequest = updates.maxTokensPerRequest;
    if (updates.maxRequestsPerDay !== undefined) this.maxRequestsPerDay = updates.maxRequestsPerDay;
    if (updates.conversationContextMode !== undefined) this.conversationContextMode = updates.conversationContextMode;
    if (updates.includePreviousToolResults !== undefined) this.includePreviousToolResults = updates.includePreviousToolResults;
    if (updates.isEnabled !== undefined) this.isEnabled = updates.isEnabled;
    if (updates.runtimeMode !== undefined) this.runtimeMode = updates.runtimeMode;
    if (updates.allowedRuntimeModes !== undefined) this.allowedRuntimeModes = updates.allowedRuntimeModes;
    if (updates.allowUnverifiedModels !== undefined) this.allowUnverifiedModels = updates.allowUnverifiedModels;
    if (updates.showFloatingAssistant !== undefined) this.showFloatingAssistant = updates.showFloatingAssistant;
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
      mode: this.mode,
      providerId: this.providerId || null,
      selectedModelProfileId: this.selectedModelProfileId || null,
      selectedProfileHash: this.selectedProfileHash || null,
      model: this.model || null,
      apiEndpoint: this.apiEndpoint || null,
      maxTokensPerRequest: this.maxTokensPerRequest || null,
      maxRequestsPerDay: this.maxRequestsPerDay || null,
      conversationContextMode: this.conversationContextMode,
      includePreviousToolResults: this.includePreviousToolResults,
      isEnabled: this.isEnabled,
      runtimeMode: this.runtimeMode,
      allowedRuntimeModes: this.allowedRuntimeModes,
      allowUnverifiedModels: this.allowUnverifiedModels, // HYBRID logic
      aiReportMode: this.aiReportMode,
      showFloatingAssistant: this.showFloatingAssistant,
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
      mode: this.mode,
      providerId: this.providerId || null,
      selectedModelProfileId: this.selectedModelProfileId || null,
      selectedProfileHash: this.selectedProfileHash || null,
      model: this.model || null,
      apiKey: this.apiKey || null, // Encrypted by AiSettingsUseCase before storage
      apiEndpoint: this.apiEndpoint || null,
      maxTokensPerRequest: this.maxTokensPerRequest || null,
      maxRequestsPerDay: this.maxRequestsPerDay || null,
      conversationContextMode: this.conversationContextMode,
      includePreviousToolResults: this.includePreviousToolResults,
      dailyRequestCount: this.dailyRequestCount || 0,
      dailyRequestDate: this.dailyRequestDate || null,
      isEnabled: this.isEnabled,
      runtimeMode: this.runtimeMode,
      allowedRuntimeModes: this.allowedRuntimeModes,
      allowUnverifiedModels: this.allowUnverifiedModels, // HYBRID logic
      aiReportMode: this.aiReportMode,
      showFloatingAssistant: this.showFloatingAssistant,
      updatedAt: this.updatedAt.toISOString(),
    };
  }

  static fromJSON(data: Record<string, any>): AiProviderConfig {
    const provider = data.provider || 'mock';
    const mode: AiTenantModelMode = ['certified_profile', 'custom_uncertified', 'legacy_unverified'].includes(data.mode)
      ? data.mode
      : 'legacy_unverified';

    // Map legacy 'PLATFORM_MANAGED' → 'CREDITS' for backward compatibility
    const validRuntimeModes: AiTenantRuntimeMode[] = ['BYOK', 'CREDITS', 'DISABLED'];
    const legacyRuntimeModeMap: Record<string, AiTenantRuntimeMode> = {
      'BYOK': 'BYOK',
      'CREDITS': 'CREDITS',
      'DISABLED': 'DISABLED',
      'PLATFORM_MANAGED': 'CREDITS', // legacy → new
    };
    const rawRuntimeMode = data.runtimeMode;
    const runtimeMode: AiTenantRuntimeMode = legacyRuntimeModeMap[rawRuntimeMode] || 'BYOK';

    const allowedRuntimeModes: AiTenantRuntimeMode[] = Array.isArray(data.allowedRuntimeModes)
      ? data.allowedRuntimeModes
          .map((m: string): AiTenantRuntimeMode | null => {
            if (validRuntimeModes.includes(m as AiTenantRuntimeMode)) return m as AiTenantRuntimeMode;
            if (m === 'PLATFORM_MANAGED') return 'CREDITS'; // legacy → new
            return null;
          })
          .filter((m): m is AiTenantRuntimeMode => m !== null)
      : ['BYOK', 'CREDITS'];

    return new AiProviderConfig(
      data.companyId,
      provider,
      data.model || undefined,
      data.apiKey || undefined,
      data.apiEndpoint || undefined,
      data.maxTokensPerRequest || undefined,
      data.maxRequestsPerDay || undefined,
      data.dailyRequestCount ?? 0,
      data.dailyRequestDate || undefined,
      data.isEnabled !== undefined ? data.isEnabled : true,
      data.updatedAt?.toDate?.() || new Date(data.updatedAt),
      ['minimal', 'balanced', 'deep'].includes(data.conversationContextMode)
        ? data.conversationContextMode
        : 'balanced',
      data.includePreviousToolResults !== undefined ? Boolean(data.includePreviousToolResults) : true,
      mode,
      data.providerId || provider,
      data.selectedModelProfileId || undefined,
      data.selectedProfileHash || undefined,
      runtimeMode,
      allowedRuntimeModes,
      data.allowUnverifiedModels !== undefined ? Boolean(data.allowUnverifiedModels) : false,
      ['standard', 'authoritative'].includes(data.aiReportMode) ? data.aiReportMode : 'standard',
      data.showFloatingAssistant !== undefined ? Boolean(data.showFloatingAssistant) : true,
    );
  }
}
