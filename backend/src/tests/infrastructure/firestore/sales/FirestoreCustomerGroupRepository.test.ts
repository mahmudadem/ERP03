import { FirestoreCustomerGroupRepository } from '../../../../infrastructure/firestore/repositories/sales/FirestoreCustomerGroupRepository';
import type { OrderByDirection, WhereFilterOp } from 'firebase-admin/firestore';

const COMPANY_ID = 'cmp-customer-group-firestore';

const customerGroupRow = (overrides: Record<string, any>) => ({
  id: overrides.id,
  companyId: COMPANY_ID,
  name: overrides.name,
  description: null,
  defaultPriceListId: null,
  defaultPaymentTermsDays: null,
  defaultCreditLimit: null,
  taxExempt: false,
  status: overrides.status,
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

describe('FirestoreCustomerGroupRepository', () => {
  it('lists customer groups without requiring a composite index for status/name', async () => {
    const { db, calls } = makeDb([
      customerGroupRow({ id: 'cg-2', name: 'Beta Group', status: 'ACTIVE' }),
      customerGroupRow({ id: 'cg-1', name: 'Alpha Group', status: 'ACTIVE' }),
      customerGroupRow({ id: 'cg-3', name: 'Dormant Group', status: 'INACTIVE' }),
    ]);
    const repo = new FirestoreCustomerGroupRepository(db as any);

    const result = await repo.list(COMPANY_ID, { includeInactive: false, limit: 2 });

    expect(calls.where).toEqual([]);
    expect(calls.orderBy).toEqual([]);
    expect(calls.limit).toEqual([]);
    expect(calls.offset).toEqual([]);
    expect(result.map((group) => group.name)).toEqual(['Alpha Group', 'Beta Group']);
  });
});
