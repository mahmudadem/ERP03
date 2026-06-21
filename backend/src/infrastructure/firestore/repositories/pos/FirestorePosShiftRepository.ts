import { Firestore, Transaction } from 'firebase-admin/firestore';
import { PosShift } from '../../../../domain/pos/entities/PosShift';
import { IPosShiftRepository } from '../../../../repository/interfaces/pos/IPosShiftRepository';

export class FirestorePosShiftRepository implements IPosShiftRepository {
  constructor(private readonly db: Firestore) {}

  private collection(companyId: string) {
    return this.db.collection('companies').doc(companyId).collection('posShifts');
  }

  private asTransaction(transaction?: unknown): Transaction | undefined {
    if (!transaction) return undefined;
    return transaction as Transaction;
  }

  async create(shift: PosShift, transaction?: unknown): Promise<void> {
    const ref = this.collection(shift.companyId).doc(shift.id);
    const payload = shift.toJSON();
    const txn = this.asTransaction(transaction);
    if (txn) {
      txn.set(ref, payload);
      return;
    }
    await ref.set(payload);
  }

  async update(shift: PosShift, transaction?: unknown): Promise<void> {
    const ref = this.collection(shift.companyId).doc(shift.id);
    const payload = { ...shift.toJSON(), updatedAt: new Date().toISOString() };
    const txn = this.asTransaction(transaction);
    if (txn) {
      txn.update(ref, payload);
      return;
    }
    await ref.update(payload);
  }

  async getById(companyId: string, id: string): Promise<PosShift | null> {
    const doc = await this.collection(companyId).doc(id).get();
    if (!doc.exists) return null;
    return PosShift.fromJSON(doc.data());
  }

  async getOpenShiftForRegister(companyId: string, registerId: string): Promise<PosShift | null> {
    const snap = await this.collection(companyId)
      .where('registerId', '==', registerId)
      .where('status', '==', 'OPEN')
      .limit(1)
      .get();
    if (snap.empty) return null;
    return PosShift.fromJSON(snap.docs[0].data());
  }

  async getOpenShiftForCashier(companyId: string, cashierUserId: string): Promise<PosShift | null> {
    const snap = await this.collection(companyId)
      .where('cashierUserId', '==', cashierUserId)
      .where('status', '==', 'OPEN')
      .limit(1)
      .get();
    if (snap.empty) return null;
    return PosShift.fromJSON(snap.docs[0].data());
  }

  async list(companyId: string, filters?: { registerId?: string; status?: string; limit?: number }): Promise<PosShift[]> {
    let query: FirebaseFirestore.Query = this.collection(companyId).orderBy('openedAt', 'desc');
    if (filters?.registerId) query = query.where('registerId', '==', filters.registerId);
    if (filters?.status) query = query.where('status', '==', filters.status);
    if (filters?.limit) query = query.limit(filters.limit);
    const snap = await query.get();
    return snap.docs.map((d) => PosShift.fromJSON(d.data()));
  }
}
