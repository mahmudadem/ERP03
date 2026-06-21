import { Firestore, Transaction } from 'firebase-admin/firestore';
import { POSPolicy } from '../../../../domain/pos/entities/POSPolicy';
import { IPosPolicyRepository } from '../../../../repository/interfaces/pos/IPosPolicyRepository';

export class FirestorePosPolicyRepository implements IPosPolicyRepository {
  constructor(private readonly db: Firestore) {}

  private docRef(companyId: string) {
    return this.db.collection('companies').doc(companyId).collection('posPolicies').doc(companyId);
  }

  private asTransaction(transaction?: unknown): Transaction | undefined {
    if (!transaction) return undefined;
    return transaction as Transaction;
  }

  async getPolicy(companyId: string): Promise<POSPolicy | null> {
    const doc = await this.docRef(companyId).get();
    if (!doc.exists) return null;
    return POSPolicy.fromJSON(doc.data());
  }

  async savePolicy(policy: POSPolicy, transaction?: unknown): Promise<void> {
    policy.updatedAt = new Date();
    const ref = this.docRef(policy.companyId);
    const payload = policy.toJSON();
    const txn = this.asTransaction(transaction);
    if (txn) {
      txn.set(ref, payload, { merge: true });
      return;
    }
    await ref.set(payload, { merge: true });
  }
}