import { Firestore, Transaction } from 'firebase-admin/firestore';
import { PosHeldCart, PosHeldCartStatus } from '../../../../domain/pos/entities/PosHeldCart';
import { IPosHeldCartRepository } from '../../../../repository/interfaces/pos/IPosHeldCartRepository';

export class FirestorePosHeldCartRepository implements IPosHeldCartRepository {
  constructor(private readonly db: Firestore) {}

  private collection(companyId: string) {
    return this.db.collection('companies').doc(companyId).collection('posHeldCarts');
  }

  private asTransaction(transaction?: unknown): Transaction | undefined {
    return transaction ? transaction as Transaction : undefined;
  }

  async create(cart: PosHeldCart, transaction?: unknown): Promise<void> {
    const ref = this.collection(cart.companyId).doc(cart.id);
    const payload = cart.toJSON();
    const tx = this.asTransaction(transaction);
    if (tx) {
      tx.set(ref, payload);
      return;
    }
    await ref.set(payload);
  }

  async update(cart: PosHeldCart, transaction?: unknown): Promise<void> {
    const ref = this.collection(cart.companyId).doc(cart.id);
    const payload = cart.toJSON();
    const tx = this.asTransaction(transaction);
    if (tx) {
      tx.set(ref, payload, { merge: true });
      return;
    }
    await ref.set(payload, { merge: true });
  }

  async getById(companyId: string, id: string): Promise<PosHeldCart | null> {
    const doc = await this.collection(companyId).doc(id).get();
    if (!doc.exists) return null;
    return PosHeldCart.fromJSON(doc.data());
  }

  async list(
    companyId: string,
    filters?: { registerId?: string; shiftId?: string; cashierUserId?: string; status?: PosHeldCartStatus; limit?: number }
  ): Promise<PosHeldCart[]> {
    let query: FirebaseFirestore.Query = this.collection(companyId).orderBy('updatedAt', 'desc');
    if (filters?.registerId) query = query.where('registerId', '==', filters.registerId);
    if (filters?.shiftId) query = query.where('shiftId', '==', filters.shiftId);
    if (filters?.cashierUserId) query = query.where('cashierUserId', '==', filters.cashierUserId);
    if (filters?.status) query = query.where('status', '==', filters.status);
    if (filters?.limit) query = query.limit(filters.limit);
    const snap = await query.get();
    return snap.docs.map((d) => PosHeldCart.fromJSON(d.data()));
  }
}
