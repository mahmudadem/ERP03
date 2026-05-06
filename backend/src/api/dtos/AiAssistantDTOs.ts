/**
 * AiAssistantDTOs - Request/Response types for AI Assistant endpoints
 */

export interface SendChatMessageRequest {
  message: string;
  conversationId?: string;
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
    updatedAt: string;
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
      createdAt: message.createdAt?.toISOString?.() || message.createdAt,
    };
  }
}
