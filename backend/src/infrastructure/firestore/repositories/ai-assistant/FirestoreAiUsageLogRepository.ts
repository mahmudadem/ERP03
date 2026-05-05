import { Firestore } from 'firebase-admin/firestore';
import { IAiUsageLogRepository } from '../../../../repository/interfaces/ai-assistant/IAiUsageLogRepository';
import { AiUsageLog } from '../../../../domain/ai-assistant/entities/AiUsageLog';

/**
 * FirestoreAiUsageLogRepository
 *
 * Stores usage logs under:
 *   companies/{companyId}/ai-assistant/Data/usage_logs/{logId}
 */
export class FirestoreAiUsageLogRepository implements IAiUsageLogRepository {
  constructor(private readonly db: Firestore) {}

  private getCollection(companyId: string) {
    return this.db
      .collection('companies').doc(companyId)
      .collection('ai-assistant').doc('Data')
      .collection('usage_logs');
  }

  async create(log: AiUsageLog): Promise<AiUsageLog> {
    const docRef = this.getCollection(log.companyId).doc(log.id);
    await docRef.set(log.toJSON());
    return log;
  }

  async getByCompany(companyId: string, limit: number = 50, offset: number = 0): Promise<AiUsageLog[]> {
    const snapshot = await this.getCollection(companyId)
      .orderBy('createdAt', 'desc')
      .offset(offset)
      .limit(limit)
      .get();

    return snapshot.docs.map(doc => AiUsageLog.fromJSON(doc.data()));
  }

  async countTodayByCompany(companyId: string): Promise<number> {
    const now = new Date();
    const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const startOfDayStr = startOfDay.toISOString();

    const snapshot = await this.getCollection(companyId)
      .where('createdAt', '>=', startOfDayStr)
      .get();

    return snapshot.size;
  }

  async countTodayByUser(companyId: string, userId: string): Promise<number> {
    const now = new Date();
    const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const startOfDayStr = startOfDay.toISOString();

    const snapshot = await this.getCollection(companyId)
      .where('createdAt', '>=', startOfDayStr)
      .where('userId', '==', userId)
      .get();

    return snapshot.size;
  }

  async getByUser(companyId: string, userId: string, limit: number = 50): Promise<AiUsageLog[]> {
    const snapshot = await this.getCollection(companyId)
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    return snapshot.docs.map(doc => AiUsageLog.fromJSON(doc.data()));
  }
}