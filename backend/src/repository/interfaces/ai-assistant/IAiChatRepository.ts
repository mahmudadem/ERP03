/**
 * IAiChatRepository - Repository Interface
 *
 * DB-agnostic interface for AI chat message persistence.
 * Implementations: FirestoreAiChatRepository, PrismaAiChatRepository
 */

import { AiChatMessage } from '../../../domain/ai-assistant/entities/AiChatMessage';

export interface IAiChatRepository {
  /**
   * Save a chat message and return the saved entity with generated ID.
   */
  create(message: AiChatMessage): Promise<AiChatMessage>;

  /**
   * Get recent messages for a conversation, ordered by creation time.
   */
  getConversationMessages(
    companyId: string,
    userId: string,
    conversationId: string,
    limit?: number
  ): Promise<AiChatMessage[]>;

  /**
   * Get recent conversations for a user (latest message per conversationId).
   */
  getRecentConversations(
    companyId: string,
    userId: string,
    limit?: number
  ): Promise<AiChatMessage[]>;

  /**
   * Delete all messages in a conversation.
   */
  deleteConversation(
    companyId: string,
    userId: string,
    conversationId: string
  ): Promise<void>;

  /**
   * Count user messages sent by a company today (UTC).
   * NOTE: Rate limiting is now handled by AiRateLimiterService using
   * dailyRequestCount in AiProviderConfig (not by querying stored messages).
   * This method is retained for potential analytics/auditing use.
   */
  countToday(companyId: string): Promise<number>;
}