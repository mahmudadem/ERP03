import { Firestore, Query, Transaction } from 'firebase-admin/firestore';
import { CustomerGroup } from '../../../../domain/sales/entities/CustomerGroup';
import {
  ICustomerGroupRepository,
  CustomerGroupListOptions,
} from '../../../../repository/interfaces/sales/ICustomerGroupRepository';
import { getSalesCollection } from './SalesFirestorePaths';

// ---------------------------------------------------------------------------
// Inline mapper (kept private to avoid touching the shared SalesMappers.ts)
// ---------------------------------------------------------------------------

interface CustomerGroupDoc {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  defaultPriceListId: string | null;
  defaultPaymentTermsDays: number | null;
  defaultCreditLimit: number | null;
  taxExempt: boolean;
  status: 'ACTIVE' | 'INACTIVE';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

class CustomerGroupMapper {
  static toPersistence(group: CustomerGroup): CustomerGroupDoc {
    return {
      id: group.id,
      companyId: group.companyId,
      name: group.name,
      description: group.description ?? null,
      defaultPriceListId: group.defaultPriceListId ?? null,
      defaultPaymentTermsDays: group.defaultPaymentTermsDays ?? null,
      defaultCreditLimit: group.defaultCreditLimit ?? null,
      taxExempt: group.taxExempt,
      status: group.status,
      createdBy: group.createdBy,
      createdAt: group.createdAt.toISOString(),
      updatedAt: group.updatedAt.toISOString(),
    };
  }

  static toDomain(data: any): CustomerGroup {
    return new CustomerGroup({
      id: data.id,
      companyId: data.companyId,
      name: data.name,
      description: data.description != null ? data.description : undefined,
      defaultPriceListId: data.defaultPriceListId != null ? data.defaultPriceListId : undefined,
      defaultPaymentTermsDays: data.defaultPaymentTermsDays != null
        ? data.defaultPaymentTermsDays
        : undefined,
      defaultCreditLimit: data.defaultCreditLimit != null ? data.defaultCreditLimit : undefined,
      taxExempt: Boolean(data.taxExempt),
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

export class FirestoreCustomerGroupRepository implements ICustomerGroupRepository {
  constructor(private readonly db: Firestore) {}

  private collection(companyId: string) {
    return getSalesCollection(this.db, companyId, 'customer_groups');
  }

  private asTransaction(transaction?: unknown): Transaction | undefined {
    if (!transaction) return undefined;
    return transaction as Transaction;
  }

  async create(group: CustomerGroup, transaction?: unknown): Promise<void> {
    const ref = this.collection(group.companyId).doc(group.id);
    const data = CustomerGroupMapper.toPersistence(group);
    const txn = this.asTransaction(transaction);
    if (txn) {
      txn.set(ref, data);
      return;
    }
    await ref.set(data);
  }

  async update(group: CustomerGroup, transaction?: unknown): Promise<void> {
    const ref = this.collection(group.companyId).doc(group.id);
    const data = CustomerGroupMapper.toPersistence(group);
    const txn = this.asTransaction(transaction);
    if (txn) {
      txn.set(ref, data, { merge: true });
      return;
    }
    await ref.set(data, { merge: true });
  }

  async getById(companyId: string, id: string): Promise<CustomerGroup | null> {
    const doc = await this.collection(companyId).doc(id).get();
    if (!doc.exists) return null;
    return CustomerGroupMapper.toDomain(doc.data());
  }

  async getByName(companyId: string, name: string): Promise<CustomerGroup | null> {
    const snap = await this.collection(companyId)
      .where('name', '==', name)
      .limit(1)
      .get();
    if (snap.empty) return null;
    return CustomerGroupMapper.toDomain(snap.docs[0].data());
  }

  async list(companyId: string, opts?: CustomerGroupListOptions): Promise<CustomerGroup[]> {
    let query: Query = this.collection(companyId);

    const requestedStatus = opts?.status ?? (!opts?.includeInactive ? 'ACTIVE' : undefined);
    if (opts?.status) {
      query = query.where('status', '==', opts.status);
    }

    const snap = await query.get();
    const all = snap.docs.map((doc) => CustomerGroupMapper.toDomain(doc.data()));
    const filtered = requestedStatus
      ? all.filter((group) => group.status === requestedStatus)
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
    const ref = this.collection(companyId).doc(id);
    await ref.delete();
  }
}
