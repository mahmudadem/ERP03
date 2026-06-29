import { Firestore, Query, Transaction } from 'firebase-admin/firestore';
import { Salesperson } from '../../../../domain/sales/entities/Salesperson';
import {
  ISalespersonRepository,
  SalespersonListOptions,
} from '../../../../repository/interfaces/sales/ISalespersonRepository';
import { getSalesCollection } from './SalesFirestorePaths';

// ---------------------------------------------------------------------------
// Inline mapper (kept private to avoid touching the shared SalesMappers.ts)
// ---------------------------------------------------------------------------

interface SalespersonDoc {
  id: string;
  companyId: string;
  code: string;
  name: string;
  email: string | null;
  defaultCommissionPct: number;
  commissionPayableAccountId: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

class SalespersonMapper {
  static toPersistence(sp: Salesperson): SalespersonDoc {
    return {
      id: sp.id,
      companyId: sp.companyId,
      code: sp.code,
      name: sp.name,
      email: sp.email ?? null,
      defaultCommissionPct: sp.defaultCommissionPct,
      commissionPayableAccountId: sp.commissionPayableAccountId ?? null,
      status: sp.status,
      createdBy: sp.createdBy,
      createdAt: sp.createdAt.toISOString(),
      updatedAt: sp.updatedAt.toISOString(),
    };
  }

  static toDomain(data: any): Salesperson {
    return new Salesperson({
      id: data.id,
      companyId: data.companyId,
      code: data.code,
      name: data.name,
      email: data.email != null ? data.email : undefined,
      defaultCommissionPct: data.defaultCommissionPct,
      commissionPayableAccountId:
        data.commissionPayableAccountId != null
          ? data.commissionPayableAccountId
          : undefined,
      status: data.status as 'ACTIVE' | 'INACTIVE',
      createdBy: data.createdBy,
      createdAt: data.createdAt ? new Date(data.createdAt) : undefined,
      updatedAt: data.updatedAt ? new Date(data.updatedAt) : undefined,
    });
  }
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export class FirestoreSalespersonRepository implements ISalespersonRepository {
  constructor(private readonly db: Firestore) {}

  private collection(companyId: string) {
    return getSalesCollection(this.db, companyId, 'salespersons');
  }

  private asTransaction(transaction?: unknown): Transaction | undefined {
    if (!transaction) return undefined;
    return transaction as Transaction;
  }

  async create(salesperson: Salesperson, transaction?: unknown): Promise<void> {
    const ref = this.collection(salesperson.companyId).doc(salesperson.id);
    const data = SalespersonMapper.toPersistence(salesperson);
    const txn = this.asTransaction(transaction);
    if (txn) {
      txn.set(ref, data);
      return;
    }
    await ref.set(data);
  }

  async update(salesperson: Salesperson, transaction?: unknown): Promise<void> {
    const ref = this.collection(salesperson.companyId).doc(salesperson.id);
    const data = SalespersonMapper.toPersistence(salesperson);
    const txn = this.asTransaction(transaction);
    if (txn) {
      txn.set(ref, data, { merge: true });
      return;
    }
    await ref.set(data, { merge: true });
  }

  async getById(companyId: string, id: string): Promise<Salesperson | null> {
    const doc = await this.collection(companyId).doc(id).get();
    if (!doc.exists) return null;
    return SalespersonMapper.toDomain(doc.data());
  }

  async getByCode(companyId: string, code: string): Promise<Salesperson | null> {
    const snap = await this.collection(companyId)
      .where('code', '==', code)
      .limit(1)
      .get();
    if (snap.empty) return null;
    return SalespersonMapper.toDomain(snap.docs[0].data());
  }

  async list(companyId: string, opts?: SalespersonListOptions): Promise<Salesperson[]> {
    let query: Query = this.collection(companyId);

    const requestedStatus = opts?.status ?? (!opts?.includeInactive ? 'ACTIVE' : undefined);
    if (opts?.status) {
      query = query.where('status', '==', opts.status);
    }

    const snap = await query.get();
    const all = snap.docs.map((doc) => SalespersonMapper.toDomain(doc.data()));
    const filtered = requestedStatus
      ? all.filter((salesperson) => salesperson.status === requestedStatus)
      : all;

    filtered.sort((a, b) => a.name.localeCompare(b.name));

    const offset = Math.max(0, opts?.offset ?? 0);
    const limit = opts?.limit;

    if (typeof limit === 'number') {
      return filtered.slice(offset, offset + limit);
    }
    return filtered.slice(offset);
  }

  async delete(companyId: string, id: string): Promise<void> {
    await this.collection(companyId).doc(id).delete();
  }
}
