import { FirestorePartyRepository } from '../../../../infrastructure/firestore/repositories/shared/FirestorePartyRepository';
import type { OrderByDirection, WhereFilterOp } from 'firebase-admin/firestore';

const COMPANY_ID = 'cmp-party-firestore';

const partyRow = (overrides: Record<string, any>) => ({
  id: overrides.id,
  companyId: COMPANY_ID,
  code: overrides.code,
  legalName: overrides.legalName ?? overrides.displayName,
  displayName: overrides.displayName,
  roles: overrides.roles,
  active: overrides.active,
  createdBy: 'tester',
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
      if (field === 'roles' && op === 'array-contains') {
        currentRows = currentRows.filter((row) => Array.isArray(row.roles) && row.roles.includes(value));
      }
      if (field === 'active' && op === '==') {
        currentRows = currentRows.filter((row) => row.active === value);
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

describe('FirestorePartyRepository', () => {
  it('lists parties without requiring a role/active/displayName composite index', async () => {
    const { db, calls } = makeDb([
      partyRow({ id: 'ven-2', code: 'V002', displayName: 'Beta Vendor', roles: ['VENDOR'], active: true }),
      partyRow({ id: 'ven-1', code: 'V001', displayName: 'Alpha Vendor', roles: ['VENDOR'], active: true }),
      partyRow({ id: 'ven-3', code: 'V003', displayName: 'Aardvark Vendor', roles: ['VENDOR'], active: false }),
      partyRow({ id: 'cus-1', code: 'C001', displayName: 'Customer One', roles: ['CUSTOMER'], active: true }),
    ]);
    const repo = new FirestorePartyRepository(db as any);

    const result = await repo.list(COMPANY_ID, { role: 'VENDOR', active: true, limit: 2 });

    expect(calls.where).toEqual([['roles', 'array-contains', 'VENDOR']]);
    expect(calls.orderBy).toEqual([]);
    expect(calls.limit).toEqual([]);
    expect(calls.offset).toEqual([]);
    expect(result.map((party) => party.code)).toEqual(['V001', 'V002']);
  });

  it('lists active parties without server-side ordering for active-only queries', async () => {
    const { db, calls } = makeDb([
      partyRow({ id: 'ven-2', code: 'V002', displayName: 'Beta Vendor', roles: ['VENDOR'], active: true }),
      partyRow({ id: 'ven-1', code: 'V001', displayName: 'Alpha Vendor', roles: ['VENDOR'], active: true }),
      partyRow({ id: 'ven-3', code: 'V003', displayName: 'Dormant Vendor', roles: ['VENDOR'], active: false }),
    ]);
    const repo = new FirestorePartyRepository(db as any);

    const result = await repo.list(COMPANY_ID, { active: true });

    expect(calls.where).toEqual([['active', '==', true]]);
    expect(calls.orderBy).toEqual([]);
    expect(calls.limit).toEqual([]);
    expect(calls.offset).toEqual([]);
    expect(result.map((party) => party.code)).toEqual(['V001', 'V002']);
  });
});
