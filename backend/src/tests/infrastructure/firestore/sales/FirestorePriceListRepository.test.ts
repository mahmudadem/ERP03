import { FirestorePriceListRepository } from '../../../../infrastructure/firestore/repositories/sales/FirestorePriceListRepository';
import type { OrderByDirection, WhereFilterOp } from 'firebase-admin/firestore';

const COMPANY_ID = 'cmp-price-list-firestore';

const priceListRow = (overrides: Record<string, any>) => ({
  id: overrides.id,
  companyId: COMPANY_ID,
  name: overrides.name,
  currency: overrides.currency,
  status: overrides.status,
  validFrom: null,
  validTo: null,
  isDefault: false,
  lines: [],
  createdBy: 'tester',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
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
      if (field === 'currency' && op === '==') {
        currentRows = currentRows.filter((row) => row.currency === value);
      }
      if (field === 'status' && op === '==') {
        currentRows = currentRows.filter((row) => row.status === value);
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

describe('FirestorePriceListRepository', () => {
  it('lists price lists without requiring a composite index for currency/status/name', async () => {
    const { db, calls } = makeDb([
      priceListRow({ id: 'pl-2', name: 'Beta', currency: 'USD', status: 'ACTIVE' }),
      priceListRow({ id: 'pl-1', name: 'Alpha', currency: 'USD', status: 'ACTIVE' }),
      priceListRow({ id: 'pl-3', name: 'Dormant', currency: 'USD', status: 'INACTIVE' }),
      priceListRow({ id: 'pl-4', name: 'Other Currency', currency: 'EUR', status: 'ACTIVE' }),
    ]);
    const repo = new FirestorePriceListRepository(db as any);

    const result = await repo.list(COMPANY_ID, { currency: 'USD', includeInactive: false, limit: 2 });

    expect(calls.where).toEqual([['currency', '==', 'USD']]);
    expect(calls.orderBy).toEqual([]);
    expect(calls.limit).toEqual([]);
    expect(calls.offset).toEqual([]);
    expect(result.map((list) => list.name)).toEqual(['Alpha', 'Beta']);
  });
});
