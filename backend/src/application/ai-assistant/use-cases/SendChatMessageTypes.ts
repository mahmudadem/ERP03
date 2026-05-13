/**
 * Input/output types for SendChatMessageUseCase.
 */

export interface SendChatMessageInput {
  companyId: string;
  userId: string;
  message: string;
  conversationId?: string;
}

export interface SendChatMessageOutput {
  userMessage: import('../../../domain/ai-assistant/entities/AiChatMessage').AiChatMessage;
  assistantMessage: import('../../../domain/ai-assistant/entities/AiChatMessage').AiChatMessage;
  provider: string;
  model: string;
  runtimeMeta?: {
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
  };
}