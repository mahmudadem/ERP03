/**
 * AiChatMessage - Domain Entity
 *
 * Represents a single message in an AI Assistant conversation.
 * Chat messages are advisory-only — they must NEVER create, update,
 * delete, approve, post, or modify business records.
 */

export type AiChatRole = 'user' | 'assistant' | 'system';

export type AiChatFeedback = 'positive' | 'negative';

export interface AiChatMessageProps {
  id: string;
  companyId: string;
  userId: string;
  conversationId: string;
  role: AiChatRole;
  content: string;
  provider: string;           // 'mock' | 'openai' | 'ollama' | etc.
  model?: string;             // Provider-specific model identifier
  tokenCount?: number;        // Tokens consumed (for usage tracking)
  metadata?: Record<string, unknown>; // Extensible metadata
  feedback?: AiChatFeedback;  // User feedback on the message (assistant messages only)
  createdAt: Date;
}

export class AiChatMessage implements AiChatMessageProps {
  constructor(
    public id: string,
    public companyId: string,
    public userId: string,
    public conversationId: string,
    public role: AiChatRole,
    public content: string,
    public provider: string,
    public model?: string,
    public tokenCount?: number,
    public metadata?: Record<string, unknown>,
    public feedback?: AiChatFeedback,
    public createdAt: Date = new Date()
  ) {}

  static create(input: {
    companyId: string;
    userId: string;
    conversationId: string;
    role: AiChatRole;
    content: string;
    provider: string;
    model?: string;
    metadata?: Record<string, unknown>;
  }): AiChatMessage {
    const id = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    return new AiChatMessage(
      id,
      input.companyId,
      input.userId,
      input.conversationId,
      input.role,
      input.content,
      input.provider,
      input.model,
      undefined,
      input.metadata,
      undefined,
      new Date()
    );
  }

  /**
   * Update the feedback field on this message.
   * Only assistant messages should receive feedback.
   * Passing the same value as current feedback removes it (toggle off).
   */
  setFeedback(feedback: 'positive' | 'negative' | undefined): AiChatMessage {
    this.feedback = feedback;
    return this;
  }

  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      companyId: this.companyId,
      userId: this.userId,
      conversationId: this.conversationId,
      role: this.role,
      content: this.content,
      provider: this.provider,
      model: this.model || null,
      tokenCount: this.tokenCount || null,
      metadata: this.metadata || null,
      feedback: this.feedback || null,
      createdAt: this.createdAt.toISOString(),
    };
  }

  static fromJSON(data: Record<string, any>): AiChatMessage {
    return new AiChatMessage(
      data.id,
      data.companyId,
      data.userId,
      data.conversationId,
      data.role,
      data.content,
      data.provider,
      data.model || undefined,
      data.tokenCount || undefined,
      data.metadata || undefined,
      data.feedback || undefined,
      data.createdAt?.toDate?.() || new Date(data.createdAt)
    );
  }
}