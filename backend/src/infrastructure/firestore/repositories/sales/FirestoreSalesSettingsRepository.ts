import { Firestore } from 'firebase-admin/firestore';
import { SalesSettings } from '../../../../domain/sales/entities/SalesSettings';
import { ISalesSettingsRepository } from '../../../../repository/interfaces/sales/ISalesSettingsRepository';
import { SalesSettingsMapper } from '../../mappers/SalesMappers';
import { getSalesSettingsRef } from './SalesFirestorePaths';

export class FirestoreSalesSettingsRepository implements ISalesSettingsRepository {
  constructor(private readonly db: Firestore) {}

  async getSettings(companyId: string): Promise<SalesSettings | null> {
    const doc = await getSalesSettingsRef(this.db, companyId).get();
    if (!doc.exists) return null;
    return SalesSettingsMapper.toDomain(doc.data());
  }

  async saveSettings(settings: SalesSettings, transaction?: unknown): Promise<void> {
    const ref = getSalesSettingsRef(this.db, settings.companyId);
    const data = SalesSettingsMapper.toPersistence(settings);
    
    if (transaction) {
      (transaction as any).set(ref, data, { merge: true });
      return;
    }
    
    await ref.set(data, { merge: true });
  }
}
