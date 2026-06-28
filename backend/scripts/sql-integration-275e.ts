/**
 * sql-integration-275e.ts — Real-Postgres integration tests for the SQL path [275e]
 *
 * Unlike the unit suite (which mocks Firestore) and the 275c smoke test (which
 * only round-trips single repos), this drives REAL service-level flows through
 * the sanctioned posting path against a live PostgreSQL database, and asserts
 * real accounting outcomes (ledger ties, trial balance balances) — not just
 * "no throw".
 *
 * Flows covered (one meaningful flow per critical module; extend over time):
 *   A. Accounting — post a balanced Journal Entry through the PostingGateway
 *      (the single mandatory ledger choke point) -> PrismaLedgerRepository,
 *      then read it back: ledger rows tie, trial balance balances to zero.
 *
 * Self-cleaning per run (isolated/repeatable). Safe to run twice.
 *
 * Usage:
 *   DATABASE_URL=postgresql://... npx ts-node --transpile-only scripts/sql-integration-275e.ts
 */

import { PrismaClient } from '@prisma/client';
import { PrismaAccountRepository } from '../src/infrastructure/prisma/repositories/accounting/PrismaAccountRepository';
import { PrismaLedgerRepository } from '../src/infrastructure/prisma/repositories/accounting/PrismaLedgerRepository';
import { PostingGateway } from '../src/application/accounting/services/PostingGateway';
import { VoucherValidationService } from '../src/domain/accounting/services/VoucherValidationService';
import { VoucherEntity } from '../src/domain/accounting/entities/VoucherEntity';
import { VoucherLineEntity } from '../src/domain/accounting/entities/VoucherLineEntity';
import { VoucherType, VoucherStatus } from '../src/domain/accounting/types/VoucherTypes';

let passed = 0;
function check(label: string, ok: boolean): void {
  if (!ok) throw new Error(`INTEGRATION FAIL: ${label}`);
  passed++;
  console.log(`  ✓ ${label}`);
}

async function setupCompany(prisma: PrismaClient, cid: string): Promise<void> {
  const epoch = new Date('2026-01-01T00:00:00.000Z');
  await prisma.company.create({
    data: {
      id: cid,
      name: 'Integration Co',
      ownerId: 'it-owner',
      taxId: `TAX_${cid}`,
      baseCurrency: 'USD',
      fiscalYearStart: epoch,
      fiscalYearEnd: new Date('2026-12-31T00:00:00.000Z'),
      modules: [],
      features: [],
    },
  });
}

async function flowAccounting(prisma: PrismaClient, cid: string): Promise<void> {
  console.log('\nA. Accounting — JE post -> ledger -> trial balance');

  const accountRepo = new PrismaAccountRepository(prisma);
  const ledgerRepo = new PrismaLedgerRepository(prisma, accountRepo);
  const gateway = new PostingGateway(ledgerRepo, new VoucherValidationService(), undefined, accountRepo);

  // Two POSTING accounts (the voucher lines reference these ids).
  const debitAcctId = `acc-debit-${cid}`;
  const creditAcctId = `acc-credit-${cid}`;
  await accountRepo.create(cid, {
    id: debitAcctId, userCode: '1000', name: 'Cash', classification: 'ASSET',
    balanceNature: 'DEBIT', createdBy: 'it', updatedBy: 'it',
  });
  await accountRepo.create(cid, {
    id: creditAcctId, userCode: '4000', name: 'Sales Revenue', classification: 'REVENUE',
    balanceNature: 'CREDIT', createdBy: 'it', updatedBy: 'it',
  });
  check('two POSTING accounts created', true);

  // Balanced Journal Entry: Dr Cash 100 / Cr Revenue 100.
  const amount = 100;
  const lines = [
    new VoucherLineEntity(1, debitAcctId, 'Debit', amount, 'USD', amount, 'USD', 1, 'Cash in'),
    new VoucherLineEntity(2, creditAcctId, 'Credit', amount, 'USD', amount, 'USD', 1, 'Revenue'),
  ];
  const voucher = new VoucherEntity(
    `v-${cid}`, cid, 'JE-0001', VoucherType.JOURNAL_ENTRY, '2026-03-15',
    'Integration JE', 'USD', 'USD', 1, lines, amount, amount,
    VoucherStatus.APPROVED, {}, 'it-user', new Date(),
  );

  // Post through the sanctioned choke point.
  await gateway.record(voucher, { userId: 'it-user', approved: true });
  check('voucher posted through PostingGateway (no throw)', true);

  // Read back the ledger rows for each account.
  const debitLedger = await ledgerRepo.getAccountLedger(cid, debitAcctId, '2026-01-01', '2026-12-31');
  const creditLedger = await ledgerRepo.getAccountLedger(cid, creditAcctId, '2026-01-01', '2026-12-31');
  check('cash account has 1 ledger row, debit 100', debitLedger.length === 1 && debitLedger[0].debit === 100 && debitLedger[0].credit === 0);
  check('revenue account has 1 ledger row, credit 100', creditLedger.length === 1 && creditLedger[0].credit === 100 && creditLedger[0].debit === 0);

  // Trial balance must balance: total debits == total credits, net == 0.
  const tb = await ledgerRepo.getTrialBalance(cid, '2026-12-31');
  const totalDebit = tb.reduce((s, r) => s + r.debit, 0);
  const totalCredit = tb.reduce((s, r) => s + r.credit, 0);
  const net = tb.reduce((s, r) => s + r.balance, 0);
  check(`trial balance ties: debit ${totalDebit} == credit ${totalCredit}`, totalDebit === 100 && totalCredit === 100);
  check('trial balance nets to zero', Math.abs(net) < 1e-9);

  // Idempotency-ish: re-posting via replaceForVoucher must not double the ledger.
  await gateway.replaceForVoucher(voucher, { userId: 'it-user', approved: true });
  const afterReplace = await ledgerRepo.getAccountLedger(cid, debitAcctId, '2026-01-01', '2026-12-31');
  check('replaceForVoucher does not duplicate ledger rows', afterReplace.length === 1);
}

async function cleanup(prisma: PrismaClient, cid: string): Promise<void> {
  // Cascade from company removes accounts + ledger entries.
  try {
    await prisma.ledgerEntry.deleteMany({ where: { companyId: cid } });
    await prisma.account.deleteMany({ where: { companyId: cid } });
    await prisma.company.deleteMany({ where: { id: cid } });
  } catch (e: any) {
    console.warn('Cleanup warning:', e.message);
  }
}

async function main(): Promise<void> {
  const prisma = new PrismaClient({ log: ['error'] });
  const cid = `IT_275E_${Date.now()}`;

  console.log('====================================================');
  console.log('  ERP03 — SQL Integration Tests [275e]');
  console.log(`  DATABASE_URL: ${process.env.DATABASE_URL ? '[set]' : '[NOT SET]'}`);
  console.log(`  Test company: ${cid}`);
  console.log('====================================================');

  try {
    await setupCompany(prisma, cid);
    await flowAccounting(prisma, cid);

    console.log('\n====================================================');
    console.log(`  ALL ${passed} INTEGRATION CHECKS PASSED on real Postgres`);
    console.log('====================================================');
  } finally {
    await cleanup(prisma, cid);
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('\nINTEGRATION TEST FAILED:', err.message);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
