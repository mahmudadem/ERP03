/**
 * sql-smoke-275c.ts — Runtime smoke test of the SQL/Prisma repository path [275c]
 *
 * Proves the Prisma repositories actually execute against a real PostgreSQL DB
 * (the risk flagged by 275d: the mappings had only ever been type-checked, never run).
 *
 * Exercises a representative spread:
 *   1. Core round-trip      — PrismaCompanyRepository.save + findById
 *   2. 275d-new + FK        — PrismaSalespersonRepository.create + getById (companyId FK)
 *   3. Offline-sync infra   — PrismaIdempotencyKeyRepository.put + get + replay no-op
 *
 * Self-cleaning: removes its own rows on exit. Safe to re-run.
 *
 * Usage:
 *   DATABASE_URL=postgresql://... npx ts-node --transpile-only scripts/sql-smoke-275c.ts
 */

import { PrismaClient } from '@prisma/client';
import { PrismaCompanyRepository } from '../src/infrastructure/prisma/repositories/PrismaCompanyRepository';
import { PrismaSalespersonRepository } from '../src/infrastructure/prisma/repositories/sales/PrismaSalespersonRepository';
import { PrismaIdempotencyKeyRepository } from '../src/infrastructure/prisma/repositories/system/PrismaIdempotencyKeyRepository';

function check(label: string, ok: boolean): void {
  if (!ok) throw new Error(`SMOKE FAIL: ${label}`);
  console.log(`  ✓ ${label}`);
}

async function main(): Promise<void> {
  const prisma = new PrismaClient({ log: ['error'] });
  const companyRepo = new PrismaCompanyRepository(prisma);
  const salespersonRepo = new PrismaSalespersonRepository(prisma);
  const idempotencyRepo = new PrismaIdempotencyKeyRepository(prisma);

  const cid = `SMOKE_275C_${Date.now()}`;
  const now = new Date();

  console.log('====================================================');
  console.log('  ERP03 — SQL Repository Smoke Test [275c]');
  console.log(`  DATABASE_URL: ${process.env.DATABASE_URL ? '[set]' : '[NOT SET]'}`);
  console.log(`  Test company: ${cid}`);
  console.log('====================================================\n');

  try {
    // 1. Core: Company round-trip
    console.log('1. Core — Company save + findById');
    await companyRepo.save({
      id: cid,
      name: 'Smoke Co',
      ownerId: 'smoke-owner',
      taxId: `TAX_${cid}`,
      baseCurrency: 'USD',
      fiscalYearStart: now,
      fiscalYearEnd: now,
      modules: [],
      features: [],
      createdAt: now,
      updatedAt: now,
    } as any);
    const gotCo = await companyRepo.findById(cid);
    check('company persisted and read back', !!gotCo && gotCo.name === 'Smoke Co');
    check('company taxId mapped', !!gotCo && gotCo.taxId === `TAX_${cid}`);

    // 2. 275d-new repo + FK relationship to Company
    console.log('\n2. 275d-new — Salesperson create + getById (FK -> company)');
    const spId = `sp_${cid}`;
    await salespersonRepo.create({
      id: spId,
      companyId: cid,
      code: 'SP01',
      name: 'Sam Seller',
      email: undefined,
      defaultCommissionPct: 5,
      commissionPayableAccountId: undefined,
      status: 'ACTIVE',
      createdBy: 'smoke',
      createdAt: now,
      updatedAt: now,
    } as any);
    const gotSp = await salespersonRepo.getById(cid, spId);
    check('salesperson persisted (FK to company satisfied)', !!gotSp && gotSp.code === 'SP01');
    check('salesperson scoped read by companyId', !!gotSp && gotSp.companyId === cid);

    // 3. Offline-sync infra: IdempotencyKey store
    console.log('\n3. Offline-sync infra — IdempotencyKey put + get + replay');
    const key = `idem_${cid}`;
    const expiresAt = new Date(Date.now() + 3_600_000);
    const record = {
      key,
      companyId: cid,
      method: 'POST',
      path: '/smoke',
      bodyHash: 'hash123',
      statusCode: 200,
      responseBody: { ok: true },
      createdAt: now,
      expiresAt,
    };
    await idempotencyRepo.put(record as any);
    const gotIdem = await idempotencyRepo.get(cid, key);
    check('idempotency key stored and read', !!gotIdem && gotIdem.statusCode === 200);
    // Replay the same key — must be a no-op (upsert), not a duplicate-key crash
    await idempotencyRepo.put(record as any);
    check('idempotency replay is a no-op (no duplicate crash)', true);

    console.log('\n====================================================');
    console.log('  ALL SMOKE CHECKS PASSED — SQL path runs on Postgres');
    console.log('====================================================');
  } finally {
    // Self-clean
    try {
      await (prisma as any).idempotencyKey.deleteMany({ where: { companyId: cid } });
      await (prisma as any).salesperson.deleteMany({ where: { companyId: cid } });
      await prisma.company.deleteMany({ where: { id: cid } });
    } catch (e: any) {
      console.warn('Cleanup warning:', e.message);
    }
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('\nSMOKE TEST FAILED:', err.message);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
