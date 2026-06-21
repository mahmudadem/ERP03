import { Firestore, Transaction } from 'firebase-admin/firestore';
import { PosReceipt } from '../../../../domain/pos/entities/PosReceipt';
import { IPosReceiptRepository } from '../../../../repository/interfaces/pos/IPosReceiptRepository';

export class FirestorePosReceiptRepository implements IPosReceiptRepository {
  constructor(private readonly db: Firestore) {}

  private collection(companyId: string) {
    return this.db.collection('companies').doc(companyId).collection('posReceipts');
  }

  private asTransaction(transaction?: unknown): Transaction | undefined {
    if (!transaction) return undefined;
    return transaction as Transaction;
  }

  async create(receipt: PosReceipt, transaction?: unknown): Promise<void> {
    const ref = this.collection(receipt.companyId).doc(receipt.id);
    const payload = receipt.toJSON();
    const txn = this.asTransaction(transaction);
    if (txn) {
      txn.set(ref, payload);
      return;
    }
    await ref.set(payload);
  }

  async getById(companyId: string, id: string): Promise<PosReceipt | null> {
    const doc = await this.collection(companyId).doc(id).get();
    if (!doc.exists) return null;
    return PosReceipt.fromJSON(doc.data());
  }

  async getByNumber(companyId: string, number: string): Promise<PosReceipt | null> {
    const snap = await this.collection(companyId).where('receiptNumber', '==', number).limit(1).get();
    if (snap.empty) return null;
    return PosReceipt.fromJSON(snap.docs[0].data());
  }

  async list(
    companyId: string,
    filters?: { shiftId?: string; registerId?: string; customerId?: string; dateFrom?: string; dateTo?: string; limit?: number }
  ): Promise<PosReceipt[]> {
    let query: FirebaseFirestore.Query = this.collection(companyId).orderBy('createdAt', 'desc');
    if (filters?.shiftId) query = query.where('shiftId', '==', filters.shiftId);
    if (filters?.registerId) query = query.where('registerId', '==', filters.registerId);
    if (filters?.customerId) query = query.where('customerId', '==', filters.customerId);
    if (filters?.dateFrom) query = query.where('createdAt', '>=', filters.dateFrom);
    if (filters?.dateTo) query = query.where('createdAt', '<=', filters.dateTo);
    if (filters?.limit) query = query.limit(filters.limit);
    const snap = await query.get();
    return snap.docs.map((d) => PosReceipt.fromJSON(d.data()));
  }
}
