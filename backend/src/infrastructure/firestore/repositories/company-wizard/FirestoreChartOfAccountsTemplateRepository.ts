import * as admin from 'firebase-admin';
import { IChartOfAccountsTemplateRepository } from '../../../../repository/interfaces/company-wizard/IChartOfAccountsTemplateRepository';
import { InfrastructureError } from '../../../errors/InfrastructureError';

export class FirestoreChartOfAccountsTemplateRepository implements IChartOfAccountsTemplateRepository {
  private collectionName = 'chart_of_accounts_templates';

  constructor(private db: admin.firestore.Firestore) {}

  async listChartOfAccountsTemplates(): Promise<Array<{ id: string; name: string }>> {
    try {
      const snapshot = await this.db.collection(this.collectionName).get();
      return snapshot.docs.map((doc) => {
        const data = doc.data();
        return { id: data.id || doc.id, name: data.name || data.title || 'Template' };
      });
    } catch (error) {
      throw new InfrastructureError('Failed to list chart of accounts templates', error);
    }
  }
}
