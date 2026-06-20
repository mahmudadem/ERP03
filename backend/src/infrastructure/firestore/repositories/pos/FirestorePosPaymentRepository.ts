import { Firestore, Transaction } from 'firebase-admin/firestore';
import { PosPayment } from '../../../../domain/pos/entities/PosPayment';
import { IPosPaymentRepository } from '../../../../repository/interfaces/pos/IPosPaymentRepository';

export class FirestorePosPaymentRepository implements IPosPaymentRepository {
  constructor(private readonly db: Firestore) {}

  private collection(companyId: string) {
    return this.db.collection('companies').doc(companyId).collection('posPayments');
  }

  private asTransaction(transaction?: unknown): Transaction | undefined {
    if (!transaction) return undefined;
    return transaction as Transaction;
  }

  async create(payment: PosPayment, transaction?: unknown): Promise<void> {
    const ref = this.collection(payment.companyId).doc(payment.id);
    const payload = payment.toJSON();
    const txn = this.asTransaction(transaction);
    if (txn) {
      txn.set(ref, payload);
      return;
    }
    await ref.set(payload);
  }

  async listByReceipt(companyId: string, receiptId: string): Promise<PosPayment[]> {
    const snap = await this.collection(companyId).where('receiptId', '==', receiptId).get();
    return snap.docs.map((d) => PosPayment.fromJSON(d.data()));
  }
}
