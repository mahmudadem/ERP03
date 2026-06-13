/**
 * validate-global-costing.ts
 *
 * Integration check for the GLOBAL costing engine against the LIVE Firestore
 * emulator. Unlike the unit tests (which use an in-memory level repo), this runs
 * the real RecordStockMovementUseCase through the real FirestoreStockLevelRepository
 * + real transaction manager, so it proves the new `getLevelsByItemInTransaction`
 * (transaction.get(query), reads-before-writes) behaves under genuine Firestore
 * transactions.
 *
 * No GL/COA needed — the costing engine is pure inventory math (the caller posts GL).
 *
 * Usage (from backend/), with the emulator running:
 *   npx ts-node --transpile-only scripts/validate-global-costing.ts
 */

process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';

import { Company } from '../src/domain/core/entities/Company';
import { Item } from '../src/domain/inventory/entities/Item';
import { Warehouse } from '../src/domain/inventory/entities/Warehouse';
import { InventorySettings } from '../src/domain/inventory/entities/InventorySettings';
import { RecordStockMovementUseCase } from '../src/application/inventory/use-cases/RecordStockMovementUseCase';

const BASE = 'USD';
const USER = 'global-costing-validator';

let passed = 0;
let failed = 0;

function check(label: string, actual: unknown, expected: unknown): void {
  const ok = actual === expected;
  if (ok) passed++;
  else failed++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}  (got ${actual}, expected ${expected})`);
}

async function main(): Promise<void> {
  const { diContainer } = await import('../src/infrastructure/di/bindRepositories');

  const companyId = `gctest-${Date.now()}`;
  const itemId = `${companyId}-item`;
  const whA = `${companyId}-A`;
  const whB = `${companyId}-B`;
  const now = new Date();

  console.log(`\nGLOBAL costing emulator check — tenant ${companyId}\n`);

  // ── Seed minimal master data ──
  await diContainer.companyRepository.save(
    new Company(companyId, 'Global Costing Test', 'owner', now, now, BASE, now, now, ['inventory'], [])
  );
  await diContainer.warehouseRepository.createWarehouse(
    new Warehouse({ id: whA, companyId, name: 'WH-A', code: 'WH-A', active: true, isDefault: true, createdAt: now, updatedAt: now })
  );
  await diContainer.warehouseRepository.createWarehouse(
    new Warehouse({ id: whB, companyId, name: 'WH-B', code: 'WH-B', active: true, isDefault: false, createdAt: now, updatedAt: now })
  );
  await diContainer.itemRepository.createItem(
    new Item({
      id: itemId, companyId, code: 'ITM-1', name: 'Item 1', type: 'PRODUCT', baseUom: 'pcs',
      costCurrency: BASE, costingMethod: 'MOVING_AVG', trackInventory: true, active: true,
      createdBy: USER, createdAt: now, updatedAt: now,
    })
  );
  await diContainer.inventorySettingsRepository.saveSettings(
    new InventorySettings({
      companyId, defaultCostingMethod: 'MOVING_AVG', costingBasis: 'GLOBAL', defaultCostCurrency: BASE,
      allowNegativeStock: true, autoGenerateItemCode: false, itemCodeNextSeq: 1,
    })
  );

  const uc = new RecordStockMovementUseCase({
    itemRepository: diContainer.itemRepository,
    warehouseRepository: diContainer.warehouseRepository,
    stockMovementRepository: diContainer.stockMovementRepository,
    stockLevelRepository: diContainer.stockLevelRepository,
    companyRepository: diContainer.companyRepository,
    inventorySettingsRepository: diContainer.inventorySettingsRepository,
    transactionManager: diContainer.transactionManager,
  });

  const IN = (warehouseId: string, qty: number, unitCost: number) =>
    uc.processIN({
      companyId, itemId, warehouseId, qty, date: '2026-01-10', movementType: 'PURCHASE_RECEIPT',
      refs: { type: 'PURCHASE_INVOICE', docId: 'p1' }, currentUser: USER,
      unitCostInMoveCurrency: unitCost, moveCurrency: BASE, fxRateMovToBase: 1, fxRateCCYToBase: 1,
    });
  const OUT = (warehouseId: string, qty: number) =>
    uc.processOUT({
      companyId, itemId, warehouseId, qty, date: '2026-01-11', movementType: 'SALES_DELIVERY',
      refs: { type: 'SALES_INVOICE', docId: 's1' }, currentUser: USER,
    });
  const level = (warehouseId: string) => diContainer.stockLevelRepository.getLevel(companyId, itemId, warehouseId);

  // ── Scenario ──
  console.log('IN 10 @ 5 → WH-A, IN 10 @ 7 → WH-B (re-blend across warehouses)');
  await IN(whA, 10, 5);
  await IN(whB, 10, 7); // company avg = (50 + 70) / 20 = 6
  let a = await level(whA);
  let b = await level(whB);
  check('WH-A carries the company average 6', a?.avgCostBase, 6);
  check('WH-B carries the company average 6', b?.avgCostBase, 6);

  console.log('\nOUT 3 from WH-B (received at 7 — must issue at company average 6)');
  const out = await OUT(whB, 3);
  check('OUT unit cost == 6 (company average, NOT 7)', out.unitCostBase, 6);
  check('OUT total cost == 18', out.totalCostBase, 18);
  b = await level(whB);
  check('WH-B qty == 7 after sale', b?.qtyOnHand, 7);
  check('WH-B average unchanged by issue (6)', b?.avgCostBase, 6);

  console.log('\nFLAT transfer 4 from WH-A → WH-B (qty moves, average flat)');
  const trf = await uc.processTRANSFER({
    companyId, itemId, sourceWarehouseId: whA, destinationWarehouseId: whB, qty: 4,
    date: '2026-01-12', transferDocId: 'trf-1', currentUser: USER,
  });
  check('transfer OUT leg at company average 6', trf.outMov.unitCostBase, 6);
  check('transfer IN leg at company average 6', trf.inMov.unitCostBase, 6);
  a = await level(whA);
  b = await level(whB);
  check('WH-A qty == 6 after transfer out', a?.qtyOnHand, 6);
  check('WH-B qty == 11 after transfer in', b?.qtyOnHand, 11);
  check('WH-A average still 6', a?.avgCostBase, 6);
  check('WH-B average still 6', b?.avgCostBase, 6);

  // ── Cleanup ──
  try {
    await diContainer.companyRepository.delete(companyId);
  } catch {
    /* throwaway tenant on an ephemeral emulator — leftover data is harmless */
  }

  console.log(`\n${failed === 0 ? '✅' : '❌'} ${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('\n❌ Validation crashed:', err);
  process.exit(1);
});
