import { Firestore, Timestamp, Transaction } from 'firebase-admin/firestore';
import { PaymentHistory, PaymentSourceType } from '../../../../domain/shared/entities/PaymentHistory';
import { IPaymentHistoryRepository } from '../../../../repository/interfaces/shared/IPaymentHistoryRepository';
import { getSharedCollection } from './SharedFirestorePaths';

const toTimestamp = (value: Date | undefined): Timestamp | null => {
  if (!value) return null;
  return Timestamp.fromDate(value);
};

const toDate = (value: unknown): Date | undefined => {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  if (typeof value === 'object' && value !== null && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }
  return new Date(String(value));
};

export class FirestorePaymentHistoryRepository implements IPaymentHistoryRepository {
  constructor(private readonly db: Firestore) {}

  private collection(companyId: string) {
    return getSharedCollection(this.db, companyId, 'payment_history');
  }

  async create(payment: PaymentHistory, transaction?: unknown): Promise<void> {
    const ref = this.collection(payment.companyId).doc(payment.id);
    const data = this.toPersistence(payment);
    if (transaction) {
      (transaction as Transaction).set(ref, data);
      return;
    }
    await ref.set(data);
  }

  async getById(companyId: string, id: string): Promise<PaymentHistory | null> {
    const doc = await this.collection(companyId).doc(id).get();
    if (!doc.exists) return null;
    return this.toDomain(doc.data());
  }

  async getBySource(companyId: string, sourceType: PaymentSourceType, sourceId: string): Promise<PaymentHistory[]> {
    const snap = await this.collection(companyId)
      .where('sourceType', '==', sourceType)
      .where('sourceId', '==', sourceId)
      .orderBy('paymentDate', 'desc')
      .get();
    return snap.docs.map((doc) => this.toDomain(doc.data()));
  }

  private toPersistence(payment: PaymentHistory): Record<string, unknown> {
    return {
      id: payment.id,
      companyId: payment.companyId,
      sourceType: payment.sourceType,
      sourceId: payment.sourceId,
      sourceNumber: payment.sourceNumber,
      amountBase: payment.amountBase,
      currency: payment.currency,
      exchangeRate: payment.exchangeRate,
      amountDoc: payment.amountDoc,
      paymentDate: payment.paymentDate,
      paymentMethod: payment.paymentMethod,
      reference: payment.reference ?? null,
      notes: payment.notes ?? null,
      voucherId: payment.voucherId ?? null,
      createdBy: payment.createdBy,
      createdAt: toTimestamp(payment.createdAt),
    };
  }

  private toDomain(data: Record<string, unknown>): PaymentHistory {
    return PaymentHistory.fromJSON({
      ...data,
      createdAt: toDate(data.createdAt),
    });
  }
}
