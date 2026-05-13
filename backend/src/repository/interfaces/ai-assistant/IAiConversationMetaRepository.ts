/**
 * IAiConversationMetaRepository - Repository Interface
 *
 * DB-agnostic interface for AI conversation metadata persistence.
 * Each conversation has exactly one metadata document stored at
 * companies/{companyId}/ai_conversation_meta/{conversationId}.
 *
 * The metadata holds the conversation title (auto-generated from the
 * first user message), message count, and timestamps so that the
 * conversation list endpoint can return fast summary data without
 * scanning all messages.
 */

export interface AiConversationMeta {
  /** Same as the conversationId used in AiChatMessage */
  id: string;
  companyId: string;
  userId: string;
  title: string;
  messageCount: number;
  lastMessageAt: Date;
  createdAt: Date;
}

export interface IAiConversationMetaRepository {
  /**
   * Get metadata for a single conversation.
   * Returns null if no metadata exists yet.
   */
  get(conversationId: string, companyId: string): Promise<AiConversationMeta | null>;

  /**
   * List conversation metadata for a user, most recent first.
   */
  listByUser(companyId: string, userId: string, limit?: number): Promise<AiConversationMeta[]>;

  /**
   * Save (create or update) conversation metadata.
   */
  save(meta: AiConversationMeta): Promise<void>;

  /**
   * Delete conversation metadata.
   */
  delete(conversationId: string, companyId: string): Promise<void>;
}