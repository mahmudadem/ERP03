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
  console.log('    DR COGS           50.00  (5 × $10 cost, posted at DN time)');
  console.log('    CR Inventory      50.00');
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
// Stage 2 — Direct SI (no SO, no DN)
// ---------------------------------------------------------------------------

async function ensureDirectPersonaAllowed(db: FirebaseFirestore.Firestore, companyId: string) {
  const settingsRef = db.collection('companies').doc(companyId).collection('sales').doc('settings');
  const snap = await settingsRef.get();
  const data = snap.data() || {};
  const rules: any[] = data.governanceRules || [];
  const hasDirectAllow = rules.some(
    (r: any) => r.persona === 'direct' && r.scope === 'company' && r.action === 'allow'
  );
  if (!hasDirectAllow) {
    rules.push({ id: 'seed-direct-allow', persona: 'direct', scope: 'company', action: 'allow' });
    await settingsRef.set({ governanceRules: rules }, { merge: true });
    console.log('  (added governance rule: allow direct SI)');
  }
}

async function runStage2(args: Args, entities: EntityIds, accounts: Resolved) {
  console.log('\n=== STAGE 2: Direct SI (no SO, no DN) ===');
  console.log('  Customer: GLOBEX');
  console.log('  Item: WIDGET-A × 3 @ $20 + 10% tax');
  console.log('  Expected GL on SI post:');
  console.log('    DR AR             66.00');
  console.log('    CR Revenue        60.00');
  console.log('    CR Tax (VAT)       6.00');
  console.log('    DR COGS           30.00  (3 × $10 cost)');
  console.log('    CR Inventory      30.00');
  console.log('');

  const db = admin.firestore();
  await ensureDirectPersonaAllowed(db, args.companyId);

  const sales = await buildSalesUseCases();
  const actor = { userId: args.userId, userEmail: 'audit@script.local' };
  const today = new Date().toISOString().slice(0, 10);

  console.log('2.1 CreateAndPostSI (direct, no SO)...');
  const siInput: any = {
    companyId: args.companyId,
    customerId: entities.globex,
    warehouseId: entities.warehouse,
    invoiceDate: today,
    dueDate: today,
    currency: 'USD',
    exchangeRate: 1,
    source: 'native',
    persona: 'direct',
    voucherType: 'sales_invoice',
    lines: [
      {
        itemId: entities.widgetA,
        invoicedQty: 3,
        unitPriceDoc: 20,
        taxCodeId: entities.taxCodeId,
        uom: 'PCS',
        warehouseId: entities.warehouse,
      },
    ],
    createdBy: args.userId,
  };
  const siResult = await sales.createAndPostSI.execute(siInput, undefined, undefined, actor);
  const si = (siResult as any).salesInvoice ?? siResult;
  console.log(`    ✓ SI ${si.invoiceNumber} created + POSTED`);
  console.log(`      grandTotalBase = ${si.grandTotalBase}`);
  console.log(`      voucherId = ${si.voucherId}`);
  console.log(`      cogsVoucherId = ${si.cogsVoucherId}`);

  return { si };
}

// ---------------------------------------------------------------------------
// Stage 3 — Sales Return (credit note against Stage 2 direct SI)
// ---------------------------------------------------------------------------

async function buildSalesReturnUseCases() {
  const { diContainer } = await import('../src/infrastructure/di/bindRepositories');
  const { CreateSalesReturnUseCase, PostSalesReturnUseCase } = await import('../src/application/sales/use-cases/SalesReturnUseCases');
  const { RecordStockMovementUseCase } = await import('../src/application/inventory/use-cases/RecordStockMovementUseCase');
  const { SubledgerVoucherPostingService } = await import('../src/application/accounting/services/SubledgerVoucherPostingService');
  const { VoucherValidationService } = await import('../src/domain/accounting/services/VoucherValidationService');
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

  const createSR = new CreateSalesReturnUseCase(
    diContainer.salesSettingsRepository,
    diContainer.salesReturnRepository,
    diContainer.salesInvoiceRepository,
    diContainer.deliveryNoteRepository,
    recordChangeService,
    diContainer.companyCurrencyRepository,
  );

  const postSR = new PostSalesReturnUseCase(
    diContainer.salesSettingsRepository,
    diContainer.inventorySettingsRepository,
    diContainer.salesReturnRepository,
    diContainer.salesInvoiceRepository,
    diContainer.deliveryNoteRepository,
    diContainer.salesOrderRepository,
    diContainer.partyRepository,
    diContainer.taxCodeRepository,
    diContainer.itemRepository,
    diContainer.itemCategoryRepository,
    diContainer.uomConversionRepository,
    diContainer.companyCurrencyRepository,
    inventoryService,
    diContainer.companyModuleRepository,
    accountingPostingService,
    diContainer.accountRepository,
    diContainer.transactionManager,
    recordChangeService,
    diContainer.postingLogRepository,
  );

  return { createSR, postSR };
}

async function runStage3(args: Args, entities: EntityIds, accounts: Resolved, stage2Si: any) {
  console.log('\n=== STAGE 3: Sales Return (credit note against Stage 2 SI) ===');
  console.log('  Returning 1 × WIDGET-A from the $20 direct SI');
  console.log('  Expected GL on SR post:');
  console.log('    CR AR             22.00  (reverse: 20 + 2 tax)');
  console.log('    DR Revenue        20.00');
  console.log('    DR Tax (VAT)       2.00');
  console.log('    CR COGS           10.00  (1 × $10 cost reversal)');
  console.log('    DR Inventory      10.00');
  console.log('');

  const srUseCases = await buildSalesReturnUseCases();
  const actor = { userId: args.userId, userEmail: 'audit@script.local' };
  const today = new Date().toISOString().slice(0, 10);

  console.log('3.1 CreateSalesReturn (AFTER_INVOICE)...');
  const srInput: any = {
    companyId: args.companyId,
    salesInvoiceId: stage2Si.id,
    returnDate: today,
    warehouseId: entities.warehouse,
    settlementMode: 'CREDIT_NOTE',
    reasonCode: 'DEFECTIVE',
    reason: 'Seed audit: testing credit note reversal',
    lines: [
      {
        siLineId: stage2Si.lines[0]?.lineId,
        itemId: entities.widgetA,
        returnQty: 1,
        unitPriceDoc: 20,
        taxCodeId: entities.taxCodeId,
        uom: 'PCS',
      },
    ],
    createdBy: args.userId,
  };
  const sr = await srUseCases.createSR.execute(srInput, actor);
  console.log(`    ✓ SR ${sr.returnNumber} created (id=${sr.id.slice(0, 8)}...)`);

  console.log('3.2 PostSalesReturn...');
  const postedSR = await srUseCases.postSR.execute(args.companyId, sr.id, true, undefined, actor);
  console.log(`    ✓ SR ${postedSR.returnNumber} POSTED`);
  console.log(`      revenueVoucherId = ${postedSR.revenueVoucherId}`);
  console.log(`      cogsVoucherId = ${postedSR.cogsVoucherId}`);

  return { sr: postedSR };
}

// ---------------------------------------------------------------------------
// Stage 4 — RV (receipt voucher) + PV (payment voucher) + JV (journal)
// ---------------------------------------------------------------------------

async function buildAccountingUseCases() {
  const { diContainer } = await import('../src/infrastructure/di/bindRepositories');
  const { CreateVoucherUseCase, PostVoucherUseCase } = await import('../src/application/accounting/use-cases/VoucherUseCases');
  const { AccountValidationService } = await import('../src/application/accounting/services/AccountValidationService');

  // Seed scripts run outside auth — use a stub that always allows
  const alwaysAllowChecker = { assertOrThrow: async () => {}, hasPermission: async () => true } as any;

  const createVoucher = new CreateVoucherUseCase(
    diContainer.voucherRepository,
    diContainer.accountRepository,
    diContainer.companyModuleSettingsRepository,
    alwaysAllowChecker,
    diContainer.transactionManager,
    diContainer.voucherTypeDefinitionRepository,
    diContainer.accountingPolicyConfigProvider,
    diContainer.ledgerRepository,
    undefined, // policyRegistry
    diContainer.companyCurrencyRepository,
    diContainer.voucherSequenceRepository,
  );

  const accountValidationService = new AccountValidationService(diContainer.accountRepository);
  const postVoucher = new PostVoucherUseCase(
    diContainer.voucherRepository,
    diContainer.ledgerRepository,
    alwaysAllowChecker,
    diContainer.transactionManager,
    accountValidationService,
  );

  return { createVoucher, postVoucher };
}

async function runStage4(args: Args, entities: EntityIds, accounts: Resolved) {
  console.log('\n=== STAGE 4: RV + PV + JV accounting vouchers ===');
  const today = new Date().toISOString().slice(0, 10);
  const acctUC = await buildAccountingUseCases();

  // ---- 4a: Receipt Voucher — ACME pays $50 on account ----
  console.log('\n--- 4a: Receipt Voucher (ACME pays $50) ---');
  console.log('  Expected GL:');
  console.log('    DR Cash            50.00');
  console.log('    CR AR              50.00');

  const rv = await acctUC.createVoucher.execute(args.companyId, args.userId, {
    type: 'receipt',
    date: today,
    currency: 'USD',
    exchangeRate: 1,
    notes: 'Seed audit: ACME receipt on account',
    lines: [
      { accountId: accounts.ar.id, side: 'Credit', amount: 50 },
      { accountId: accounts.cash.id, side: 'Debit', amount: 50 },
    ],
  });
  console.log(`    ✓ RV ${rv.voucherNo} created (id=${rv.id.slice(0, 8)}...)`);

  await acctUC.postVoucher.execute(args.companyId, args.userId, rv.id);
  console.log(`    ✓ RV ${rv.voucherNo} POSTED`);

  // ---- 4b: Payment Voucher — Pay vendor $25 ----
  console.log('\n--- 4b: Payment Voucher (pay vendor $25) ---');
  console.log('  Expected GL:');
  console.log('    DR AP              25.00');
  console.log('    CR Cash            25.00');

  const pv = await acctUC.createVoucher.execute(args.companyId, args.userId, {
    type: 'payment',
    date: today,
    currency: 'USD',
    exchangeRate: 1,
    notes: 'Seed audit: pay SUPPLIER-X on account',
    lines: [
      { accountId: accounts.ap.id, side: 'Debit', amount: 25 },
      { accountId: accounts.cash.id, side: 'Credit', amount: 25 },
    ],
  });
  console.log(`    ✓ PV ${pv.voucherNo} created (id=${pv.id.slice(0, 8)}...)`);

  await acctUC.postVoucher.execute(args.companyId, args.userId, pv.id);
  console.log(`    ✓ PV ${pv.voucherNo} POSTED`);

  // ---- 4c: Journal Voucher — Reclassify $15 expense ----
  console.log('\n--- 4c: Journal Voucher (reclassify $15 COGS→Revenue contra) ---');
  console.log('  Expected GL:');
  console.log('    DR Revenue         15.00');
  console.log('    CR COGS            15.00');

  const jv = await acctUC.createVoucher.execute(args.companyId, args.userId, {
    type: 'journal_entry',
    date: today,
    currency: 'USD',
    exchangeRate: 1,
    notes: 'Seed audit: JV reclassification test',
    lines: [
      { accountId: accounts.revenue.id, side: 'Debit', amount: 15 },
      { accountId: accounts.cogs.id, side: 'Credit', amount: 15 },
    ],
  });
  console.log(`    ✓ JV ${jv.voucherNo} created (id=${jv.id.slice(0, 8)}...)`);

  await acctUC.postVoucher.execute(args.companyId, args.userId, jv.id);
  console.log(`    ✓ JV ${jv.voucherNo} POSTED`);

  return { rv, pv, jv };
}

// ---------------------------------------------------------------------------
// Expected totals computation + output
// ---------------------------------------------------------------------------

function computeExpectedBalances(accounts: Resolved) {
  // Cumulative DR/CR effects across all stages:
  //
  // OV (pre-existing):
  //   DR Inventory      1000    CR OpeningEquity  1000
  //
  // Stage 1 (SO→DN→SI): 5 × WIDGET-A @ $15, 10% tax, cost=$10
  //   SI:  DR AR 82.50, CR Revenue 75, CR Tax 7.50
  //   COGS: DR COGS 50, CR Inventory 50
  //
  // Stage 2 (Direct SI): 3 × WIDGET-A @ $20, 10% tax, cost=$10
  //   SI:  DR AR 66, CR Revenue 60, CR Tax 6
  //   COGS: DR COGS 30, CR Inventory 30
  //
  // Stage 3 (SR against Stage 2): return 1 × WIDGET-A @ $20
  //   Reverse: CR AR 22, DR Revenue 20, DR Tax 2
  //   COGS reverse: CR COGS 10, DR Inventory 10
  //
  // Stage 4a (RV): DR Cash 50, CR AR 50
  // Stage 4b (PV): DR AP 25, CR Cash 25
  // Stage 4c (JV): DR Revenue 15, CR COGS 15

  const balances: Record<string, { accountId: string; code: string; name: string; debit: number; credit: number; net: number }> = {};

  const add = (key: string, acc: AccountRow, dr: number, cr: number) => {
    if (!balances[key]) balances[key] = { accountId: acc.id, code: acc.code, name: acc.name, debit: 0, credit: 0, net: 0 };
    balances[key].debit += dr;
    balances[key].credit += cr;
    balances[key].net = +(balances[key].debit - balances[key].credit).toFixed(2);
  };

  // OV
  add('inventory', accounts.inventory, 1000, 0);
  add('openingEquity', accounts.openingEquity, 0, 1000);

  // Stage 1
  add('ar', accounts.ar, 82.50, 0);
  add('revenue', accounts.revenue, 0, 75);
  add('tax', accounts.tax, 0, 7.50);
  add('cogs', accounts.cogs, 50, 0);
  add('inventory', accounts.inventory, 0, 50);

  // Stage 2
  add('ar', accounts.ar, 66, 0);
  add('revenue', accounts.revenue, 0, 60);
  add('tax', accounts.tax, 0, 6);
  add('cogs', accounts.cogs, 30, 0);
  add('inventory', accounts.inventory, 0, 30);

  // Stage 3 (reversal)
  add('ar', accounts.ar, 0, 22);
  add('revenue', accounts.revenue, 20, 0);
  add('tax', accounts.tax, 2, 0);
  add('cogs', accounts.cogs, 0, 10);
  add('inventory', accounts.inventory, 10, 0);

  // Stage 4a (RV)
  add('cash', accounts.cash, 50, 0);
  add('ar', accounts.ar, 0, 50);

  // Stage 4b (PV)
  add('ap', accounts.ap, 25, 0);
  add('cash', accounts.cash, 0, 25);

  // Stage 4c (JV)
  add('revenue', accounts.revenue, 15, 0);
  add('cogs', accounts.cogs, 0, 15);

  return balances;
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

  // Track results across stages for cross-stage dependencies
  let stage2Si: any = null;

  if (args.stages.includes(1)) await runStage1(args, entities, accounts);

  if (args.stages.includes(2)) {
    const result = await runStage2(args, entities, accounts);
    stage2Si = result.si;
  }

  if (args.stages.includes(3)) {
    if (!stage2Si) {
      // Stage 3 depends on Stage 2's SI — look it up if not run in this session
      console.log('\n  (looking up latest direct SI for Stage 3...)');
      const siSnap = await db.collection('companies').doc(args.companyId)
        .collection('sales').doc('Data').collection('sales_invoices')
        .where('status', '==', 'POSTED')
        .where('customerId', '==', entities.globex)
        .limit(1).get();
      if (siSnap.empty) {
        console.error('ERROR: No posted SI for GLOBEX found — run Stage 2 first.');
        process.exit(1);
      }
      stage2Si = { id: siSnap.docs[0].id, ...siSnap.docs[0].data() };
    }
    await runStage3(args, entities, accounts, stage2Si);
  }

  if (args.stages.includes(4)) await runStage4(args, entities, accounts);

  // Print expected balances summary
  if (args.stages.includes(1) || args.stages.includes(4)) {
    const expected = computeExpectedBalances(accounts);
    console.log('\n=== EXPECTED ACCOUNT BALANCES (all stages) ===');
    console.log('  Account'.padEnd(45) + 'DR'.padStart(12) + 'CR'.padStart(12) + 'Net'.padStart(12));
    console.log('  ' + '-'.repeat(77));
    let totalDR = 0, totalCR = 0;
    for (const [, b] of Object.entries(expected)) {
      console.log(`  ${(b.code + ' ' + b.name).padEnd(43)} ${b.debit.toFixed(2).padStart(12)} ${b.credit.toFixed(2).padStart(12)} ${b.net.toFixed(2).padStart(12)}`);
      totalDR += b.debit;
      totalCR += b.credit;
    }
    console.log('  ' + '-'.repeat(77));
    console.log(`  ${'TOTAL'.padEnd(43)} ${totalDR.toFixed(2).padStart(12)} ${totalCR.toFixed(2).padStart(12)} ${(totalDR - totalCR).toFixed(2).padStart(12)}`);

    // Write expected-balances.json for the verify script
    const fs = await import('fs');
    const path = await import('path');
    const outPath = path.join(__dirname, 'expected-balances.json');
    fs.writeFileSync(outPath, JSON.stringify(expected, null, 2));
    console.log(`\n  Written: ${outPath}`);
  }

  console.log('\n✅ done');
  process.exit(0);
}

main().catch((err) => {
  console.error('\nFATAL:', err?.stack || err?.message || err);
  process.exit(1);
});
