/**
 * AiConversationCleanupService
 *
 * Maintenance service for deleting conversations older than a configurable
 * retention period. Triggered by the Super Admin cleanup endpoint.
 *
 * NOTE: Proposal protection is not yet implemented because proposals do not
 * currently carry a conversationId. Once AiProposal gains a conversationId
 * field, add a check to skip conversations with non-archived proposals.
 */

import { IAiConversationMetaRepository } from '../../../repository/interfaces/ai-assistant/IAiConversationMetaRepository';
import { IAiChatRepository } from '../../../repository/interfaces/ai-assistant/IAiChatRepository';

export interface CleanupReport {
  retentionDays: number;
  cutoffDate: string;
  companiesProcessed: number;
  conversationsDeleted: number;
  errors: string[];
}

export class AiConversationCleanupService {
  constructor(
    private readonly conversationMetaRepository: IAiConversationMetaRepository,
    private readonly chatRepository: IAiChatRepository,
  ) {}

  /**
   * Run cleanup for a single company.
   * Returns the number of conversations deleted.
   */
  async cleanupCompany(companyId: string, retentionDays: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const conversations = await this.conversationMetaRepository.listByCompany(companyId, 200);
    const expired = conversations.filter(c => c.lastMessageAt < cutoffDate);

    for (const conv of expired) {
      try {
        await this.chatRepository.deleteConversation(companyId, conv.userId, conv.id);
        await this.conversationMetaRepository.delete(conv.id, companyId);
      } catch (err) {
        console.warn(`[ConversationCleanup] Failed to delete conversation ${conv.id} for company ${companyId}:`, err);
      }
    }

    return expired.length;
  }

  /**
   * Run cleanup across all companies.
   * Note: This requires companies to be passed in since the conversation
   * meta repository is scoped per-company.
   */
  async cleanupAll(companyIds: string[], retentionDays: number = 90): Promise<CleanupReport> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const report: CleanupReport = {
      retentionDays,
      cutoffDate: cutoffDate.toISOString(),
      companiesProcessed: 0,
      conversationsDeleted: 0,
      errors: [],
    };

    for (const companyId of companyIds) {
      try {
        const deleted = await this.cleanupCompany(companyId, retentionDays);
        report.conversationsDeleted += deleted;
        report.companiesProcessed++;
      } catch (err) {
        report.errors.push(`Company ${companyId}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return report;
  }
}
