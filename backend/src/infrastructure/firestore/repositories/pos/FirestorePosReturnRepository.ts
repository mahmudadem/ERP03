import { Firestore, Transaction } from 'firebase-admin/firestore';
import { PosReturn } from '../../../../domain/pos/entities/PosReturn';
import { IPosReturnRepository } from '../../../../repository/interfaces/pos/IPosReturnRepository';

export class FirestorePosReturnRepository implements IPosReturnRepository {
  constructor(private readonly db: Firestore) {}

  private collection(companyId: string) {
    return this.db.collection('companies').doc(companyId).collection('posReturns');
  }

  private asTransaction(transaction?: unknown): Transaction | undefined {
    if (!transaction) return undefined;
    return transaction as Transaction;
  }

  async create(returnDoc: PosReturn, transaction?: unknown): Promise<void> {
    const ref = this.collection(returnDoc.companyId).doc(returnDoc.id);
    const payload = returnDoc.toJSON();
    const txn = this.asTransaction(transaction);
    if (txn) {
      txn.set(ref, payload);
      return;
    }
    await ref.set(payload);
  }

  async getById(companyId: string, id: string): Promise<PosReturn | null> {
    const doc = await this.collection(companyId).doc(id).get();
    if (!doc.exists) return null;
    return PosReturn.fromJSON(doc.data());
  }

  async list(companyId: string, filters?: { shiftId?: string; originalReceiptId?: string; limit?: number }): Promise<PosReturn[]> {
    let query: FirebaseFirestore.Query = this.collection(companyId).orderBy('createdAt', 'desc');
    if (filters?.shiftId) query = query.where('shiftId', '==', filters.shiftId);
    if (filters?.originalReceiptId) query = query.where('originalReceiptId', '==', filters.originalReceiptId);
    if (filters?.limit) query = query.limit(filters.limit);
    const snap = await query.get();
    return snap.docs.map((d) => PosReturn.fromJSON(d.data()));
  }
}
