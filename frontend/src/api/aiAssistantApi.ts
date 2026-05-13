/**
 * aiAssistantApi.ts
 *
 * API client for the AI Assistant module.
 * All requests go through the backend — frontend never calls AI providers directly.
 */

import client from './client';

const AI_CHAT_TIMEOUT_MS = 120_000;
const AI_DIAGNOSTICS_TIMEOUT_MS = 180_000;

// Types
export interface ChatRuntimeModelProfileDTO {
  provider: string;
  modelName: string;
  status: 'recommended' | 'tested' | 'experimental' | 'custom' | string;
  supportsToolCalling: boolean;
  textOnlyMode: boolean;
  warningLevel: 'none' | 'info' | 'warning' | 'danger' | string;
  warningMessage: string;
}

export interface ChatRuntimeMetadataDTO {
  aiRunId: string;
  conversationId: string;
  runtimeStatus: string;
  selectedSkills: string[];
  allowedToolIds: string[];
  modelProfile: ChatRuntimeModelProfileDTO;
  runtimeWarnings: string[];
  toolCallsRequested: string[];
  toolResults?: Array<{
    toolName: string;
    approved: boolean;
    rejectionReason?: string;
  }>;
  proposal?: Record<string, unknown>;
}

export interface ChatMessageMetadata {
  aiRunId?: string;
  conversationId?: string;
  runtimeStatus?: string;
  selectedSkills?: string[];
  allowedToolIds?: string[];
  modelProfile?: ChatRuntimeModelProfileDTO;
  runtimeWarnings?: string[];
  toolCallsRequested?: string[];
  toolCallResults?: Array<{
    toolName: string;
    approved: boolean;
    rejectionReason?: string;
  }>;
  toolResults?: AiToolCallResultDTO[];
  proposal?: AiProposalDTO | null;
  [key: string]: unknown;
}

export interface ChatMessageDTO {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  provider: string;
  model?: string | null;
  tokenCount?: number | null;
  metadata?: ChatMessageMetadata | null;
  feedback?: 'positive' | 'negative' | null;
  createdAt: string;
}

export interface AiToolCallResultDTO {
  toolName: string;
  result: {
    success: boolean;
    data: Record<string, unknown> | null;
    error?: string;
    errorCode?: string;
  };
}

export interface SendChatMessagePayload {
  message: string;
  conversationId?: string;
}

export interface SendChatMessageResponse {
  userMessage: ChatMessageDTO;
  assistantMessage: ChatMessageDTO;
  provider: string;
  model: string;
  runtimeMeta?: ChatRuntimeMetadataDTO;
}

export interface AiSettingsDTO {
  companyId: string;
  provider: string;
  model: string | null;
  apiEndpoint: string | null;
  maxTokensPerRequest: number | null;
  maxRequestsPerDay: number | null;
  conversationContextMode?: 'minimal' | 'balanced' | 'deep';
  includePreviousToolResults?: boolean;
  isEnabled: boolean;
  hasApiKey: boolean;
  mode: string | null;
  providerId: string | null;
  selectedModelProfileId: string | null;
  selectedProfileHash: string | null;
  runtimeMode: string;
  allowedRuntimeModes: string[];
  updatedAt: string;
}

export type TenantAiProviderType = 'openai' | 'openai_compatible' | 'google_gemini' | 'anthropic' | 'ollama' | 'custom';
export type TenantAiProviderAuthType = 'api_key' | 'bearer' | 'none' | 'custom';

export interface TenantAiProviderOption {
  id: string;
  name: string;
  type: TenantAiProviderType;
  defaultBaseUrl: string | null;
  authType: TenantAiProviderAuthType;
  byok: boolean;
  enabled: boolean;
  supportsTools: boolean;
  supportsJsonMode: boolean;
  supportsModelSync: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TenantAiProviderModelOption {
  profile: Record<string, unknown>;
  certifications: AiCertificationResult[];
}

export interface AiUsageAnalyticsResponse {
  summary: {
    todayRequests: number;
    successCount: number;
    failureCount: number;
    avgLatencyMs: number;
    totalTokens: number;
    providerBreakdown: Array<{ providerType: string; count: number }>;
  };
  recentLogs: Array<{
    id: string;
    userId: string;
    providerType: string;
    model: string;
    status: 'success' | 'failure';
    totalTokens: number;
    latencyMs: number;
    errorCode?: string;
    createdAt: string;
  }>;
}

export interface ProviderHealthResponse {
  provider: string;
  model: string;
  ready?: boolean;
  networkOk?: boolean;
  inferenceOk?: boolean;
  latencyMs?: number;
  success?: boolean;
  error?: string;
  reason?: string;
  modelProfile?: {
    provider: string;
    modelName: string;
    status: string;
    supportsToolCalling: boolean;
    supportsStructuredJson: boolean;
    textOnlyMode: boolean;
    warningLevel: string;
    warningMessage: string;
    recommendedUseCases: string[];
  };
  toolDiagnostics?: {
    erpToolsReady: boolean;
    recommendedMode: 'native-tool-calling' | 'text-plan' | 'text-only' | 'unavailable' | string;
    nativeToolCalling: {
      attempted: boolean;
      ok: boolean;
      supportedByProvider: boolean;
      expectedByCatalog: boolean;
      detail?: string;
    };
    textPlan: {
      attempted: boolean;
      ok: boolean;
      detail?: string;
    };
  };
  checks?: Array<{
    id: 'network' | 'inference' | 'nativeToolCalling' | 'textPlan' | string;
    status: 'passed' | 'failed' | 'skipped' | string;
    ok: boolean;
    detail?: string;
  }>;
}

export interface UpdateAiSettingsPayload {
  provider?: 'mock' | 'openai_compatible' | 'ollama';
  model?: string;
  apiKey?: string;
  apiEndpoint?: string;
  maxTokensPerRequest?: number;
  maxRequestsPerDay?: number;
  conversationContextMode?: 'minimal' | 'balanced' | 'deep';
  includePreviousToolResults?: boolean;
  isEnabled?: boolean;
  mode?: 'certified_profile' | 'custom_uncertified' | 'legacy_unverified';
  providerId?: string;
  selectedModelProfileId?: string;
  selectedProfileHash?: string;
  runtimeMode?: 'BYOK' | 'CREDITS' | 'DISABLED';
  allowedRuntimeModes?: Array<'BYOK' | 'CREDITS' | 'DISABLED'>;
}

// Proposal Sandbox Types
export type AiProposalType =
  | 'accounting.voucherDraft'
  | 'accounting.journalEntryProposal'
  | 'accounting.correctionEntryProposal'
  | 'accounting.accountMappingProposal'
  | 'inventory.reorderProposal'
  | 'sales.collectionFollowUpProposal'
  | 'reports.managementInsightProposal';

export type AiProposalStatus = 'draft' | 'pending_review' | 'accepted' | 'rejected' | 'archived';
export type AiProposalRiskLevel = 'low' | 'medium' | 'high';

export interface AiProposalDTO {
  id: string;
  companyId: string;
  userId: string;
  sourceChatMessageId: string | null;
  type: AiProposalType;
  status: AiProposalStatus;
  title: string;
  summary: string;
  rationale: string;
  inputContextSummary: string;
  proposedData: Record<string, unknown>;
  warnings: string[];
  riskLevel: AiProposalRiskLevel;
  moduleId: string;
  requiredPermissions: string[];
  missingInfo: string[] | null;
  confidence: number | null;
  createdAt: string;
  updatedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  rejectionReason: string | null;
}

export interface AiProposalListResponse {
  proposals: AiProposalDTO[];
  total: number;
}

// AI Certification Types (shared with superAdmin)
export type AiCertificationCategory =
  | 'GENERAL_CHAT' | 'ACCOUNTING' | 'FINANCE_REPORTING' | 'SALES'
  | 'PURCHASES' | 'INVENTORY' | 'HR' | 'CRM'
  | 'TOOL_CALLING' | 'DATA_FILTERING' | 'PROPOSAL_DRAFT' | 'ANALYTICS';

export type AiCertificationStatus = 'CERTIFIED' | 'WARNING' | 'FAILED' | 'EXPIRED';

export interface AiCertificationResult {
  id: string;
  scope: 'GLOBAL' | 'TENANT';
  tenantId: string | null;
  providerId: string;
  modelProfileId: string;
  profileHash: string;
  moduleId: string | null;
  skillId: string | null;
  category: AiCertificationCategory;
  score: number;
  maxScore: number;
  status: AiCertificationStatus;
  testSuiteVersion: string;
  toolContractVersion: string;
  dataFilterPolicyVersion: string;
  testedAt: string;
  testedBy: string;
  approvedBy: string | null;
  summary: string;
  failureReasons: string[];
  metadata: Record<string, unknown>;
}

export interface CertifiedProfileEntry {
  profile: Record<string, unknown>;
  certifications: AiCertificationResult[];
}

export interface CreateTenantCustomModelProfilePayload {
  providerId: string;
  provider: string;
  modelId: string;
  displayName?: string;
  baseUrl?: string;
  temperature?: number;
  maxOutputTokens?: number;
  jsonMode?: boolean;
  toolMode?: 'none' | 'text_plan' | 'native_tools' | 'json_only';
  timeoutMs?: number;
  retryPolicy?: string;
  safetyPolicyId?: string;
  systemPromptPolicyId?: string;
  dataFilterPolicyId?: string;
}

export interface RunTenantCertificationPayload {
  profileHash: string;
  category: AiCertificationCategory;
  moduleId?: string;
  skillId?: string;
}

// AI Credit Balance Types
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

export const aiAssistantApi = {
  // Chat
  sendMessage: async (payload: SendChatMessagePayload): Promise<SendChatMessageResponse> => {
    const response = await client.post('/tenant/ai-assistant/chat', payload, {
      headers: { 'X-Silent-Error': 'true' }, // Suppress global error toast — handled inline in chat
      timeout: AI_CHAT_TIMEOUT_MS,
    });
    // Response interceptor already unwraps { success, data } envelope
    return response as unknown as SendChatMessageResponse;
  },

  getConversationMessages: async (
    conversationId: string,
    limit: number = 50
  ): Promise<{ messages: ChatMessageDTO[] }> => {
    const response = await client.get(
      `/tenant/ai-assistant/conversations/${conversationId}/messages`,
      { params: { limit } }
    );
    return response as unknown as { messages: ChatMessageDTO[] };
  },

  getRecentConversations: async (
    limit: number = 10
  ): Promise<{ conversations: Array<{ conversationId: string; lastMessage: ChatMessageDTO }> }> => {
    const response = await client.get('/tenant/ai-assistant/conversations', {
      params: { limit },
    });
    return response as unknown as { conversations: Array<{ conversationId: string; lastMessage: ChatMessageDTO }> };
  },

  deleteConversation: async (conversationId: string): Promise<void> => {
    await client.delete(`/tenant/ai-assistant/conversations/${conversationId}`);
  },

  // Settings
  getSettings: async (): Promise<{ config: AiSettingsDTO }> => {
    const response = await client.get('/tenant/ai-assistant/settings');
    return response as unknown as { config: AiSettingsDTO };
  },

  updateSettings: async (payload: UpdateAiSettingsPayload): Promise<{ config: AiSettingsDTO }> => {
    const response = await client.put('/tenant/ai-assistant/settings', payload);
    return response as unknown as { config: AiSettingsDTO };
  },

  listAvailableProviders: async (): Promise<TenantAiProviderOption[]> => {
    const response = await client.get('/tenant/ai-assistant/providers');
    return response as unknown as TenantAiProviderOption[];
  },

  listProviderModels: async (providerId: string): Promise<TenantAiProviderModelOption[]> => {
    const response = await client.get(`/tenant/ai-assistant/providers/${encodeURIComponent(providerId)}/models`);
    return response as unknown as TenantAiProviderModelOption[];
  },

  getUsageAnalytics: async (limit: number = 50): Promise<AiUsageAnalyticsResponse> => {
    const response = await client.get('/tenant/ai-assistant/settings/usage', {
      params: { limit },
    });
    return response as unknown as AiUsageAnalyticsResponse;
  },

  checkProviderHealth: async (): Promise<ProviderHealthResponse> => {
    const response = await client.post('/tenant/ai-assistant/settings/health', undefined, {
      timeout: AI_DIAGNOSTICS_TIMEOUT_MS,
    });
    return response as unknown as ProviderHealthResponse;
  },

  // Proposal Sandbox
  listProposals: async (params?: {
    type?: string;
    status?: string;
    moduleId?: string;
    userId?: string;
    limit?: number;
    offset?: number;
  }): Promise<AiProposalListResponse> => {
    const response = await client.get('/tenant/ai-assistant/proposals', { params });
    return response as unknown as AiProposalListResponse;
  },

  getProposal: async (proposalId: string): Promise<{ proposal: AiProposalDTO; notice?: string }> => {
    const response = await client.get(`/tenant/ai-assistant/proposals/${proposalId}`);
    return response as unknown as { proposal: AiProposalDTO; notice?: string };
  },

  updateProposalStatus: async (
    proposalId: string,
    newStatus: AiProposalStatus,
    rejectionReason?: string,
  ): Promise<{ proposal: AiProposalDTO; notice: string }> => {
    const response = await client.patch(`/tenant/ai-assistant/proposals/${proposalId}/status`, {
      newStatus,
      rejectionReason,
    });
    return response as unknown as { proposal: AiProposalDTO; notice: string };
  },

  archiveProposal: async (proposalId: string): Promise<{ proposal: AiProposalDTO }> => {
    const response = await client.patch(`/tenant/ai-assistant/proposals/${proposalId}/archive`);
    return response as unknown as { proposal: AiProposalDTO };
  },

  // Credit Balance
  getCreditBalance: async (): Promise<AiCreditBalanceResponse> => {
    const response = await client.get('/tenant/ai-assistant/credits');
    return response as unknown as AiCreditBalanceResponse;
  },

  // Tenant Custom Model Profiles & Certification
  createTenantCustomModelProfile: async (data: CreateTenantCustomModelProfilePayload): Promise<Record<string, unknown>> => {
    const response = await client.post('/tenant/ai-assistant/settings/custom-model-profiles', data);
    return response as unknown as Record<string, unknown>;
  },

  updateTenantCustomModelProfile: async (profileId: string, data: Partial<CreateTenantCustomModelProfilePayload>): Promise<Record<string, unknown>> => {
    const response = await client.patch(`/tenant/ai-assistant/settings/custom-model-profiles/${encodeURIComponent(profileId)}`, data);
    return response as unknown as Record<string, unknown>;
  },

  getTenantCustomModelProfile: async (profileId: string): Promise<Record<string, unknown>> => {
    // Double-encode because profile IDs may already contain URL-encoded chars (e.g., %2F)
    // Backend will decode once to get the original ID
    const response = await client.get(`/tenant/ai-assistant/settings/custom-model-profiles/${encodeURIComponent(profileId)}`);
    return response as unknown as Record<string, unknown>;
  },

  deleteTenantCustomModelProfile: async (profileId: string): Promise<{ success: boolean; message: string }> => {
    const response = await client.delete(`/tenant/ai-assistant/settings/custom-model-profiles/${encodeURIComponent(profileId)}`);
    return response as unknown as { success: boolean; message: string };
  },

  runTenantCustomModelDiagnostics: async (profileId: string): Promise<ProviderHealthResponse> => {
    const response = await client.post(
      `/tenant/ai-assistant/settings/custom-model-profiles/${encodeURIComponent(profileId)}/diagnostics`,
      undefined,
      { timeout: AI_DIAGNOSTICS_TIMEOUT_MS },
    );
    return response as unknown as ProviderHealthResponse;
  },

  runTenantCustomModelCertification: async (profileId: string, data: RunTenantCertificationPayload): Promise<AiCertificationResult> => {
    const response = await client.post(
      `/tenant/ai-assistant/settings/custom-model-profiles/${encodeURIComponent(profileId)}/certifications/run`,
      data,
    );
    return response as unknown as AiCertificationResult;
  },

  listTenantCertifiedProfiles: async (params?: { scope?: 'GLOBAL' | 'TENANT' | 'ALL'; category?: string; moduleId?: string }): Promise<CertifiedProfileEntry[]> => {
    const response = await client.get('/tenant/ai-assistant/certified-profiles', { params });
    return response as unknown as CertifiedProfileEntry[];
  },

  // Message Feedback
  updateMessageFeedback: async (
    messageId: string,
    feedback: 'positive' | 'negative'
  ): Promise<ChatMessageDTO> => {
    const response = await client.patch(
      `/tenant/ai-assistant/messages/${encodeURIComponent(messageId)}/feedback`,
      { feedback }
    );
    return response as unknown as ChatMessageDTO;
  },
};
