/**
 * aiAssistantApi.ts
 *
 * API client for the AI Assistant module.
 * All requests go through the backend — frontend never calls AI providers directly.
 */

import client, { getAuthToken, getCompanyId } from './client';
import { env } from '../config/env';

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
    durationMs?: number;
    round?: number;
    error?: string;
  }>;
  proposal?: Record<string, unknown>;
  actualRounds?: number;
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
  actualRounds?: number;
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
  durationMs?: number;
  round?: number;
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

// --- SSE Streaming Types ---

export type AiStreamEvent =
  | { type: 'token'; content: string }
  | { type: 'status'; stage: 'thinking' | 'fetching_data' | 'analyzing' | 'generating' }
  | { type: 'tool_call'; toolName: string; toolCallId: string; toolArgs: Record<string, unknown> }
  | { type: 'tool_result'; toolName: string; data: unknown; approved: boolean; error?: string; durationMs?: number; round?: number }
  | { type: 'done'; metadata: AiStreamDoneMetadata }
  | { type: 'error'; message: string };

export interface AiStreamDoneMetadata {
  provider: string;
  model: string;
  runtimeMeta?: ChatRuntimeMetadataDTO;
  usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
  durationMs?: number;
  creditsUsed?: number;
}

/**
 * Custom error for pre-stream HTTP failures (400/401/403/429).
 * Carries the HTTP status so callers can differentiate error types.
 */
export class AiStreamError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
    this.name = 'AiStreamError';
  }
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
  allowUnverifiedModels: boolean;
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

export interface UsageSummaryResponse {
  period: string;
  totalRequests: number;
  totalTokensUsed: number;
  creditsRemaining?: number;
  requestsByUser: Array<{ userId: string; requests: number }>;
  requestsByDay: Array<{ date: string; count: number }>;
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
  allowUnverifiedModels?: boolean;
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

export interface ConversationMetaDTO {
  conversationId: string;
  title?: string;
  messageCount?: number;
  lastMessageAt?: string;
  createdAt?: string;
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
    limit: number = 20
  ): Promise<{ conversations: Array<ConversationMetaDTO> }> => {
    const response = await client.get('/tenant/ai-assistant/conversations', {
      params: { limit },
    });
    return response as unknown as { conversations: Array<ConversationMetaDTO> };
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

  getUsageSummary: async (): Promise<UsageSummaryResponse> => {
    const response = await client.get('/tenant/ai-assistant/usage/summary');
    return response as unknown as UsageSummaryResponse;
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

  listTenantCertifiedProfiles: async (params?: { scope?: 'GLOBAL' | 'TENANT' | 'ALL'; category?: string; moduleId?: string; mode?: 'BYOK' | 'CREDITS' }): Promise<CertifiedProfileEntry[]> => {
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

/**
 * Send a chat message and consume the response as an SSE (Server-Sent Events) stream.
 *
 * Uses native `fetch` instead of axios because axios does not support SSE streaming
 * (it buffers the entire response body before resolving the promise). The auth token
 * and company-id headers are obtained from the same pluggable getters used by the
 * axios client so behaviour is consistent with the rest of the API layer.
 */
export async function streamMessage(
  payload: SendChatMessagePayload,
  onEvent: (event: AiStreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const token = await getAuthToken();
  const companyId = getCompanyId();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'text/event-stream',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (companyId) {
    headers['x-company-id'] = companyId;
  }

  const url = `${env.apiBaseUrl}/tenant/ai-assistant/chat/stream`;
  console.log('[AI-DEBUG] STREAM CONNECTION INITIATED. URL:', url);

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal,
  });

  // Pre-stream HTTP errors (400/401/403/429): response body is JSON { success, error }
  if (!response.ok) {
    let errorMessage = `Request failed (${response.status})`;
    try {
      const errorBody = await response.json();
      errorMessage = errorBody?.error || errorBody?.message || errorMessage;
    } catch {
      // If we can't parse the error body, use the default message
    }
    throw new AiStreamError(errorMessage, response.status);
  }

  // Parse SSE stream from response body
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Response body is not readable');
  }

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // SSE events are separated by blank lines (\n\n or \r\n\r\n).
      let boundary: number;
      while ((boundary = buffer.indexOf('\n\n')) !== -1) {
        const eventText = buffer.substring(0, boundary);
        buffer = buffer.substring(boundary + 2);
        parseSSEEvent(eventText, onEvent);
      }
      // Also check for \r\n\r\n
      while ((boundary = buffer.indexOf('\r\n\r\n')) !== -1) {
        const eventText = buffer.substring(0, boundary);
        buffer = buffer.substring(boundary + 4);
        parseSSEEvent(eventText, onEvent);
      }
    }

    // Process any remaining data in the buffer (last event may lack trailing \n\n)
    const trimmed = buffer.trim();
    if (trimmed) {
      parseSSEEvent(trimmed, onEvent);
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Parse a single SSE event text block into an AiStreamEvent and emit it.
 * SSE lines starting with ":" are comments (keep-alive) and are ignored.
 */
function parseSSEEvent(eventText: string, onEvent: (event: AiStreamEvent) => void): void {
  const lines = eventText.split(/\r?\n/);
  let eventName = '';
  const dataLines: string[] = [];

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith(':')) continue;
    
    if (trimmedLine.startsWith('event:')) {
      eventName = trimmedLine.substring(6).trim();
    } else if (trimmedLine.startsWith('data:')) {
      dataLines.push(trimmedLine.substring(5).trim());
    }
  }

  if (!eventName || dataLines.length === 0) return;

  // Per SSE spec, multiple data lines are joined with \n
  const data = dataLines.join('\n');

  try {
    const parsed = JSON.parse(data);
    switch (eventName) {
      case 'token':
        onEvent({ type: 'token', content: parsed.content ?? '' });
        break;
      case 'status':
        onEvent({ type: 'status', stage: parsed.stage ?? 'thinking' });
        break;
      case 'tool_call':
        onEvent({
          type: 'tool_call',
          toolName: parsed.toolName ?? '',
          toolCallId: parsed.toolCallId ?? '',
          toolArgs: parsed.toolArgs ?? {},
        });
        break;
      case 'tool_result':
        onEvent({
          type: 'tool_result',
          toolName: parsed.toolName ?? '',
          data: parsed.data,
          approved: parsed.approved ?? false,
          error: parsed.error,
          durationMs: parsed.durationMs,
          round: parsed.round,
        });
        break;
      case 'done':
        onEvent({
          type: 'done',
          metadata: parsed.metadata ?? parsed,
        });
        break;
      case 'error':
        onEvent({
          type: 'error',
          message: parsed.message ?? 'Unknown streaming error',
        });
        break;
      default:
        // Unknown event type; silently ignore
        break;
    }
  } catch (err) {
    // If JSON parse fails, emit an error event but keep reading
    onEvent({
      type: 'error',
      message: `Failed to parse SSE event: ${String(err)}`,
    });
  }
}
