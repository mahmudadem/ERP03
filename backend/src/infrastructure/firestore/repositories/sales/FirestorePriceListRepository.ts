import { Firestore, Query, Transaction } from 'firebase-admin/firestore';
import { PriceList, PriceListLine } from '../../../../domain/sales/entities/PriceList';
import {
  IPriceListRepository,
  PriceListListOptions,
} from '../../../../repository/interfaces/sales/IPriceListRepository';
import { getSalesCollection } from './SalesFirestorePaths';

// ---------------------------------------------------------------------------
// Inline mapper (kept private to avoid touching the shared SalesMappers.ts)
// ---------------------------------------------------------------------------

interface PriceListDoc {
  id: string;
  companyId: string;
  name: string;
  currency: string;
  status: 'ACTIVE' | 'INACTIVE';
  validFrom: string | null;
  validTo: string | null;
  isDefault: boolean;
  lines: PriceListLine[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

class PriceListMapper {
  static toPersistence(list: PriceList): PriceListDoc {
    return {
      id: list.id,
      companyId: list.companyId,
      name: list.name,
      currency: list.currency,
      status: list.status,
      validFrom: list.validFrom ? list.validFrom.toISOString() : null,
      validTo: list.validTo ? list.validTo.toISOString() : null,
      isDefault: list.isDefault,
      lines: list.lines,
      createdBy: list.createdBy,
      createdAt: list.createdAt.toISOString(),
      updatedAt: list.updatedAt.toISOString(),
    };
  }

  static toDomain(data: any): PriceList {
    return new PriceList({
      id: data.id,
      companyId: data.companyId,
      name: data.name,
      currency: data.currency,
      status: data.status as 'ACTIVE' | 'INACTIVE',
      validFrom: data.validFrom ? new Date(data.validFrom) : undefined,
      validTo: data.validTo ? new Date(data.validTo) : undefined,
      isDefault: Boolean(data.isDefault),
      lines: (data.lines ?? []) as PriceListLine[],
      createdBy: data.createdBy,
      createdAt: data.createdAt ? new Date(data.createdAt) : undefined,
      updatedAt: data.updatedAt ? new Date(data.updatedAt) : undefined,
    });
  }
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export class FirestorePriceListRepository implements IPriceListRepository {
  constructor(private readonly db: Firestore) {}

  private collection(companyId: string) {
    return getSalesCollection(this.db, companyId, 'price_lists');
  }

  private asTransaction(transaction?: unknown): Transaction | undefined {
    if (!transaction) return undefined;
    return transaction as Transaction;
  }

  async create(list: PriceList, transaction?: unknown): Promise<void> {
    const ref = this.collection(list.companyId).doc(list.id);
    const data = PriceListMapper.toPersistence(list);
    const txn = this.asTransaction(transaction);
    if (txn) {
      txn.set(ref, data);
      return;
    }
    await ref.set(data);
  }

  async update(list: PriceList, transaction?: unknown): Promise<void> {
    const ref = this.collection(list.companyId).doc(list.id);
    const data = PriceListMapper.toPersistence(list);
    const txn = this.asTransaction(transaction);
    if (txn) {
      txn.set(ref, data, { merge: true });
      return;
    }
    await ref.set(data, { merge: true });
  }

  async getById(companyId: string, id: string): Promise<PriceList | null> {
    const doc = await this.collection(companyId).doc(id).get();
    if (!doc.exists) return null;
    return PriceListMapper.toDomain(doc.data());
  }

  async getByName(companyId: string, name: string): Promise<PriceList | null> {
    const snap = await this.collection(companyId)
      .where('name', '==', name)
      .limit(1)
      .get();
    if (snap.empty) return null;
    return PriceListMapper.toDomain(snap.docs[0].data());
  }

  async list(companyId: string, opts?: PriceListListOptions): Promise<PriceList[]> {
    let query: Query = this.collection(companyId);

    if (opts?.currency) {
      query = query.where('currency', '==', opts.currency);
    }
    const requestedStatus = opts?.status ?? (!opts?.includeInactive ? 'ACTIVE' : undefined);
    if (opts?.status) {
      query = query.where('status', '==', opts.status);
    }

    const snap = await query.get();
    const all = snap.docs.map((doc) => PriceListMapper.toDomain(doc.data()));
    const filtered = requestedStatus
      ? all.filter((list) => list.status === requestedStatus)
      : all;

    filtered.sort((a, b) => a.name.localeCompare(b.name));

    const offset = Math.max(0, opts?.offset ?? 0);
    const limit = opts?.limit;

    if (typeof limit === 'number') {
      return filtered.slice(offset, offset + limit);
    }
    return filtered.slice(offset);
  }

  async getDefaultForCurrency(companyId: string, currency: string): Promise<PriceList | null> {
    const snap = await this.collection(companyId)
      .where('currency', '==', currency)
      .where('isDefault', '==', true)
      .limit(1)
      .get();
    if (snap.empty) return null;
    return PriceListMapper.toDomain(snap.docs[0].data());
  }

  async delete(companyId: string, id: string): Promise<void> {
    const ref = this.collection(companyId).doc(id);
    await ref.delete();
  }
}
