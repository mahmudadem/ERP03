import { Firestore, Query, Transaction } from 'firebase-admin/firestore';
import { VendorGroup } from '../../../../domain/purchases/entities/VendorGroup';
import {
  IVendorGroupRepository,
  VendorGroupListOptions,
} from '../../../../repository/interfaces/purchases/IVendorGroupRepository';
import { getPurchasesCollection } from './PurchaseFirestorePaths';

interface VendorGroupDoc {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

class VendorGroupMapper {
  static toPersistence(group: VendorGroup): VendorGroupDoc {
    return {
      id: group.id,
      companyId: group.companyId,
      name: group.name,
      description: group.description ?? null,
      status: group.status,
      createdBy: group.createdBy,
      createdAt: group.createdAt.toISOString(),
      updatedAt: group.updatedAt.toISOString(),
    };
  }

  static toDomain(data: any): VendorGroup {
    return new VendorGroup({
      id: data.id,
      companyId: data.companyId,
      name: data.name,
      description: data.description != null ? data.description : undefined,
      status: data.status as 'ACTIVE' | 'INACTIVE',
      createdBy: data.createdBy,
      createdAt: data.createdAt ? new Date(data.createdAt) : undefined,
      updatedAt: data.updatedAt ? new Date(data.updatedAt) : undefined,
    });
  }
}

export class FirestoreVendorGroupRepository implements IVendorGroupRepository {
  constructor(private readonly db: Firestore) {}

  private collection(companyId: string) {
    return getPurchasesCollection(this.db, companyId, 'vendor_groups');
  }

  private asTransaction(transaction?: unknown): Transaction | undefined {
    if (!transaction) return undefined;
    return transaction as Transaction;
  }

  async create(group: VendorGroup, transaction?: unknown): Promise<void> {
    const ref = this.collection(group.companyId).doc(group.id);
    const data = VendorGroupMapper.toPersistence(group);
    const txn = this.asTransaction(transaction);
    if (txn) {
      txn.set(ref, data);
      return;
    }
    await ref.set(data);
  }

  async update(group: VendorGroup, transaction?: unknown): Promise<void> {
    const ref = this.collection(group.companyId).doc(group.id);
    const data = VendorGroupMapper.toPersistence(group);
    const txn = this.asTransaction(transaction);
    if (txn) {
      txn.set(ref, data, { merge: true });
      return;
    }
    await ref.set(data, { merge: true });
  }

  async getById(companyId: string, id: string): Promise<VendorGroup | null> {
    const doc = await this.collection(companyId).doc(id).get();
    if (!doc.exists) return null;
    return VendorGroupMapper.toDomain(doc.data());
  }

  async getByName(companyId: string, name: string): Promise<VendorGroup | null> {
    const snap = await this.collection(companyId)
      .where('name', '==', name)
      .limit(1)
      .get();
    if (snap.empty) return null;
    return VendorGroupMapper.toDomain(snap.docs[0].data());
  }

  async list(companyId: string, opts?: VendorGroupListOptions): Promise<VendorGroup[]> {
    let query: Query = this.collection(companyId);

    const requestedStatus = opts?.status ?? (!opts?.includeInactive ? 'ACTIVE' : undefined);
    if (opts?.status) {
      query = query.where('status', '==', opts.status);
    }

    const snap = await query.get();
    const all = snap.docs.map((doc) => VendorGroupMapper.toDomain(doc.data()));
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
    await this.collection(companyId).doc(id).delete();
  }
}
