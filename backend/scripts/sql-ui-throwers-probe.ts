/**
 * sql-ui-throwers-probe.ts — reproduce the exact repo operations that threw
 * PrismaClientValidationError from the UI, against real Postgres.
 *
 * These are the Category-A runtime throwers from Epic-275 remediation. A green
 * tsc proved the casts were gone; this proves the *queries* actually execute.
 *
 * Usage:
 *   DB_TYPE=SQL DATABASE_URL=postgresql://... npx ts-node --transpile-only scripts/sql-ui-throwers-probe.ts
 */

import { PrismaClient } from '@prisma/client';
import { PrismaAccountRepository } from '../src/infrastructure/prisma/repositories/accounting/PrismaAccountRepository';
import { PrismaUomConversionRepository } from '../src/infrastructure/prisma/repositories/inventory/PrismaUomConversionRepository';
import { PrismaInventoryPeriodSnapshotRepository } from '../src/infrastructure/prisma/repositories/inventory/PrismaInventoryPeriodSnapshotRepository';

const prisma = new PrismaClient();
let pass = 0;
let fail = 0;
const results: string[] = [];

async function check(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    pass++;
    results.push(`  ✅ ${name}`);
  } catch (err: any) {
    fail++;
    results.push(`  ❌ ${name}\n      ${err?.constructor?.name}: ${String(err?.message).split('\n').slice(0, 4).join(' ')}`);
  }
}

async function main() {
  const company = await prisma.company.findFirst({ where: { name: 'zxc' } });
  if (!company) throw new Error('no seed company');
  const companyId = company.id;
  const account = await prisma.account.findFirst({ where: { companyId } });
  if (!account) throw new Error('no account in company');
  const user = await prisma.user.findFirst();
  const userId = user?.id ?? 'SYSTEM';

  console.log(`Probing SQL runtime throwers against company=${companyId}\n`);

  const accountRepo = new PrismaAccountRepository(prisma);
  const uomRepo = new PrismaUomConversionRepository(prisma);
  const snapRepo = new PrismaInventoryPeriodSnapshotRepository(prisma);

  // 1. Account rename → account.update  (was: unknown-field validation)
  await check('account.update (rename)', async () => {
    await accountRepo.update(companyId, account.id, { name: account.name, updatedBy: userId });
  });

  // 2. Account audit event → auditLog.create (was: missing userId / meta shape)
  await check('auditLog.create (recordAuditEvent)', async () => {
    await accountRepo.recordAuditEvent(companyId, account.id, {
      type: 'NAME_CHANGED',
      field: 'name',
      oldValue: 'old',
      newValue: 'new',
      changedBy: userId,
      changedAt: new Date(),
    });
  });

  // 3. UOM conversions list (was: uomConversion.findMany unknown `itemId`)
  await check('uomConversion.getCompanyConversions (findMany)', async () => {
    await uomRepo.getCompanyConversions(companyId);
  });
  await check('uomConversion.getConversionsForItem (findMany itemId)', async () => {
    await uomRepo.getConversionsForItem(companyId, 'itm_probe_nonexistent');
  });

  // 4. UOM create + update (was: Unchecked patch shape)
  const uoms = await prisma.uom.findMany({ where: { companyId }, take: 2 });
  let convId = '';
  await check('uomConversion.createConversion', async () => {
    if (uoms.length < 2) throw new Error('need 2 uoms in company');
    convId = `uom_probe_${Date.now()}`;
    await uomRepo.createConversion({
      id: convId,
      companyId,
      fromUomId: uoms[0].id,
      toUomId: uoms[1].id,
      factor: 12,
      active: true,
    } as any);
  });
  await check('uomConversion.updateConversion', async () => {
    await uomRepo.updateConversion(convId, { factor: 24, active: false });
  });

  // 5. Inventory period snapshot create (was: multi-row shape vs one-row schema)
  const snapPeriod = `PROBE-${Date.now()}`;
  await check('inventoryPeriodSnapshot.saveSnapshot', async () => {
    await snapRepo.saveSnapshot({
      id: `snap_probe_${Date.now()}`,
      companyId,
      periodKey: snapPeriod,
      periodEndDate: new Date().toISOString(),
      createdAt: new Date(),
      snapshotData: [{ itemId: 'x', warehouseId: 'w', qtyOnHand: 1, avgCostBase: 10, avgCostCCY: 10, lastCostBase: 10, lastCostCCY: 10, valueBase: 10 }],
      totalValueBase: 10,
      totalItems: 1,
    } as any);
  });

  // cleanup probe rows
  await prisma.uomConversion.deleteMany({ where: { id: convId } }).catch(() => {});
  await prisma.inventoryPeriodSnapshot.deleteMany({ where: { period: { startsWith: 'PROBE-' } } }).catch(() => {});

  console.log(results.join('\n'));
  console.log(`\n${pass} passed, ${fail} failed`);
  await prisma.$disconnect();
  if (fail > 0) process.exit(1);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
