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
import { PrismaItemRepository } from '../src/infrastructure/prisma/repositories/inventory/PrismaItemRepository';
import { PrismaWarehouseRepository } from '../src/infrastructure/prisma/repositories/inventory/PrismaWarehouseRepository';
import { PrismaStockLevelRepository } from '../src/infrastructure/prisma/repositories/inventory/PrismaStockLevelRepository';
import { PrismaStockMovementRepository } from '../src/infrastructure/prisma/repositories/inventory/PrismaStockMovementRepository';
import { StockLevel } from '../src/domain/inventory/entities/StockLevel';
import { PrismaSalesInvoiceRepository } from '../src/infrastructure/prisma/repositories/sales/PrismaSalesInvoiceRepository';
import { PrismaPurchaseInvoiceRepository } from '../src/infrastructure/prisma/repositories/purchases/PrismaPurchaseInvoiceRepository';
import { PrismaUserRepository } from '../src/infrastructure/prisma/repositories/core/PrismaUserRepository';
import { PrismaCompanyRoleRepository } from '../src/infrastructure/prisma/repositories/rbac/PrismaCompanyRoleRepository';
import { PrismaRbacCompanyUserRepository } from '../src/infrastructure/prisma/repositories/rbac/PrismaRbacCompanyUserRepository';
import { GetCurrentUserPermissionsForCompanyUseCase } from '../src/application/rbac/use-cases/GetCurrentUserPermissionsForCompanyUseCase';
import { PermissionChecker } from '../src/application/rbac/PermissionChecker';
import { AssignRoleToCompanyUserUseCase } from '../src/application/rbac/use-cases/AssignRoleToCompanyUserUseCase';
import { PrismaCompanySettingsRepository } from '../src/infrastructure/prisma/repositories/core/PrismaCompanySettingsRepository';
import { PrismaCompanyModuleRepository } from '../src/infrastructure/prisma/repositories/company/PrismaCompanyModuleRepository';
import { CompanySettings } from '../src/domain/core/entities/CompanySettings';
import { CompanyModuleEntity } from '../src/domain/company/entities/CompanyModule';
import { PrismaPosShiftRepository } from '../src/infrastructure/prisma/repositories/pos/PrismaPosShiftRepository';
import { PrismaPosRegisterRepository } from '../src/infrastructure/prisma/repositories/pos/PrismaPosRegisterRepository';
import { PrismaPosSettingsRepository } from '../src/infrastructure/prisma/repositories/pos/PrismaPosSettingsRepository';
import { PrismaPosPolicyRepository } from '../src/infrastructure/prisma/repositories/pos/PrismaPosPolicyRepository';
import { PrismaPosCashMovementRepository } from '../src/infrastructure/prisma/repositories/pos/PrismaPosCashMovementRepository';
import { PrismaPosReceiptRepository } from '../src/infrastructure/prisma/repositories/pos/PrismaPosReceiptRepository';
import { PrismaPosPaymentRepository } from '../src/infrastructure/prisma/repositories/pos/PrismaPosPaymentRepository';
import { PrismaPartyRepository } from '../src/infrastructure/prisma/repositories/shared/PrismaPartyRepository';
import { PrismaTaxCodeRepository } from '../src/infrastructure/prisma/repositories/shared/PrismaTaxCodeRepository';
import { PrismaInventorySettingsRepository } from '../src/infrastructure/prisma/repositories/inventory/PrismaInventorySettingsRepository';
import { PrismaItemCategoryRepository } from '../src/infrastructure/prisma/repositories/inventory/PrismaItemCategoryRepository';
import { PrismaCompanyCurrencyRepository } from '../src/infrastructure/prisma/repositories/PrismaCompanyCurrencyRepository';
import { PrismaVoucherSequenceRepository } from '../src/infrastructure/prisma/repositories/accounting/PrismaVoucherSequenceRepository';
import { PrismaVoucherRepository } from '../src/infrastructure/prisma/repositories/PrismaVoucherRepository';
import { PrismaPostingLogRepository } from '../src/infrastructure/prisma/repositories/accounting/PrismaPostingLogRepository';
import { PrismaTransactionManager } from '../src/infrastructure/prisma/PrismaTransactionManager';
import { OpenPosShiftUseCase, ClosePosShiftUseCase } from '../src/application/pos/use-cases/PosShiftUseCases';
import { CompletePosSaleUseCase } from '../src/application/pos/use-cases/CompletePosSaleUseCase';
import { PostPosSaleUseCase } from '../src/application/pos/use-cases/PostPosSaleUseCase';
import { PolicyEngine, TaxEngine, NumberingEngine, LegacyAccountingBridgeAdapter } from '../src/application/system-core';
import { SubledgerVoucherPostingService } from '../src/application/accounting/services/SubledgerVoucherPostingService';
import { PosRegister } from '../src/domain/pos/entities/PosRegister';
import { PosSettings } from '../src/domain/pos/entities/PosSettings';
import { POSPolicy } from '../src/domain/pos/entities/POSPolicy';
import { Party } from '../src/domain/shared/entities/Party';
import { InventorySettings } from '../src/domain/inventory/entities/InventorySettings';
import { ensureInventoryCore, resolveInventoryCOGSAccounts, addInventoryCOGSToBucket } from '../src/application/inventory/contracts/InventoryIntegrationContracts';

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

async function flowInventory(prisma: PrismaClient, cid: string): Promise<void> {
  console.log('\nB. Inventory — item + warehouse + stock movement + stock level (cost)');

  const itemRepo = new PrismaItemRepository(prisma);
  const warehouseRepo = new PrismaWarehouseRepository(prisma);
  const levelRepo = new PrismaStockLevelRepository(prisma);
  const movementRepo = new PrismaStockMovementRepository(prisma);

  const itemId = `item-${cid}`;
  const whId = `wh-${cid}`;
  const now = new Date();

  await warehouseRepo.createWarehouse({
    id: whId, code: 'WH1', name: 'Main', companyId: cid, parentId: null,
    address: null, active: true, isDefault: true, createdAt: now, updatedAt: now,
  } as any);
  await itemRepo.createItem({
    id: itemId, companyId: cid, code: 'SKU1', name: 'Widget', type: 'PRODUCT',
    baseUom: 'EA', costCurrency: 'USD', costingMethod: 'MOVING_AVG',
    trackInventory: true, tags: [], active: true, createdBy: 'it',
  } as any);
  check('item + warehouse created (inventory FKs)', true);

  // Append a stock receipt movement: IN 10 @ unit cost 5 (total 50).
  const movId = `mov-${cid}`;
  await movementRepo.recordMovement({
    id: movId, companyId: cid, date: '2026-03-15', postingSeq: 1, createdBy: 'it',
    postedAt: now, itemId, warehouseId: whId, direction: 'IN', movementType: 'PURCHASE_RECEIPT',
    qty: 10, uom: 'EA', referenceType: 'PURCHASE_INVOICE', referenceId: null,
    unitCostBase: 5, totalCostBase: 50, unitCostCCY: 5, totalCostCCY: 50,
    movementCurrency: 'USD', fxRateMovToBase: 1, fxRateCCYToBase: 1, fxRateKind: 'DOCUMENT',
    avgCostBaseAfter: 5, avgCostCCYAfter: 5, qtyBefore: 0, qtyAfter: 10,
    settlesNegativeQty: 0, newPositiveQty: 10,
    negativeQtyAtPosting: false, costSettled: false, isBackdated: false, costSource: 'PURCHASE',
  } as any);
  const movements = await movementRepo.getItemMovements(cid, itemId);
  check('stock movement appended and read back (qty 10 @ cost 5)',
    movements.length === 1 && movements[0].qty === 10 && movements[0].unitCostBase === 5);

  // First persistence of a brand-new stock level (version 1) — this is the path
  // the old update-only "upsert" could not handle (it threw RecordNotFound).
  const levelId = `lvl-${cid}`;
  const level1 = StockLevel.fromJSON({
    id: levelId, companyId: cid, itemId, warehouseId: whId, qtyOnHand: 10, reservedQty: 0,
    avgCostBase: 5, avgCostCCY: 5, lastCostBase: 5, lastCostCCY: 5, postingSeq: 1,
    maxBusinessDate: '2026-03-15', totalMovements: 1, lastMovementId: movId, version: 1,
    updatedAt: now,
  });
  await levelRepo.upsertLevel(level1);
  const afterCreate = await levelRepo.getLevel(cid, itemId, whId);
  check('NEW stock level created via upsert (qty 10, avg cost 5, v1)',
    !!afterCreate && afterCreate.qtyOnHand === 10 && afterCreate.avgCostBase === 5 && afterCreate.version === 1);

  // Second receipt blends cost: now 15 units @ avg 6, version 2 -> UPDATE path under the guard.
  const level2 = StockLevel.fromJSON({
    id: levelId, companyId: cid, itemId, warehouseId: whId, qtyOnHand: 15, reservedQty: 0,
    avgCostBase: 6, avgCostCCY: 6, lastCostBase: 8, lastCostCCY: 8, postingSeq: 2,
    maxBusinessDate: '2026-03-16', totalMovements: 2, lastMovementId: movId, version: 2,
    updatedAt: now,
  });
  await levelRepo.upsertLevel(level2);
  const afterUpdate = await levelRepo.getLevel(cid, itemId, whId);
  check('stock level UPDATE under version guard (qty 15, avg cost 6, v2)',
    !!afterUpdate && afterUpdate.qtyOnHand === 15 && afterUpdate.avgCostBase === 6 && afterUpdate.version === 2);
}

async function flowSales(prisma: PrismaClient, cid: string): Promise<void> {
  console.log('\nC. Sales — Sales Invoice (header + line) round-trip');
  const siRepo = new PrismaSalesInvoiceRepository(prisma);
  const itemId = `item-${cid}`; // reuse the item created in the inventory flow
  const siId = `si-${cid}`;

  await siRepo.create({
    id: siId, companyId: cid, invoiceNumber: 'SI-0001', customerId: 'cust-1', customerName: 'Acme',
    invoiceDate: '2026-03-15', currency: 'USD', exchangeRate: 1, status: 'POSTED', paymentStatus: 'UNPAID',
    voucherType: 'sales_invoice', formType: 'SALES_INVOICE',
    paidAmountBase: 0, outstandingAmountBase: 100, subtotalBase: 100, taxTotalBase: 0, grandTotalBase: 100,
    subtotalDoc: 100, taxTotalDoc: 0, grandTotalDoc: 100, createdBy: 'it',
    lines: [{
      lineId: 'sil-1', lineNo: 1, itemId, itemCode: 'SKU1', itemName: 'Widget', trackInventory: true,
      invoicedQty: 2, uom: 'EA', unitPriceDoc: 50, lineTotalDoc: 100, unitPriceBase: 50, lineTotalBase: 100,
      taxRate: 0, taxAmountDoc: 0, taxAmountBase: 0, revenueAccountId: 'rev-acct',
    }],
  } as any);
  check('sales invoice + line created (no throw)', true);

  const got = await siRepo.getById(cid, siId);
  check('sales invoice read back with 1 line, grand total 100',
    !!got && (got as any).lines.length === 1 && (got as any).grandTotalBase === 100 && (got as any).invoiceNumber === 'SI-0001');
}

async function flowPurchases(prisma: PrismaClient, cid: string): Promise<void> {
  console.log('\nD. Purchases — Purchase Invoice (header + line) round-trip');
  const piRepo = new PrismaPurchaseInvoiceRepository(prisma);
  const itemId = `item-${cid}`; // reuse the inventory item
  const piId = `pi-${cid}`;

  await piRepo.create({
    id: piId, companyId: cid, invoiceNumber: 'PI-0001', vendorId: 'vend-1', vendorName: 'Supplier Co',
    invoiceDate: '2026-03-16', currency: 'USD', exchangeRate: 1, status: 'POSTED', paymentStatus: 'UNPAID',
    voucherType: 'purchase_invoice', formType: 'PURCHASE_INVOICE',
    paidAmountBase: 0, outstandingAmountBase: 20, subtotalBase: 20, taxTotalBase: 0, grandTotalBase: 20,
    subtotalDoc: 20, taxTotalDoc: 0, grandTotalDoc: 20, createdBy: 'it',
    lines: [{
      lineId: 'pil-1', lineNo: 1, itemId, itemCode: 'SKU1', itemName: 'Widget', trackInventory: true,
      invoicedQty: 4, uom: 'EA', unitPriceDoc: 5, lineTotalDoc: 20, unitPriceBase: 5, lineTotalBase: 20,
      taxRate: 0, taxAmountDoc: 0, taxAmountBase: 0, accountId: 'exp-acct',
    }],
  } as any);
  check('purchase invoice + line created (no throw)', true);

  const got = await piRepo.getById(cid, piId);
  check('purchase invoice read back with 1 line, grand total 20',
    !!got && (got as any).lines.length === 1 && (got as any).grandTotalBase === 20 && (got as any).invoiceNumber === 'PI-0001');
}

async function flowRBAC(prisma: PrismaClient, cid: string): Promise<void> {
  console.log('\nE. RBAC — assign role -> resolve permissions');

  const userRepo = new PrismaUserRepository(prisma);
  const roleRepo = new PrismaCompanyRoleRepository(prisma);
  const companyUserRepo = new PrismaRbacCompanyUserRepository(prisma);
  const permissionReader = new GetCurrentUserPermissionsForCompanyUseCase(userRepo, companyUserRepo, roleRepo);
  const checker = new PermissionChecker(permissionReader);
  const assignRole = new AssignRoleToCompanyUserUseCase(companyUserRepo, checker);

  const actorId = `owner-${cid}`;
  const userId = `cashier-${cid}`;
  const roleId = `role-pos-${cid}`;
  await prisma.user.createMany({
    data: [
      { id: actorId, email: `${actorId}@example.test`, name: 'Owner', globalRole: 'USER', activeCompanyId: cid },
      { id: userId, email: `${userId}@example.test`, name: 'Cashier', globalRole: 'USER', activeCompanyId: cid },
    ],
  });
  await companyUserRepo.create({ userId: actorId, companyId: cid, roleId: '', isOwner: true, createdAt: new Date() });
  await companyUserRepo.create({ userId, companyId: cid, roleId: '', isOwner: false, createdAt: new Date() });
  await roleRepo.create({
    id: roleId,
    companyId: cid,
    name: 'POS Cashier',
    permissions: [],
    explicitPermissions: ['pos.terminal.sell'],
    resolvedPermissions: ['pos.terminal.sell'],
  });

  await assignRole.execute({ companyId: cid, targetUserId: userId, roleId, actorId });
  const assigned = await companyUserRepo.getByUserAndCompany(userId, cid);
  const gotRole = await roleRepo.getById(cid, roleId);
  check('role row persists and company user reads back with roleId',
    !!assigned && assigned.roleId === roleId && !!gotRole && gotRole.resolvedPermissions?.includes('pos.terminal.sell') === true);
  check('permission checker grants assigned permission',
    await checker.hasPermission(userId, cid, 'pos.terminal.sell') === true);
  check('permission checker denies unassigned permission',
    await checker.hasPermission(userId, cid, 'accounting.vouchers.post') === false);
}

async function flowCore(prisma: PrismaClient, cid: string): Promise<void> {
  console.log('\nF. Core — company settings + enabled module round-trip');

  const settingsRepo = new PrismaCompanySettingsRepository(prisma);
  const moduleRepo = new PrismaCompanyModuleRepository(prisma);

  await settingsRepo.updateSettings(cid, new CompanySettings(
    cid,
    true,
    'windows',
    'Europe/Istanbul',
    'DD/MM/YYYY',
    'en',
    'USD',
    '01-01',
    '12-31',
    undefined,
    ['AI']
  ));
  const settings = await settingsRepo.getSettings(cid);
  check('company settings write/read preserves approval, timezone, date format, currency',
    settings.strictApprovalMode === true
    && settings.timezone === 'Europe/Istanbul'
    && settings.dateFormat === 'DD/MM/YYYY'
    && settings.baseCurrency === 'USD');

  const accountingModule = CompanyModuleEntity.create(cid, 'accounting');
  accountingModule.enable();
  accountingModule.markInitialized({ source: 'sql-integration-275e' });
  await moduleRepo.create(accountingModule);

  const posModule = CompanyModuleEntity.create(cid, 'pos');
  posModule.enable();
  posModule.markInitialized({ source: 'sql-integration-275e' });
  await moduleRepo.create(posModule);

  const modules = await moduleRepo.listByCompany(cid);
  const accounting = modules.find((m) => m.moduleCode === 'accounting');
  const pos = modules.find((m) => m.moduleCode === 'pos');
  check('enabled modules read back as initialized and enabled',
    accounting?.isEnabled === true && accounting.initialized === true
    && pos?.isEnabled === true && pos.initialized === true);
}

async function flowPOS(prisma: PrismaClient, cid: string): Promise<void> {
  console.log('\nG. POS — open shift -> sale -> ledger -> close shift');

  const accountRepo = new PrismaAccountRepository(prisma);
  const itemRepo = new PrismaItemRepository(prisma);
  const itemCategoryRepo = new PrismaItemCategoryRepository(prisma);
  const levelRepo = new PrismaStockLevelRepository(prisma);
  const movementRepo = new PrismaStockMovementRepository(prisma);
  const invSettingsRepo = new PrismaInventorySettingsRepository(prisma);
  const partyRepo = new PrismaPartyRepository(prisma);
  const taxRepo = new PrismaTaxCodeRepository(prisma);
  const currencyRepo = new PrismaCompanyCurrencyRepository(prisma);
  const moduleRepo = new PrismaCompanyModuleRepository(prisma);
  const txManager = new PrismaTransactionManager(prisma);
  const shiftRepo = new PrismaPosShiftRepository(prisma);
  const registerRepo = new PrismaPosRegisterRepository(prisma);
  const posSettingsRepo = new PrismaPosSettingsRepository(prisma);
  const posPolicyRepo = new PrismaPosPolicyRepository(prisma);
  const cashMovementRepo = new PrismaPosCashMovementRepository(prisma);
  const receiptRepo = new PrismaPosReceiptRepository(prisma);
  const paymentRepo = new PrismaPosPaymentRepository(prisma);
  const ledgerRepo = new PrismaLedgerRepository(prisma, accountRepo);
  const voucherRepo = new PrismaVoucherRepository(prisma);
  const postingLogRepo = new PrismaPostingLogRepository(prisma);
  const accountingBridge = new LegacyAccountingBridgeAdapter(
    new SubledgerVoucherPostingService(voucherRepo, ledgerRepo, currencyRepo, accountRepo),
    moduleRepo,
    postingLogRepo
  );
  const policyEngine = new PolicyEngine(posPolicyRepo);
  const numberingEngine = new NumberingEngine(new PrismaVoucherSequenceRepository(prisma));
  const inventoryCore = ensureInventoryCore({
    processOUT: async () => { throw new Error('processOUT not used by POS integration flow'); },
    processIN: async () => { throw new Error('processIN not used by POS integration flow'); },
    deleteMovement: async (companyId: string, id: string, transaction?: unknown) => movementRepo.deleteMovement(companyId, id, transaction),
    preFetchStockLevel: (companyId: string, itemId: string, warehouseId: string) => levelRepo.getLevel(companyId, itemId, warehouseId),
    preFetchLevelsByItem: (companyId: string, itemId: string) => levelRepo.getLevelsByItem(companyId, itemId),
    writeStockMovement: (movement: any, transaction?: unknown) => movementRepo.recordMovement(movement, transaction),
    writeStockLevel: (level: any, transaction?: unknown) =>
      transaction ? levelRepo.upsertLevelInTransaction(transaction, level) : levelRepo.upsertLevel(level),
    resolveCOGSAccounts: resolveInventoryCOGSAccounts,
    addToCOGSBucket: addInventoryCOGSToBucket,
  });

  const now = new Date();
  const arAccountId = `acc-ar-${cid}`;
  const cashAccountId = `acc-cash-pos-${cid}`;
  const inventoryAccountId = `acc-inv-${cid}`;
  const cogsAccountId = `acc-cogs-${cid}`;
  const revenueAccountId = `acc-rev-pos-${cid}`;
  await accountRepo.create(cid, {
    id: arAccountId, userCode: '1100', name: 'Accounts Receivable', classification: 'ASSET',
    balanceNature: 'DEBIT', createdBy: 'it', updatedBy: 'it',
  });
  await accountRepo.create(cid, {
    id: cashAccountId, userCode: '1010', name: 'POS Cash Drawer', classification: 'ASSET',
    balanceNature: 'DEBIT', createdBy: 'it', updatedBy: 'it',
  });
  await accountRepo.create(cid, {
    id: inventoryAccountId, userCode: '1300', name: 'Inventory', classification: 'ASSET',
    balanceNature: 'DEBIT', createdBy: 'it', updatedBy: 'it',
  });
  await accountRepo.create(cid, {
    id: cogsAccountId, userCode: '5000', name: 'COGS', classification: 'EXPENSE',
    balanceNature: 'DEBIT', createdBy: 'it', updatedBy: 'it',
  });
  await accountRepo.create(cid, {
    id: revenueAccountId, userCode: '4010', name: 'POS Revenue', classification: 'REVENUE',
    balanceNature: 'CREDIT', createdBy: 'it', updatedBy: 'it',
  });

  const itemId = `item-${cid}`;
  const whId = `wh-${cid}`;
  const registerId = `reg-${cid}`;
  const cashierId = `cashier-${cid}`;
  const customerId = `cust-${cid}`;
  await invSettingsRepo.saveSettings(new InventorySettings({
    companyId: cid,
    inventoryAccountingMethod: 'PERPETUAL',
    accountingMode: 'PERPETUAL',
    defaultCostingMethod: 'MOVING_AVG',
    defaultCostCurrency: 'USD',
    defaultInventoryAssetAccountId: inventoryAccountId,
    defaultCOGSAccountId: cogsAccountId,
    allowNegativeStock: false,
    autoGenerateItemCode: false,
    itemCodeNextSeq: 1,
  }));
  await partyRepo.create(new Party({
    id: customerId,
    companyId: cid,
    code: 'WALKIN',
    legalName: 'Walk-in Customer',
    displayName: 'Walk-in Customer',
    roles: ['CUSTOMER'],
    defaultCurrency: 'USD',
    defaultARAccountId: arAccountId,
    active: true,
    createdBy: 'it',
    createdAt: now,
    updatedAt: now,
  }));
  await itemRepo.updateItem(itemId, {
    revenueAccountId,
    cogsAccountId,
    inventoryAssetAccountId: inventoryAccountId,
    salePrice: 12,
    updatedAt: now,
  } as any);
  await posSettingsRepo.saveSettings(new PosSettings({
    companyId: cid,
    requireOpenShift: true,
    walkInCustomerId: customerId,
    defaultRevenueAccountId: revenueAccountId,
    receiptPrefix: 'R',
    receiptNextSeq: 1,
    allowPosDirectSales: true,
    negativeStockPolicy: 'BLOCK',
    paymentMethods: [{ code: 'CASH', settlementAccountId: cashAccountId, requiresReference: false, allowsChange: true, isEnabled: true }],
  }));
  await posPolicyRepo.savePolicy(new POSPolicy({
    companyId: cid,
    allowPosDirectSales: true,
    terminalPolicies: [{ registerId, allowDirectSales: true }],
  }));
  await registerRepo.create(new PosRegister({
    id: registerId,
    companyId: cid,
    code: 'REG1',
    name: 'Main Register',
    warehouseId: whId,
    cashDrawerAccountId: cashAccountId,
    settlementAccountIds: { CASH: cashAccountId },
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  }));

  const openShift = new OpenPosShiftUseCase(shiftRepo, registerRepo, posSettingsRepo, cashMovementRepo, txManager);
  const shift = await openShift.execute({
    companyId: cid,
    registerId,
    cashierUserId: cashierId,
    openingFloat: 20,
    actor: { userId: cashierId },
  });
  check('POS shift opens and reads back as OPEN', (await shiftRepo.getById(cid, shift.id))?.status === 'OPEN');

  const completeSale = new CompletePosSaleUseCase(
    shiftRepo,
    posSettingsRepo,
    registerRepo,
    receiptRepo,
    paymentRepo,
    cashMovementRepo,
    txManager,
    new PostPosSaleUseCase(
      itemRepo,
      itemCategoryRepo,
      invSettingsRepo,
      partyRepo,
      taxRepo,
      currencyRepo,
      inventoryCore,
      accountingBridge,
      new TaxEngine(),
      posSettingsRepo
    ),
    policyEngine,
    numberingEngine
  );
  const sale = await completeSale.execute({
    companyId: cid,
    registerId,
    shiftId: shift.id,
    lines: [{ itemId, qty: 1, unitPrice: 12 }],
    payments: [{ method: 'CASH', amount: 12 }],
    actor: { userId: cashierId, roleId: 'pos-cashier' },
  });
  const receipt = await receiptRepo.getById(cid, sale.receipt.id);
  const payments = await paymentRepo.listByReceipt(cid, sale.receipt.id);
  const posLedgers = await prisma.ledgerEntry.findMany({ where: { companyId: cid, description: { contains: sale.salesInvoiceNumber } } });
  check('POS sale persists receipt and cash payment',
    !!receipt && receipt.status === 'COMPLETED' && receipt.grandTotal === 12 && payments.length === 1 && payments[0].amount === 12);
  check('POS sale posts ledger rows through PostingGateway-backed bridge', posLedgers.length >= 4);

  const afterSaleLevel = await levelRepo.getLevel(cid, itemId, whId);
  check('POS sale decrements stock level by sold quantity', !!afterSaleLevel && afterSaleLevel.qtyOnHand === 14);

  const closeShift = new ClosePosShiftUseCase(
    shiftRepo,
    posSettingsRepo,
    registerRepo,
    cashMovementRepo,
    accountRepo,
    accountingBridge,
    txManager,
    receiptRepo,
    paymentRepo
  );
  const closed = await closeShift.execute({
    companyId: cid,
    shiftId: shift.id,
    countedCash: 32,
    actor: { userId: cashierId },
  });
  check('POS shift closes reconciled with expected cash totals',
    closed.shift.status === 'RECONCILED' && closed.expectedPaymentTotals.CASH === 32 && closed.overShortAmount === 0);
}

async function cleanup(prisma: PrismaClient, cid: string): Promise<void> {
  // Delete child rows first, then the company.
  try {
    await (prisma as any).posPayment.deleteMany({ where: { companyId: cid } });
    await (prisma as any).posReceipt.deleteMany({ where: { companyId: cid } });
    await (prisma as any).posCashMovement.deleteMany({ where: { companyId: cid } });
    await (prisma as any).posShift.deleteMany({ where: { companyId: cid } });
    await (prisma as any).posRegister.deleteMany({ where: { companyId: cid } });
    await (prisma as any).posSettings.deleteMany({ where: { companyId: cid } });
    await (prisma as any).posPolicy.deleteMany({ where: { companyId: cid } });
    await (prisma as any).postingLog.deleteMany({ where: { companyId: cid } });
    await prisma.voucherLine.deleteMany({ where: { voucher: { companyId: cid } } });
    await prisma.voucher.deleteMany({ where: { companyId: cid } });
    await prisma.voucherSequence.deleteMany({ where: { companyId: cid } });
    await (prisma as any).companyModule.deleteMany({ where: { companyId: cid } });
    await (prisma as any).companySettings.deleteMany({ where: { companyId: cid } });
    await (prisma as any).companyRole.deleteMany({ where: { companyId: cid } });
    await (prisma as any).companyUser.deleteMany({ where: { companyId: cid } });
    await (prisma as any).inventorySettings.deleteMany({ where: { companyId: cid } });
    await (prisma as any).party.deleteMany({ where: { companyId: cid } });
    await (prisma as any).companyCurrency.deleteMany({ where: { companyId: cid } });
    await prisma.ledgerEntry.deleteMany({ where: { companyId: cid } });
    await prisma.account.deleteMany({ where: { companyId: cid } });
    // Invoices (lines cascade) must go before items — line.itemId FK is Restrict.
    await (prisma as any).salesInvoice.deleteMany({ where: { companyId: cid } });
    await (prisma as any).purchaseInvoice.deleteMany({ where: { companyId: cid } });
    await (prisma as any).stockMovement.deleteMany({ where: { companyId: cid } });
    await (prisma as any).stockLevel.deleteMany({ where: { companyId: cid } });
    await (prisma as any).item.deleteMany({ where: { companyId: cid } });
    await (prisma as any).warehouse.deleteMany({ where: { companyId: cid } });
    await prisma.company.deleteMany({ where: { id: cid } });
    await prisma.user.deleteMany({ where: { id: { in: [`owner-${cid}`, `cashier-${cid}`] } } });
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
    await flowInventory(prisma, cid);
    await flowSales(prisma, cid);
    await flowPurchases(prisma, cid);
    await flowRBAC(prisma, cid);
    await flowCore(prisma, cid);
    await flowPOS(prisma, cid);

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
