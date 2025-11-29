import * as admin from 'firebase-admin';
import { IInventoryTemplateRepository } from '../../../../repository/interfaces/company-wizard/IInventoryTemplateRepository';
import { InfrastructureError } from '../../../errors/InfrastructureError';

export class FirestoreInventoryTemplateRepository implements IInventoryTemplateRepository {
  private collectionName = 'inventory_templates';

  constructor(private db: admin.firestore.Firestore) {}

  async listInventoryTemplates(): Promise<Array<{ id: string; name: string }>> {
    try {
      const snapshot = await this.db.collection(this.collectionName).get();
      return snapshot.docs.map((doc) => {
        const data = doc.data();
        return { id: data.id || doc.id, name: data.name || data.title || 'Inventory Template' };
      });
    } catch (error) {
      throw new InfrastructureError('Failed to list inventory templates', error);
    }
  }
}
