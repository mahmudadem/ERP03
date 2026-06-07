import { Firestore } from 'firebase-admin/firestore';
import { CommunicationsSettings } from '../../../../domain/communications/CommunicationsSettings';
import { ICommunicationsSettingsRepository } from '../../../../repository/interfaces/communications/ICommunicationsSettingsRepository';

const getRef = (db: Firestore, companyId: string) =>
  db.collection('companies').doc(companyId).collection('communications').doc('settings');

export class FirestoreCommunicationsSettingsRepository implements ICommunicationsSettingsRepository {
  constructor(private readonly db: Firestore) {}

  async getSettings(companyId: string): Promise<CommunicationsSettings | null> {
    const doc = await getRef(this.db, companyId).get();
    if (!doc.exists) return null;
    return CommunicationsSettings.fromJSON(doc.data());
  }

  async saveSettings(settings: CommunicationsSettings): Promise<void> {
    await getRef(this.db, settings.companyId).set(settings.toJSON(), { merge: true });
  }
}
