import * as admin from 'firebase-admin';
import { ICurrencyRepository } from '../../../../repository/interfaces/company-wizard/ICurrencyRepository';
import { InfrastructureError } from '../../../errors/InfrastructureError';

export class FirestoreCurrencyRepository implements ICurrencyRepository {
  private collectionName = 'system_currencies';

  constructor(private db: admin.firestore.Firestore) {}

  async listCurrencies(): Promise<Array<{ id: string; name: string }>> {
    try {
      const snapshot = await this.db.collection(this.collectionName).get();
      return snapshot.docs.map((doc) => {
        const data = doc.data();
        const label = data.name || data.code || doc.id;
        return { id: data.id || doc.id, name: label };
      });
    } catch (error) {
      throw new InfrastructureError('Failed to list currencies', error);
    }
  }
}
