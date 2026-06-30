import { FirestoreItemRepository } from '../../../../infrastructure/firestore/repositories/inventory/FirestoreItemRepository';
import type { OrderByDirection, WhereFilterOp } from 'firebase-admin/firestore';

const COMPANY_ID = 'cmp-item-firestore';

const itemRow = (overrides: Record<string, any>) => ({
  id: overrides.id,
  companyId: COMPANY_ID,
  code: overrides.code,
  name: overrides.name ?? overrides.code,
  type: overrides.type ?? 'PRODUCT',
  categoryId: overrides.categoryId ?? null,
  active: overrides.active ?? true,
  trackInventory: overrides.trackInventory ?? true,
  costCurrency: 'USD',
  costingMethod: 'MOVING_AVG',
  barcode: null,
  barcodes: [],
  uomBarcodes: [],
  uomBarcodeValues: [],
  salesUom: 'EA',
  baseUom: 'EA',
  purchaseUom: 'EA',
  status: 'ACTIVE',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
});

const makeDb = (rows: any[]) => {
  const calls: {
    where: Array<[string, WhereFilterOp, any]>;
    orderBy: Array<[string, OrderByDirection | undefined]>;
    limit: number[];
    offset: number[];
  } = { where: [], orderBy: [], limit: [], offset: [] };

  let currentRows = [...rows];

  const query = {
    where: jest.fn((field: string, op: WhereFilterOp, value: any) => {
      calls.where.push([field, op, value]);
      if (field === 'type' && op === '==') {
        currentRows = currentRows.filter((row) => row.type === value);
      }
      if (field === 'categoryId' && op === '==') {
        currentRows = currentRows.filter((row) => row.categoryId === value);
      }
      if (field === 'active' && op === '==') {
        currentRows = currentRows.filter((row) => row.active === value);
      }
      if (field === 'trackInventory' && op === '==') {
        currentRows = currentRows.filter((row) => row.trackInventory === value);
      }
      return query;
    }),
    orderBy: jest.fn((field: string, direction?: OrderByDirection) => {
      calls.orderBy.push([field, direction]);
      return query;
    }),
    limit: jest.fn((limit: number) => {
      calls.limit.push(limit);
      currentRows = currentRows.slice(0, limit);
      return query;
    }),
    offset: jest.fn((offset: number) => {
      calls.offset.push(offset);
      currentRows = currentRows.slice(offset);
      return query;
    }),
    get: jest.fn(async () => ({
      docs: currentRows.map((row) => ({ data: () => row })),
    })),
  };

  const db = {
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        collection: jest.fn(() => ({
          doc: jest.fn(() => ({
            collection: jest.fn(() => query),
          })),
        })),
      })),
    })),
  };

  return { db, calls };
};

describe('FirestoreItemRepository', () => {
  it('lists active items without requiring an active/code composite index', async () => {
    const { db, calls } = makeDb([
      itemRow({ id: 'item-2', code: 'B002', active: true }),
      itemRow({ id: 'item-1', code: 'A001', active: true }),
      itemRow({ id: 'item-3', code: 'A000', active: false }),
    ]);
    const repo = new FirestoreItemRepository(db as any);

    const result = await repo.getCompanyItems(COMPANY_ID, { active: true, limit: 2 });

    expect(calls.where).toEqual([['active', '==', true]]);
    expect(calls.orderBy).toEqual([]);
    expect(calls.limit).toEqual([]);
    expect(calls.offset).toEqual([]);
    expect(result.map((item) => item.code)).toEqual(['A001', 'B002']);
  });
});
