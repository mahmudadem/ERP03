import { Firestore } from 'firebase-admin/firestore';
import { PurchaseSettings } from '../../../../domain/purchases/entities/PurchaseSettings';
import { IPurchaseSettingsRepository } from '../../../../repository/interfaces/purchases/IPurchaseSettingsRepository';
import { PurchaseSettingsMapper } from '../../mappers/PurchaseMappers';
import { getPurchasesSettingsRef } from './PurchaseFirestorePaths';

export class FirestorePurchaseSettingsRepository implements IPurchaseSettingsRepository {
  constructor(private readonly db: Firestore) {}

  async getSettings(companyId: string): Promise<PurchaseSettings | null> {
    const doc = await getPurchasesSettingsRef(this.db, companyId).get();
    if (!doc.exists) return null;
    return PurchaseSettingsMapper.toDomain(doc.data());
  }

  async saveSettings(settings: PurchaseSettings): Promise<void> {
    await getPurchasesSettingsRef(this.db, settings.companyId).set(
      PurchaseSettingsMapper.toPersistence(settings),
      { merge: true }
    );
  }
}
