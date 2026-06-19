import { Firestore, Transaction } from 'firebase-admin/firestore';
import { PartyItemPrice } from '../../../../domain/shared/entities/PartyItemPrice';
import {
  IPartyItemPriceRepository,
  PartyItemPriceUpsertInput,
} from '../../../../repository/interfaces/shared/IPartyItemPriceRepository';

const buildCcyUomKey = (currency: string, uomId: string): string =>
  `${currency.trim().toUpperCase()}__${uomId.trim()}`;

const stripUndefinedDeep = (value: any): any => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (Array.isArray(value)) {
    return value
      .map((item) => stripUndefinedDeep(item))
      .filter((item) => item !== undefined);
  }
  if (value instanceof Date) return value;
  if (typeof value !== 'object') return value;

  const output: Record<string, any> = {};
  Object.entries(value).forEach(([key, entry]) => {
    const normalized = stripUndefinedDeep(entry);
    if (normalized !== undefined) output[key] = normalized;
  });
  return output;
};

export class FirestorePartyItemPriceRepository implements IPartyItemPriceRepository {
  constructor(private readonly db: Firestore) {}

  private collection(companyId: string) {
    return this.db.collection('companies').doc(companyId).collection('party_item_prices');
  }

  private asTransaction(transaction?: unknown): Transaction | undefined {
    return transaction ? transaction as Transaction : undefined;
  }

  async get(companyId: string, partyId: string, itemId: string): Promise<PartyItemPrice | null> {
    const doc = await this.collection(companyId).doc(PartyItemPrice.compositeId(partyId, itemId)).get();
    if (!doc.exists) return null;
    return PartyItemPrice.fromJSON(doc.data());
  }

  async getMany(companyId: string, partyId: string, itemIds: string[]): Promise<PartyItemPrice[]> {
    if (itemIds.length === 0) return [];
    const chunks: string[][] = [];
    for (let i = 0; i < itemIds.length; i += 10) {
      chunks.push(itemIds.slice(i, i + 10));
    }

    const records: PartyItemPrice[] = [];
    for (const chunk of chunks) {
      const refs = chunk.map((itemId) =>
        this.collection(companyId).doc(PartyItemPrice.compositeId(partyId, itemId))
      );
      const docs = await this.db.getAll(...refs);
      for (const doc of docs) {
        if (doc.exists) {
          records.push(PartyItemPrice.fromJSON(doc.data()));
        }
      }
    }
    return records;
  }

  async upsertLastPrice(input: PartyItemPriceUpsertInput, transaction?: unknown): Promise<void> {
    if (!input.pricePoint.uomId?.trim()) {
      throw new Error('Party item price point uomId is required');
    }
    const key = buildCcyUomKey(input.pricePoint.currency, input.pricePoint.uomId);
    const now = new Date();
    const field = input.direction === 'SALE' ? 'lastSaleByCcyUom' : 'lastPurchaseByCcyUom';
    const ref = this.collection(input.companyId).doc(PartyItemPrice.compositeId(input.partyId, input.itemId));
    const data = stripUndefinedDeep({
      companyId: input.companyId,
      partyId: input.partyId,
      itemId: input.itemId,
      [field]: {
        [key]: input.pricePoint,
      },
      updatedAt: now,
      createdAt: now,
    });

    const txn = this.asTransaction(transaction);
    if (txn) {
      txn.set(ref, data, { merge: true });
      return;
    }
    await ref.set(data, { merge: true });
  }
}
