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
    // toJSON() always emits the complete settings schema, so we write the whole
    // document (no `{ merge: true }`). With merge, blanked optional fields
    // (walkInCustomerId, cashOver/ShortAccountId, payment-method label) were
    // stripped as `undefined` and the merge kept their previous value — so they
    // could never be cleared. A full set drops omitted keys, clearing them.
    const payload = stripUndefinedDeep(settings.toJSON());
    const txn = this.asTransaction(transaction);
    if (txn) {
      txn.set(ref, payload);
      return;
    }
    await ref.set(payload);
  }
}

function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefinedDeep(item)) as T;
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .map(([key, item]) => [key, stripUndefinedDeep(item)])
    ) as T;
  }
  return value;
}
