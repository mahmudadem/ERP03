import { Firestore } from 'firebase-admin/firestore';
import { InventorySettings } from '../../../../domain/inventory/entities/InventorySettings';
import { IInventorySettingsRepository } from '../../../../repository/interfaces/inventory/IInventorySettingsRepository';
import { InventorySettingsMapper } from '../../mappers/InventoryMappers';
import { getInventorySettingsRef } from './InventoryFirestorePaths';

export class FirestoreInventorySettingsRepository implements IInventorySettingsRepository {
  constructor(private readonly db: Firestore) {}

  async getSettings(companyId: string): Promise<InventorySettings | null> {
    const doc = await getInventorySettingsRef(this.db, companyId).get();
    if (!doc.exists) return null;
    return InventorySettingsMapper.toDomain(doc.data());
  }

  async saveSettings(settings: InventorySettings): Promise<void> {
    await getInventorySettingsRef(this.db, settings.companyId).set(
      InventorySettingsMapper.toPersistence(settings),
      { merge: true }
    );
  }
}
