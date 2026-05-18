import { FirestoreLedgerRepository } from '../../../infrastructure/firestore/repositories/accounting/FirestoreLedgerRepository';
import { PrismaLedgerRepository } from '../../../infrastructure/prisma/repositories/accounting/PrismaLedgerRepository';
import { VoucherEntity } from '../../../domain/accounting/entities/VoucherEntity';
import { VoucherLineEntity } from '../../../domain/accounting/entities/VoucherLineEntity';
import { VoucherStatus, VoucherType } from '../../../domain/accounting/types/VoucherTypes';

const makeVoucher = (debitAccountId = 'HEADER-1') =>
  new VoucherEntity(
    'vch-1',
    'cmp-1',
    'RV-1',
    VoucherType.RECEIPT,
    '2026-05-18',
    'Receipt',
    'USD',
    'USD',
    1,
    [
      new VoucherLineEntity(1, debitAccountId, 'Debit', 100, 'USD', 100, 'USD', 1),
      new VoucherLineEntity(2, 'AR-1', 'Credit', 100, 'USD', 100, 'USD', 1),
    ],
    100,
    100,
    VoucherStatus.APPROVED,
    {},
    'u-1',
    new Date('2026-05-18T00:00:00.000Z')
  );

const headerAccount = {
  id: 'HEADER-1',
  userCode: '1000',
  code: '1000',
  name: 'Cash Header',
  accountRole: 'HEADER',
  status: 'ACTIVE',
};

const postingAccount = {
  id: 'AR-1',
  userCode: '1100',
  code: '1100',
  name: 'Accounts Receivable',
  accountRole: 'POSTING',
  status: 'ACTIVE',
};

const replacedAccount = {
  id: 'REPLACED-1',
  userCode: '1200',
  code: '1200',
  name: 'Old Cash Account',
  accountRole: 'POSTING',
  status: 'ACTIVE',
  replacedByAccountId: 'CASH-NEW',
};

const postingParentAccount = {
  id: 'PARENT-POSTING-1',
  userCode: '1300',
  code: '1300',
  name: 'Misconfigured Parent',
  accountRole: 'POSTING',
  status: 'ACTIVE',
  hasChildren: true,
};

const makeAccountRepo = () => ({
  getById: jest.fn(async (_companyId: string, accountId: string) => {
    if (accountId === 'HEADER-1') return headerAccount;
    if (accountId === 'AR-1') return postingAccount;
    if (accountId === 'REPLACED-1') return replacedAccount;
    if (accountId === 'PARENT-POSTING-1') return postingParentAccount;
    return null;
  }),
});

describe('ledger repository posting guard', () => {
  it('Firestore ledger repository blocks non-posting accounts before persistence', async () => {
    const db = { batch: jest.fn() };
    const repo = new FirestoreLedgerRepository(db as any, makeAccountRepo() as any);

    await expect(repo.recordForVoucher(makeVoucher())).rejects.toThrow(/non-POSTING/);

    expect(db.batch).not.toHaveBeenCalled();
  });

  it('Prisma ledger repository blocks non-posting accounts before persistence', async () => {
    const prisma = { ledgerEntry: { createMany: jest.fn() } };
    const repo = new PrismaLedgerRepository(prisma as any, makeAccountRepo() as any);

    await expect(repo.recordForVoucher(makeVoucher())).rejects.toThrow(/non-POSTING/);

    expect(prisma.ledgerEntry.createMany).not.toHaveBeenCalled();
  });

  it('blocks replaced accounts through the accounting validation service', async () => {
    const db = { batch: jest.fn() };
    const repo = new FirestoreLedgerRepository(db as any, makeAccountRepo() as any);

    await expect(repo.recordForVoucher(makeVoucher('REPLACED-1'))).rejects.toThrow(/has been replaced/);

    expect(db.batch).not.toHaveBeenCalled();
  });

  it('blocks parent accounts with children even when marked POSTING', async () => {
    const prisma = { ledgerEntry: { createMany: jest.fn() } };
    const repo = new PrismaLedgerRepository(prisma as any, makeAccountRepo() as any);

    await expect(repo.recordForVoucher(makeVoucher('PARENT-POSTING-1'))).rejects.toThrow(/parent accounts is forbidden/);

    expect(prisma.ledgerEntry.createMany).not.toHaveBeenCalled();
  });
});
