/**
 * AiAssistantDTOs - Request/Response types for AI Assistant endpoints
 */

export interface SendChatMessageRequest {
  message: string;
  conversationId?: string;
}

export interface RuntimeMetadata {
  aiRunId: string;
  conversationId: string;
  runtimeStatus: string;
  selectedSkills: string[];
  allowedToolIds: string[];
  modelProfile: {
    provider: string;
    modelName: string;
    status: string;
    supportsToolCalling: boolean;
    textOnlyMode: boolean;
    warningLevel: string;
    warningMessage: string;
  };
  runtimeWarnings: string[];
  toolCallsRequested: string[];
  toolResults: Array<{
    toolName: string;
    approved: boolean;
    rejectionReason?: string;
  }>;
  proposal?: Record<string, unknown>;
}

export interface SendChatMessageResponse {
  userMessage: {
    id: string;
    conversationId: string;
    role: string;
    content: string;
    createdAt: string;
  };
  assistantMessage: {
    id: string;
    conversationId: string;
    role: string;
    content: string;
    provider: string;
    model: string;
    tokenCount?: number;
    metadata?: Record<string, unknown>;
    createdAt: string;
  };
  provider: string;
  model: string;
  /** Stage 2: Runtime metadata (optional, backward compatible) */
  runtimeMeta?: RuntimeMetadata;
}

export interface GetConversationMessagesResponse {
  messages: Array<{
    id: string;
    conversationId: string;
    role: string;
    content: string;
    provider: string;
    model?: string;
    tokenCount?: number;
    metadata?: Record<string, unknown>;
    createdAt: string;
  }>;
}

export interface GetRecentConversationsResponse {
  conversations: Array<{
    conversationId: string;
    lastMessage: {
      id: string;
      role: string;
      content: string;
      createdAt: string;
    };
  }>;
}

export interface AiSettingsResponse {
  config: {
    companyId: string;
    provider: string;
    model: string | null;
    apiEndpoint: string | null;
    maxTokensPerRequest: number | null;
    maxRequestsPerDay: number | null;
    isEnabled: boolean;
    hasApiKey: boolean;
    mode: string | null;
    providerId: string | null;
    selectedModelProfileId: string | null;
    selectedProfileHash: string | null;
    runtimeMode: string;
    allowedRuntimeModes: string[];
    allowUnverifiedModels: boolean;
    showFloatingAssistant: boolean;
    updatedAt: string;
  };
}

export interface AiWidgetPreferencesResponse {
  preferences: {
    isEnabled: boolean;
    showFloatingAssistant: boolean;
  };
}

export interface UpdateAiSettingsRequest {
  provider?: 'mock' | 'openai_compatible' | 'ollama';
  model?: string;
  apiKey?: string;
  apiEndpoint?: string;
  maxTokensPerRequest?: number;
  maxRequestsPerDay?: number;
  isEnabled?: boolean;
  mode?: 'certified_profile' | 'custom_uncertified' | 'legacy_unverified';
  providerId?: string;
  selectedModelProfileId?: string;
  selectedProfileHash?: string;
  runtimeMode?: 'BYOK' | 'CREDITS' | 'DISABLED';
  allowedRuntimeModes?: Array<'BYOK' | 'CREDITS' | 'DISABLED'>;
  allowUnverifiedModels?: boolean;
  showFloatingAssistant?: boolean;
}

// ─── Provider & Model Catalog DTOs ────────────────────────────────────

/**
 * Safe provider metadata response shape.
 * Provider-level runtime credentials are NEVER included.
 */
export interface AiProviderSafeResponse {
  id: string;
  name: string;
  type: string;
  defaultBaseUrl: string | null;
  authType: string;
  byok: boolean;
  enabled: boolean;
  supportsTools: boolean;
  supportsJsonMode: boolean;
  supportsModelSync: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Model profile + certifications returned by the provider models endpoint.
 */
export interface AiProviderModelResponse {
  profile: Record<string, unknown>;
  certifications: Record<string, unknown>[];
}

// ─── AI Credit DTOs ──────────────────────────────────────────────────

export interface AiCreditBalanceResponse {
  companyId: string;
  balance: number;
  totalPurchased: number;
  totalConsumed: number;
  lastDebitAt: string | null;
  lastCreditAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface GrantAiCreditsRequest {
  companyId: string;
  amount: number;
  reason?: string;
}

export interface GrantAiCreditsResponse {
  companyId: string;
  newBalance: number;
  grantedAmount: number;
  grantedAt: string;
}

export class AiAssistantDTOMapper {
  static toChatMessageResponse(message: any): any {
    return {
      id: message.id,
      conversationId: message.conversationId,
      role: message.role,
      content: message.content,
      provider: message.provider,
      model: message.model || null,
      tokenCount: message.tokenCount || null,
      metadata: message.metadata || null,
      feedback: message.feedback || null,
      createdAt: message.createdAt?.toISOString?.() || message.createdAt,
    };
  }
}
