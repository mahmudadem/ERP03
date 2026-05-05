/**
 * aiAssistantApi.ts
 *
 * API client for the AI Assistant module.
 * All requests go through the backend — frontend never calls AI providers directly.
 */

import client from './client';

// Types
export interface ChatMessageDTO {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  provider: string;
  model?: string | null;
  tokenCount?: number | null;
  createdAt: string;
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
}

export interface AiSettingsDTO {
  companyId: string;
  provider: string;
  model: string | null;
  apiEndpoint: string | null;
  maxTokensPerRequest: number | null;
  maxRequestsPerDay: number | null;
  isEnabled: boolean;
  hasApiKey: boolean;
  updatedAt: string;
}

export interface UpdateAiSettingsPayload {
  provider?: 'mock' | 'openai_compatible' | 'ollama';
  model?: string;
  apiKey?: string;
  apiEndpoint?: string;
  maxTokensPerRequest?: number;
  maxRequestsPerDay?: number;
  isEnabled?: boolean;
}

export const aiAssistantApi = {
  // Chat
  sendMessage: async (payload: SendChatMessagePayload): Promise<SendChatMessageResponse> => {
    const response = await client.post('/tenant/ai-assistant/chat', payload, {
      headers: { 'X-Silent-Error': 'true' }, // Suppress global error toast — handled inline in chat
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
};