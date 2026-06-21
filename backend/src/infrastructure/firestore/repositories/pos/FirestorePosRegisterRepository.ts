import { Firestore, Transaction } from 'firebase-admin/firestore';
import { PosRegister } from '../../../../domain/pos/entities/PosRegister';
import { IPosRegisterRepository } from '../../../../repository/interfaces/pos/IPosRegisterRepository';

export class FirestorePosRegisterRepository implements IPosRegisterRepository {
  constructor(private readonly db: Firestore) {}

  private collection(companyId: string) {
    return this.db.collection('companies').doc(companyId).collection('posRegisters');
  }

  private asTransaction(transaction?: unknown): Transaction | undefined {
    if (!transaction) return undefined;
    return transaction as Transaction;
  }

  async create(register: PosRegister, transaction?: unknown): Promise<void> {
    const ref = this.collection(register.companyId).doc(register.id);
    const payload = stripUndefinedDeep(register.toJSON());
    const txn = this.asTransaction(transaction);
    if (txn) {
      txn.set(ref, payload);
      return;
    }
    await ref.set(payload);
  }

  async update(register: PosRegister, transaction?: unknown): Promise<void> {
    const ref = this.collection(register.companyId).doc(register.id);
    const payload = stripUndefinedDeep({ ...register.toJSON(), updatedAt: new Date().toISOString() });
    const txn = this.asTransaction(transaction);
    if (txn) {
      txn.update(ref, payload);
      return;
    }
    await ref.update(payload);
  }

  async getById(companyId: string, id: string): Promise<PosRegister | null> {
    const doc = await this.collection(companyId).doc(id).get();
    if (!doc.exists) return null;
    return PosRegister.fromJSON(doc.data());
  }

  async list(companyId: string): Promise<PosRegister[]> {
    const snap = await this.collection(companyId).orderBy('code', 'asc').get();
    return snap.docs.map((d) => PosRegister.fromJSON(d.data()));
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
