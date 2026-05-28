/**
 * seed-audit-tenant.ts
 *
 * Phase 1b — drives one of each sales/accounting transaction type through
 * the real use cases (in-process via DI), so we can audit the resulting
 * ledger against pre-computed expected totals.
 *
 * Prerequisite: seed-test-tenant.ts has already run with --post-ov so the
 * master data + 100 × WIDGET-A @ $10 OV are in place.
 *
 * Usage (from backend/):
 *   npx ts-node scripts/seed-audit-tenant.ts --companyId <id> [--stage 1|2|3|4|all]
 *
 * Stages:
 *   1  — SO -> confirm -> DN -> post -> SI (create+post)
 *   2  — Direct SI (create+post, no SO)
 *   3  — SR (credit note against direct SI)
 *   4  — RV (receipt) + PV (payment) + JV (journal voucher)
 *   all — runs 1 -> 4 in order
 *
 * Each stage prints the expected GL impact so you can eyeball the actual
 * journal in the UI afterwards. Final pass writes
 * scripts/expected-balances.json with per-account totals for the verify
 * script to assert against.
 */

process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';

import admin from '../src/firebaseAdmin';

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------

type Args = {
  companyId: string;
  userId: string;
  stages: number[];
};

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const get = (name: string): string | undefined => {
    const idx = argv.indexOf(`--${name}`);
    return idx >= 0 ? argv[idx + 1] : undefined;
  };
  const companyId = get('companyId');
  if (!companyId) {
    console.error('ERROR: --companyId <id> is required');
    process.exit(1);
  }
  const stageArg = get('stage') || 'all';
  const stages = stageArg === 'all' ? [1, 2, 3, 4] : [parseInt(stageArg, 10)];
  return { companyId, userId: get('userId') || 'audit-script', stages };
}

// ---------------------------------------------------------------------------
// Account + entity lookup
// ---------------------------------------------------------------------------

type AccountRow = { id: string; code: string; name: string; classification: string; role?: string; parentId?: string };

async function loadAccounts(db: FirebaseFirestore.Firestore, companyId: string): Promise<AccountRow[]> {
  const snap = await db.collection('companies').doc(companyId)
    .collection('accounting').doc('Data').collection('accounts').get();
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: data.id || d.id,
      code: String(data.userCode || data.code || ''),
      name: data.name || '',
      classification: (data.classification || data.type || '').toString().toUpperCase(),
      role: data.accountRole || data.role,
      parentId: data.parentId,
    };
  });
}

function pickAccount(rows: AccountRow[], classification: string, patterns: RegExp[]): AccountRow | null {
  // Exclude HEADERs (accounts that are parents to other accounts)
  const isParent = new Set<string>();
  rows.forEach((r) => { if (r.parentId) isParent.add(r.parentId); });
  const candidates = rows.filter((r) => !isParent.has(r.id) && r.classification === classification);
  for (const re of patterns) {
    const hit = candidates.find((r) => re.test(r.name) || re.test(r.code));
    if (hit) return hit;
  }
  return null;
}

type Resolved = {
  ar: AccountRow;
  revenue: AccountRow;
  inventory: AccountRow;
  cogs: AccountRow;
  ap: AccountRow;
  cash: AccountRow;
  tax: AccountRow;
  openingEquity: AccountRow;
};

function resolveAccounts(rows: AccountRow[]): Resolved {
  const r = {
    ar: pickAccount(rows, 'ASSET', [/accounts?.receivable/i, /\breceivable\b/i]),
    revenue: pickAccount(rows, 'REVENUE', [/sales\s*revenue/i, /\brevenue\b/i, /\bsales\b/i]),
    inventory: pickAccount(rows, 'ASSET', [/finished\s*goods/i, /\binventory\b/i]),
    cogs: pickAccount(rows, 'EXPENSE', [/cost\s*of\s*goods/i, /cost\s*of\s*sales/i, /\bcogs\b/i]),
    ap: pickAccount(rows, 'LIABILITY', [/accounts?.payable/i, /\bpayable\b/i]),
    cash: pickAccount(rows, 'ASSET', [/cash\s*on\s*hand/i, /\bcash\b/i, /\bbank\b/i]),
    tax: pickAccount(rows, 'LIABILITY', [/sales\s*tax\s*payable/i, /\bvat\s*payable\b/i, /\btax\s*payable\b/i, /\bvat\b/i, /\btax\b/i]),
    openingEquity: pickAccount(rows, 'EQUITY', [/opening\s*balance\s*equity/i, /opening\s*equity/i, /paid.?in\s*capital/i, /owner.*capital/i, /retained\s*earnings/i, /capital/i]),
  };
  for (const [k, v] of Object.entries(r)) {
    if (!v) {
      console.error(`Could not resolve account: ${k}`);
      process.exit(1);
    }
  }
  return r as Resolved;
}

type EntityIds = {
  widgetA: string;
  widgetB: string;
  serviceA: string;
  acme: string;
  globex: string;
  supplierX: string;
  warehouse: string;
  taxCodeId: string;
};

async function loadEntities(db: FirebaseFirestore.Firestore, companyId: string): Promise<EntityIds> {
  const findItemByCode = async (code: string): Promise<string> => {
    const snap = await db.collection('companies').doc(companyId)
      .collection('inventory').doc('Data').collection('items')
      .where('code', '==', code).limit(1).get();
    if (snap.empty) throw new Error(`Item ${code} not found — run seed-test-tenant.ts first.`);
    const data = snap.docs[0].data();
    return data.id || snap.docs[0].id;
  };
  const findPartyByCode = async (code: string): Promise<string> => {
    const snap = await db.collection('companies').doc(companyId)
      .collection('shared').doc('Data').collection('parties')
      .where('code', '==', code).limit(1).get();
    if (snap.empty) throw new Error(`Party ${code} not found — run seed-test-tenant.ts first.`);
    const data = snap.docs[0].data();
    return data.id || snap.docs[0].id;
  };
  const findWarehouse = async (): Promise<string> => {
    const snap = await db.collection('companies').doc(companyId)
      .collection('inventory').doc('Data').collection('warehouses').limit(1).get();
    if (snap.empty) throw new Error('No warehouse — run seed-test-tenant.ts first.');
    const data = snap.docs[0].data();
    return data.id || snap.docs[0].id;
  };
  const findTaxCode = async (): Promise<string> => {
    const snap = await db.collection('companies').doc(companyId)
      .collection('shared').doc('Data').collection('tax_codes')
      .where('code', '==', 'TAX10').limit(1).get();
    if (snap.empty) throw new Error('Tax code TAX10 not found — run seed-test-tenant.ts first.');
    const data = snap.docs[0].data();
    return data.id || snap.docs[0].id;
  };

  return {
    widgetA: await findItemByCode('WIDGET-A'),
    widgetB: await findItemByCode('WIDGET-B'),
    serviceA: await findItemByCode('SERVICE-A'),
    acme: await findPartyByCode('ACME'),
    globex: await findPartyByCode('GLOBEX'),
    supplierX: await findPartyByCode('SUPPLIER-X'),
    warehouse: await findWarehouse(),
    taxCodeId: await findTaxCode(),
  };
}

// ---------------------------------------------------------------------------
// Use case factories (lazy-load DI to keep cold start light)
// ---------------------------------------------------------------------------

async function buildSalesUseCases() {
  const { diContainer } = await import('../src/infrastructure/di/bindRepositories');
  const { CreateSalesOrderUseCase, ConfirmSalesOrderUseCase } = await import('../src/application/sales/use-cases/SalesOrderUseCases');
  const { CreateDeliveryNoteUseCase, PostDeliveryNoteUseCase } = await import('../src/application/sales/use-cases/DeliveryNoteUseCases');
  const { CreateSalesInvoiceUseCase, PostSalesInvoiceUseCase, CreateAndPostSalesInvoiceUseCase } = await import('../src/application/sales/use-cases/SalesInvoiceUseCases');
  const { RecordStockMovementUseCase } = await import('../src/application/inventory/use-cases/RecordStockMovementUseCase');
  const { SubledgerVoucherPostingService } = await import('../src/application/accounting/services/SubledgerVoucherPostingService');
  const { VoucherValidationService } = await import('../src/domain/accounting/services/VoucherValidationService');
  const { CreditCheckService } = await import('../src/application/sales/services/CreditCheckService');
  const { RecordChangeService } = await import('../src/application/system/services/RecordChangeService');
  const { SalesInventoryService } = await import('../src/application/inventory/services/SalesInventoryService');

  const recordChangeService = new RecordChangeService(diContainer.recordChangeLogRepository);
  const movementUseCase = new RecordStockMovementUseCase({
    itemRepository: diContainer.itemRepository,
    warehouseRepository: diContainer.warehouseRepository,
    stockMovementRepository: diContainer.stockMovementRepository,
    stockLevelRepository: diContainer.stockLevelRepository,
    companyRepository: diContainer.companyRepository,
    inventorySettingsRepository: diContainer.inventorySettingsRepository,
    transactionManager: diContainer.transactionManager,
  });
  const inventoryService = new SalesInventoryService(movementUseCase);
  const accountingPostingService = new SubledgerVoucherPostingService(
    diContainer.voucherRepository,
    diContainer.ledgerRepository,
    diContainer.companyCurrencyRepository,
    diContainer.accountRepository,
    new VoucherValidationService(),
    diContainer.periodLockService,
  );

  const createSO = new CreateSalesOrderUseCase(
    diContainer.salesSettingsRepository,
    diContainer.salesOrderRepository,
    diContainer.partyRepository,
    diContainer.itemRepository,
    diContainer.taxCodeRepository,
    diContainer.companyCurrencyRepository,
    diContainer.promotionRuleRepository,
    recordChangeService,
  );

  const confirmSO = new ConfirmSalesOrderUseCase(
    diContainer.salesOrderRepository,
    diContainer.partyRepository,
    new CreditCheckService(diContainer.salesInvoiceRepository),
    diContainer.creditOverrideRepository,
  );

  const createDN = new CreateDeliveryNoteUseCase(
    diContainer.salesSettingsRepository,
    diContainer.deliveryNoteRepository,
    diContainer.salesOrderRepository,
    diContainer.partyRepository,
    diContainer.itemRepository,
    recordChangeService,
  );

  const postDN = new PostDeliveryNoteUseCase(
    diContainer.salesSettingsRepository,
    diContainer.inventorySettingsRepository,
    diContainer.deliveryNoteRepository,
    diContainer.salesOrderRepository,
    diContainer.itemRepository,
    diContainer.itemCategoryRepository,
    diContainer.warehouseRepository,
    diContainer.uomConversionRepository,
    diContainer.companyCurrencyRepository,
    inventoryService,
    diContainer.companyModuleRepository,
    accountingPostingService,
    diContainer.accountRepository,
    diContainer.transactionManager,
    recordChangeService,
  );

  const createSI = new CreateSalesInvoiceUseCase(
    diContainer.salesSettingsRepository,
    diContainer.salesInvoiceRepository,
    diContainer.salesOrderRepository,
    diContainer.partyRepository,
    diContainer.itemRepository,
    diContainer.itemCategoryRepository,
    diContainer.taxCodeRepository,
    diContainer.companyCurrencyRepository,
    diContainer.promotionRuleRepository,
    new CreditCheckService(diContainer.salesInvoiceRepository),
    diContainer.creditOverrideRepository,
    recordChangeService,
  );

  const postSI = new PostSalesInvoiceUseCase(
    diContainer.salesSettingsRepository,
    diContainer.inventorySettingsRepository,
    diContainer.salesInvoiceRepository,
    diContainer.salesOrderRepository,
    diContainer.deliveryNoteRepository,
    diContainer.partyRepository,
    diContainer.taxCodeRepository,
    diContainer.itemRepository,
    diContainer.itemCategoryRepository,
    diContainer.warehouseRepository,
    diContainer.uomConversionRepository,
    diContainer.companyCurrencyRepository,
    inventoryService,
    diContainer.companyModuleRepository,
    accountingPostingService,
    diContainer.accountRepository,
    diContainer.transactionManager,
    diContainer.paymentHistoryRepository,
    diContainer.voucherRepository,
    diContainer.voucherSequenceRepository,
    diContainer.ledgerRepository,
    diContainer.postingLogRepository,
    recordChangeService,
  );

  const createAndPostSI = new CreateAndPostSalesInvoiceUseCase(createSI, postSI);

  return { createSO, confirmSO, createDN, postDN, createSI, postSI, createAndPostSI };
}

// ---------------------------------------------------------------------------
// Stage 1 — SO -> DN -> SI (full chain)
// ---------------------------------------------------------------------------

async function runStage1(args: Args, entities: EntityIds, accounts: Resolved) {
  console.log('\n=== STAGE 1: SO -> DN -> SI (full chain) ===');
  console.log('  Customer: ACME');
  console.log('  Item: WIDGET-A × 5 @ $15 + 10% tax');
  console.log('  Expected GL on SI post:');
  console.log('    DR AR             82.50');
  console.log('    CR Revenue        75.00');
  console.log('    CR Tax (VAT)       7.50');
  console.log('    DR COGS           40.00  (5 × $10 cost)');
  console.log('    CR Inventory      40.00');
  console.log('');

  const sales = await buildSalesUseCases();
  const actor = { userId: args.userId, userEmail: 'audit@script.local' };
  const today = new Date().toISOString().slice(0, 10);

  // --- Create SO ---
  console.log('1.1 CreateSO...');
  const soInput: any = {
    companyId: args.companyId,
    customerId: entities.acme,
    warehouseId: entities.warehouse,
    orderDate: today,
    currency: 'USD',
    exchangeRate: 1,
    lines: [
      {
        itemId: entities.widgetA,
        orderedQty: 5,
        unitPriceDoc: 15,
        taxCodeId: entities.taxCodeId,
        uom: 'PCS',
      },
    ],
    createdBy: args.userId,
  };
  const so = await sales.createSO.execute(soInput, actor);
  console.log(`    ✓ SO ${so.orderNumber} created (id=${so.id.slice(0, 8)}...)`);

  // --- Confirm SO ---
  console.log('1.2 ConfirmSO...');
  const confirmResult = await sales.confirmSO.execute(args.companyId, so.id);
  console.log(`    ✓ SO ${confirmResult.salesOrder.orderNumber} confirmed`);

  // --- Create DN ---
  console.log('1.3 CreateDN...');
  const dnInput: any = {
    companyId: args.companyId,
    salesOrderId: so.id,
    customerId: entities.acme,
    warehouseId: entities.warehouse,
    deliveryDate: today,
    lines: confirmResult.salesOrder.lines.map((l: any) => ({
      soLineId: l.lineId,
      itemId: l.itemId,
      deliveredQty: l.orderedQty,
      uom: l.uom,
    })),
    createdBy: args.userId,
  };
  const dn = await sales.createDN.execute(dnInput, actor);
  console.log(`    ✓ DN ${dn.dnNumber} created (id=${dn.id.slice(0, 8)}...)`);

  // --- Post DN ---
  console.log('1.4 PostDN...');
  const postedDN = await sales.postDN.execute(args.companyId, dn.id, true, undefined, actor);
  console.log(`    ✓ DN ${postedDN.dnNumber} POSTED`);

  // --- Create + Post SI ---
  console.log('1.5 CreateAndPostSI (linked to DN)...');
  const siInput: any = {
    companyId: args.companyId,
    customerId: entities.acme,
    salesOrderId: so.id,
    deliveryNoteIds: [dn.id],
    warehouseId: entities.warehouse,
    invoiceDate: today,
    dueDate: today,
    currency: 'USD',
    exchangeRate: 1,
    source: 'native',
    persona: 'linked',
    lines: postedDN.lines.map((l: any) => ({
      dnLineId: l.lineId,
      soLineId: l.soLineId,
      itemId: l.itemId,
      invoicedQty: l.deliveredQty,
      unitPriceDoc: 15,
      taxCodeId: entities.taxCodeId,
      uom: l.uom,
    })),
    createdBy: args.userId,
  };
  const siResult = await sales.createAndPostSI.execute(siInput, undefined, undefined, actor);
  const si = (siResult as any).salesInvoice ?? siResult;
  console.log(`    ✓ SI ${si.invoiceNumber} created + POSTED`);
  console.log(`      grandTotalBase = ${si.grandTotalBase}`);
  console.log(`      voucherId = ${si.voucherId}`);
  console.log(`      cogsVoucherId = ${si.cogsVoucherId}`);

  return { so, dn, si };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs();
  console.log(`\nseed-audit-tenant — companyId=${args.companyId} stages=${args.stages.join(',')}\n`);

  const db = admin.firestore();
  const companyDoc = await db.collection('companies').doc(args.companyId).get();
  if (!companyDoc.exists) { console.error(`Company ${args.companyId} not found.`); process.exit(1); }
  console.log(`✓ Company: ${companyDoc.data()?.name}`);

  const rows = await loadAccounts(db, args.companyId);
  const accounts = resolveAccounts(rows);
  console.log(`✓ Resolved ${Object.keys(accounts).length} accounts`);

  const entities = await loadEntities(db, args.companyId);
  console.log(`✓ Loaded master data entity IDs (items, parties, warehouse, tax code)`);

  if (args.stages.includes(1)) await runStage1(args, entities, accounts);

  console.log('\n✅ done');
  process.exit(0);
}

main().catch((err) => {
  console.error('\nFATAL:', err?.stack || err?.message || err);
  process.exit(1);
});
