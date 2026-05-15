/**
 * Types for StreamChatMessageUseCase.executeStream — SSE streaming output.
 *
 * AiStreamEvent is the union type yielded by executeStream().
 * It mirrors the provider-level streaming events but adds application-level
 * events for tool results and richer done metadata.
 */

/**
 * SSE streaming events yielded by executeStream().
 *
 * - token: A piece of the AI's text response, streamed as it generates.
 * - tool_call: The AI requested a tool invocation (name + arguments).
 * - tool_result: The result of executing a tool call server-side.
 * - done: The response is complete. Includes provider/model metadata.
 * - error: An error occurred during streaming.
 */
export type AiStreamEvent =
  | { type: 'token'; content: string }
  | { type: 'tool_call'; toolName: string; toolCallId: string; toolArgs: Record<string, unknown> }
  | { type: 'tool_result'; toolName: string; data: unknown; approved: boolean; error?: string; durationMs?: number; round?: number }
  | { type: 'done'; metadata: AiStreamDoneMetadata }
  | { type: 'error'; message: string };

export interface AiStreamDoneMetadata {
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
      durationMs?: number;
      round?: number;
      error?: string;
    }>;
    proposal?: Record<string, unknown>;
    actualRounds?: number;
  };
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}