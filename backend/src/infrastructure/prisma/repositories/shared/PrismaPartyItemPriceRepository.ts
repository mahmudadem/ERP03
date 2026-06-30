import { PrismaClient } from '@prisma/client';
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

export class PrismaPartyItemPriceRepository implements IPartyItemPriceRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private client(transaction?: unknown): any {
    return transaction || this.prisma;
  }

  private where(companyId: string, partyId: string, itemId: string) {
    return {
      companyId_partyId_itemId: {
        companyId,
        partyId,
        itemId,
      },
    };
  }

  async get(companyId: string, partyId: string, itemId: string): Promise<PartyItemPrice | null> {
    const record = await (this.prisma).partyItemPrice.findUnique({
      where: this.where(companyId, partyId, itemId),
    });
    return record ? this.toDomain(record) : null;
  }

  async getMany(companyId: string, partyId: string, itemIds: string[]): Promise<PartyItemPrice[]> {
    if (itemIds.length === 0) return [];
    const records = await (this.prisma).partyItemPrice.findMany({
      where: {
        companyId,
        partyId,
        itemId: { in: itemIds },
      },
    });
    return records.map((record: any) => this.toDomain(record));
  }

  async upsertLastPrice(input: PartyItemPriceUpsertInput, transaction?: unknown): Promise<void> {
    if (!input.pricePoint.uomId?.trim()) {
      throw new Error('Party item price point uomId is required');
    }
    const client = this.client(transaction);
    const record = await client.partyItemPrice.findUnique({
      where: this.where(input.companyId, input.partyId, input.itemId),
    });
    const key = buildCcyUomKey(input.pricePoint.currency, input.pricePoint.uomId);
    const saleMap = { ...((record?.lastSaleByCcyUom as Record<string, unknown> | null) || {}) };
    const purchaseMap = { ...((record?.lastPurchaseByCcyUom as Record<string, unknown> | null) || {}) };
    if (input.direction === 'SALE') {
      saleMap[key] = stripUndefinedDeep(input.pricePoint);
    } else {
      purchaseMap[key] = stripUndefinedDeep(input.pricePoint);
    }

    if (record) {
      await client.partyItemPrice.update({
        where: this.where(input.companyId, input.partyId, input.itemId),
        data: {
          lastSaleByCcyUom: saleMap,
          lastPurchaseByCcyUom: purchaseMap,
        },
      });
      return;
    }

    await client.partyItemPrice.create({
      data: {
        companyId: input.companyId,
        partyId: input.partyId,
        itemId: input.itemId,
        lastSaleByCcyUom: saleMap,
        lastPurchaseByCcyUom: purchaseMap,
      },
    });
  }

  private toDomain(record: any): PartyItemPrice {
    return PartyItemPrice.fromJSON({
      companyId: record.companyId,
      partyId: record.partyId,
      itemId: record.itemId,
      lastSaleByCcyUom: record.lastSaleByCcyUom,
      lastPurchaseByCcyUom: record.lastPurchaseByCcyUom,
      contractSale: record.contractSale,
      contractPurchase: record.contractPurchase,
      extra: record.extra,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }
}
