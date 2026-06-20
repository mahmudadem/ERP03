import { Firestore, Transaction } from 'firebase-admin/firestore';
import { PosSettings } from '../../../../domain/pos/entities/PosSettings';
import { IPosSettingsRepository } from '../../../../repository/interfaces/pos/IPosSettingsRepository';

export class FirestorePosSettingsRepository implements IPosSettingsRepository {
  constructor(private readonly db: Firestore) {}

  /** Single document per company: companies/{companyId}/posSettings/{companyId}. */
  private docRef(companyId: string) {
    return this.db.collection('companies').doc(companyId).collection('posSettings').doc(companyId);
  }

  private asTransaction(transaction?: unknown): Transaction | undefined {
    if (!transaction) return undefined;
    return transaction as Transaction;
  }

  async getSettings(companyId: string): Promise<PosSettings | null> {
    const doc = await this.docRef(companyId).get();
    if (!doc.exists) return null;
    return PosSettings.fromJSON(doc.data());
  }

  async saveSettings(settings: PosSettings, transaction?: unknown): Promise<void> {
    const ref = this.docRef(settings.companyId);
    const payload = settings.toJSON();
    const txn = this.asTransaction(transaction);
    if (txn) {
      txn.set(ref, payload, { merge: true });
      return;
    }
    await ref.set(payload, { merge: true });
  }
}
