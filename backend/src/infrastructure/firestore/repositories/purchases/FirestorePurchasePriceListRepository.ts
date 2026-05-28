import { Firestore, Query, Transaction } from 'firebase-admin/firestore';
import { PurchasePriceList, PurchasePriceListLine } from '../../../../domain/purchases/entities/PurchasePriceList';
import {
  IPurchasePriceListRepository,
  PurchasePriceListListOptions,
} from '../../../../repository/interfaces/purchases/IPurchasePriceListRepository';
import { getPurchasesCollection } from './PurchaseFirestorePaths';

interface PurchasePriceListDoc {
  id: string;
  companyId: string;
  name: string;
  currency: string;
  status: 'ACTIVE' | 'INACTIVE';
  validFrom: string | null;
  validTo: string | null;
  isDefault: boolean;
  lines: PurchasePriceListLine[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

class PurchasePriceListMapper {
  static toPersistence(list: PurchasePriceList): PurchasePriceListDoc {
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

  static toDomain(data: any): PurchasePriceList {
    return new PurchasePriceList({
      id: data.id,
      companyId: data.companyId,
      name: data.name,
      currency: data.currency,
      status: data.status as 'ACTIVE' | 'INACTIVE',
      validFrom: data.validFrom ? new Date(data.validFrom) : undefined,
      validTo: data.validTo ? new Date(data.validTo) : undefined,
      isDefault: Boolean(data.isDefault),
      lines: (data.lines ?? []) as PurchasePriceListLine[],
      createdBy: data.createdBy,
      createdAt: data.createdAt ? new Date(data.createdAt) : undefined,
      updatedAt: data.updatedAt ? new Date(data.updatedAt) : undefined,
    });
  }
}

export class FirestorePurchasePriceListRepository implements IPurchasePriceListRepository {
  constructor(private readonly db: Firestore) {}

  private collection(companyId: string) {
    return getPurchasesCollection(this.db, companyId, 'price_lists');
  }

  private asTransaction(transaction?: unknown): Transaction | undefined {
    if (!transaction) return undefined;
    return transaction as Transaction;
  }

  async create(list: PurchasePriceList, transaction?: unknown): Promise<void> {
    const ref = this.collection(list.companyId).doc(list.id);
    const data = PurchasePriceListMapper.toPersistence(list);
    const txn = this.asTransaction(transaction);
    if (txn) {
      txn.set(ref, data);
      return;
    }
    await ref.set(data);
  }

  async update(list: PurchasePriceList, transaction?: unknown): Promise<void> {
    const ref = this.collection(list.companyId).doc(list.id);
    const data = PurchasePriceListMapper.toPersistence(list);
    const txn = this.asTransaction(transaction);
    if (txn) {
      txn.set(ref, data, { merge: true });
      return;
    }
    await ref.set(data, { merge: true });
  }

  async getById(companyId: string, id: string): Promise<PurchasePriceList | null> {
    const doc = await this.collection(companyId).doc(id).get();
    if (!doc.exists) return null;
    return PurchasePriceListMapper.toDomain(doc.data());
  }

  async getByName(companyId: string, name: string): Promise<PurchasePriceList | null> {
    const snap = await this.collection(companyId)
      .where('name', '==', name)
      .limit(1)
      .get();
    if (snap.empty) return null;
    return PurchasePriceListMapper.toDomain(snap.docs[0].data());
  }

  async list(companyId: string, opts?: PurchasePriceListListOptions): Promise<PurchasePriceList[]> {
    let query: Query = this.collection(companyId);

    if (opts?.currency) {
      query = query.where('currency', '==', opts.currency);
    }
    if (opts?.status) {
      query = query.where('status', '==', opts.status);
    } else if (!opts?.includeInactive) {
      query = query.where('status', '==', 'ACTIVE');
    }

    query = query.orderBy('name', 'asc');

    if (opts?.offset) query = query.offset(opts.offset);
    if (opts?.limit) query = query.limit(opts.limit);

    const snap = await query.get();
    return snap.docs.map((doc) => PurchasePriceListMapper.toDomain(doc.data()));
  }

  async getDefaultForCurrency(companyId: string, currency: string): Promise<PurchasePriceList | null> {
    const snap = await this.collection(companyId)
      .where('currency', '==', currency)
      .where('isDefault', '==', true)
      .limit(1)
      .get();
    if (snap.empty) return null;
    return PurchasePriceListMapper.toDomain(snap.docs[0].data());
  }

  async delete(companyId: string, id: string): Promise<void> {
    const ref = this.collection(companyId).doc(id);
    await ref.delete();
  }
}
