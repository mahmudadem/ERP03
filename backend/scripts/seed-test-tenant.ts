/**
 * seed-test-tenant.ts
 *
 * Seeds master data into an existing tenant so we can reproduce QA Findings
 * #2 / #4 (AR + Revenue ties) and confirm Finding #5 ("sell without OV/PI") is
 * working as designed.
 *
 * Prerequisite: user has already created the company in the UI and initialized
 * all 4 modules (Accounting + Inventory + Sales + Purchases). Accounting init
 * must have applied a COA template.
 *
 * Usage (from backend/):
 *   npx ts-node scripts/seed-test-tenant.ts --companyId <id> [--userId <uid>] [--dry-run] [--post-ov]
 *
 * Flags:
 *   --post-ov    Also POST the Opening Stock document via the real use case
 *                (proves DI wiring works in-script — required before adding
 *                SO/DN/SI/SR/RV/PV/JV in Phase 1b).
 *
 * What it seeds:
 *   - 1 default warehouse "WH-MAIN" if no warehouse exists yet
 *   - 1 sales tax code "TAX10" at 10% (linked to whichever account has "tax" in name)
 *   - 3 items:
 *       * WIDGET-A — PRODUCT, trackInventory=true, full account wiring (will get cost via OV)
 *       * WIDGET-B — PRODUCT, trackInventory=true, full account wiring (intentionally NO OV, cost=0)
 *       * SERVICE-A — SERVICE, no inventory tracking, revenue account only
 *   - 2 customers (ACME, GLOBEX) with defaultARAccountId set
 *   - 1 vendor (SUPPLIER-X) with defaultAPAccountId set
 *   - 1 DRAFT Opening Stock document: WIDGET-A, 100 units @ $10 unit cost
 *     (User must POST it through the UI to apply the journal entry.)
 *
 * Account auto-detection (by classification + name keyword):
 *   AR        = ASSET     + matches /accounts.receivable|receivable/i
 *   Revenue   = REVENUE   + matches /sales.revenue|revenue|sales/i  (first match)
 *   Inventory = ASSET     + matches /inventory|finished.goods/i
 *   COGS      = EXPENSE   + matches /cost.of.goods|cost.of.sales|cogs/i
 *   AP        = LIABILITY + matches /accounts.payable|payable/i
 *   Cash      = ASSET     + matches /cash|bank/i
 *   Tax       = LIABILITY + matches /tax.payable|vat|sales.tax/i
 *
 * If any required account fails to auto-detect, the script aborts and prints
 * the full account list so you can map them manually.
 */

process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';

import admin from '../src/firebaseAdmin';
import { randomUUID } from 'crypto';

type Args = {
  companyId: string;
  userId: string;
  dryRun: boolean;
  postOv: boolean;
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
  return {
    companyId,
    userId: get('userId') || 'seed-script',
    dryRun: argv.includes('--dry-run'),
    postOv: argv.includes('--post-ov'),
  };
}

type AccountRow = {
  id: string;
  code: string;
  name: string;
  classification: string;
  role?: string;
  active?: boolean;
};

type ResolvedAccounts = {
  ar: AccountRow;
  revenue: AccountRow;
  inventory: AccountRow;
  cogs: AccountRow;
  ap: AccountRow;
  cash: AccountRow;
  tax: AccountRow;
  openingEquity: AccountRow;
};

async function loadAccounts(db: FirebaseFirestore.Firestore, companyId: string): Promise<AccountRow[]> {
  const snap = await db
    .collection('companies').doc(companyId)
    .collection('accounting').doc('Data')
    .collection('accounts')
    .get();
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: data.id || d.id,
      code: data.code || '',
      name: data.name || '',
      classification: (data.classification || data.type || '').toString().toUpperCase(),
      role: data.role,
      active: data.active !== false,
    };
  });
}

function pickAccount(
  rows: AccountRow[],
  classification: string,
  patterns: RegExp[],
): AccountRow | null {
  const candidates = rows.filter((r) =>
    r.active &&
    (r.role || 'POSTING') === 'POSTING' &&
    r.classification === classification,
  );
  for (const re of patterns) {
    const hit = candidates.find((r) => re.test(r.name) || re.test(r.code));
    if (hit) return hit;
  }
  return null;
}

function resolveAccounts(rows: AccountRow[]): ResolvedAccounts {
  const ar       = pickAccount(rows, 'ASSET',     [/accounts?.receivable/i, /\breceivable\b/i]);
  const revenue  = pickAccount(rows, 'REVENUE',   [/sales\s*revenue/i, /\brevenue\b/i, /\bsales\b/i]);
  const inventory= pickAccount(rows, 'ASSET',     [/finished\s*goods/i, /\binventory\b/i]);
  const cogs     = pickAccount(rows, 'EXPENSE',   [/cost\s*of\s*goods/i, /cost\s*of\s*sales/i, /\bcogs\b/i]);
  const ap       = pickAccount(rows, 'LIABILITY', [/accounts?.payable/i, /\bpayable\b/i]);
  const cash     = pickAccount(rows, 'ASSET',     [/cash\s*on\s*hand/i, /\bcash\b/i, /\bbank\b/i]);
  const tax      = pickAccount(rows, 'LIABILITY', [/sales\s*tax\s*payable/i, /\bvat\s*payable\b/i, /\btax\s*payable\b/i, /\bvat\b/i, /\btax\b/i]);
  const openingEquity = pickAccount(rows, 'EQUITY', [/opening\s*balance\s*equity/i, /opening\s*equity/i, /paid.?in\s*capital/i, /owner.*capital/i, /retained\s*earnings/i, /capital/i]);

  const missing: string[] = [];
  if (!ar) missing.push('ar (ASSET, name like "Accounts Receivable")');
  if (!revenue) missing.push('revenue (REVENUE, name like "Sales Revenue")');
  if (!inventory) missing.push('inventory (ASSET, name like "Inventory")');
  if (!cogs) missing.push('cogs (EXPENSE, name like "Cost of Goods Sold")');
  if (!ap) missing.push('ap (LIABILITY, name like "Accounts Payable")');
  if (!cash) missing.push('cash (ASSET, name like "Cash")');
  if (!tax) missing.push('tax (LIABILITY, name like "Sales Tax Payable")');
  if (!openingEquity) missing.push('openingEquity (EQUITY, name like "Paid-in Capital" or "Opening Balance Equity")');

  if (missing.length > 0) {
    console.error('\n❌ Could not auto-detect these accounts:\n  - ' + missing.join('\n  - '));
    console.error('\nAvailable POSTING accounts:');
    for (const r of rows.filter((x) => x.active && (x.role || 'POSTING') === 'POSTING')) {
      console.error(`  [${r.classification.padEnd(9)}] ${r.code.padEnd(10)} ${r.name}`);
    }
    console.error('\nFix the COA (or extend pickAccount patterns) and retry.');
    process.exit(1);
  }
  return { ar: ar!, revenue: revenue!, inventory: inventory!, cogs: cogs!, ap: ap!, cash: cash!, tax: tax!, openingEquity: openingEquity! };
}

async function seedWarehouse(
  db: FirebaseFirestore.Firestore,
  companyId: string,
  userId: string,
  dryRun: boolean,
): Promise<string> {
  const col = db.collection('companies').doc(companyId)
    .collection('inventory').doc('Data').collection('warehouses');

  const existing = await col.limit(1).get();
  if (!existing.empty) {
    const wh = existing.docs[0].data();
    const id = wh.id || existing.docs[0].id;
    console.log(`✓ Warehouse exists: ${wh.code || wh.name || id}`);
    return id;
  }

  const id = randomUUID();
  const now = new Date();
  const doc = {
    id,
    companyId,
    code: 'WH-MAIN',
    name: 'Main Warehouse',
    active: true,
    isDefault: true,
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
  };
  if (!dryRun) await col.doc(id).set(doc);
  console.log(`+ Warehouse WH-MAIN${dryRun ? ' (dry-run)' : ''}`);
  return id;
}

async function seedTaxCode(
  db: FirebaseFirestore.Firestore,
  companyId: string,
  userId: string,
  taxAccount: AccountRow,
  dryRun: boolean,
): Promise<string> {
  const col = db.collection('companies').doc(companyId)
    .collection('shared').doc('Data').collection('tax_codes');

  // Idempotency: skip if TAX10 already exists
  const existing = await col.where('code', '==', 'TAX10').limit(1).get();
  if (!existing.empty) {
    const data = existing.docs[0].data();
    const id = data.id || existing.docs[0].id;
    console.log(`✓ Tax code TAX10 exists (id=${id.slice(0, 8)}...)`);
    return id;
  }

  const id = randomUUID();
  const now = new Date();
  const doc = {
    id,
    companyId,
    code: 'TAX10',
    name: '10% Sales Tax',
    rate: 0.10,
    type: 'SALES',
    accountId: taxAccount.id,
    salesAccountId: taxAccount.id,
    purchaseAccountId: taxAccount.id,
    active: true,
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
  };
  if (!dryRun) await col.doc(id).set(doc);
  console.log(`+ Tax code TAX10 → ${taxAccount.code} ${taxAccount.name}${dryRun ? ' (dry-run)' : ''}`);
  return id;
}

async function seedItems(
  db: FirebaseFirestore.Firestore,
  companyId: string,
  userId: string,
  accounts: ResolvedAccounts,
  taxCodeId: string,
  dryRun: boolean,
): Promise<{ widgetA: string; widgetB: string; serviceA: string }> {
  const col = db.collection('companies').doc(companyId)
    .collection('inventory').doc('Data').collection('items');
  const now = new Date();

  // Idempotency: reuse existing ids when codes already present
  const existingSnap = await col.where('code', 'in', ['WIDGET-A', 'WIDGET-B', 'SERVICE-A']).get();
  const existingByCode = new Map<string, string>();
  existingSnap.docs.forEach((d) => {
    const data = d.data();
    existingByCode.set(data.code, data.id || d.id);
  });

  const widgetA = existingByCode.get('WIDGET-A') || randomUUID();
  const widgetB = existingByCode.get('WIDGET-B') || randomUUID();
  const serviceA = existingByCode.get('SERVICE-A') || randomUUID();

  const productBase = (id: string, code: string, name: string) => ({
    id,
    companyId,
    code,
    name,
    description: `Seeded by seed-test-tenant.ts — ${name}`,
    type: 'PRODUCT' as const,
    baseUom: 'PCS',
    costCurrency: 'USD',
    costingMethod: 'MOVING_AVG' as const,
    trackInventory: true,
    revenueAccountId: accounts.revenue.id,
    cogsAccountId: accounts.cogs.id,
    inventoryAssetAccountId: accounts.inventory.id,
    defaultSalesTaxCodeId: taxCodeId,
    active: true,
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
  });

  const items = [
    productBase(widgetA, 'WIDGET-A', 'Widget A (will get cost basis via OV)'),
    productBase(widgetB, 'WIDGET-B', 'Widget B (no OV — cost stays at 0)'),
    {
      id: serviceA,
      companyId,
      code: 'SERVICE-A',
      name: 'Consulting Service',
      type: 'SERVICE' as const,
      baseUom: 'HRS',
      costCurrency: 'USD',
      costingMethod: 'MOVING_AVG' as const,
      trackInventory: false,
      revenueAccountId: accounts.revenue.id,
      defaultSalesTaxCodeId: taxCodeId,
      active: true,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    },
  ];

  for (const item of items) {
    const isExisting = existingByCode.has(item.code);
    if (!dryRun) await col.doc(item.id).set(item, { merge: true });
    console.log(`${isExisting ? '✓' : '+'} Item ${item.code} (${item.type})${dryRun ? ' (dry-run)' : isExisting ? ' (reused)' : ''}`);
  }
  return { widgetA, widgetB, serviceA };
}

async function seedParties(
  db: FirebaseFirestore.Firestore,
  companyId: string,
  userId: string,
  accounts: ResolvedAccounts,
  dryRun: boolean,
): Promise<{ customerIds: string[]; vendorIds: string[] }> {
  const col = db.collection('companies').doc(companyId)
    .collection('shared').doc('Data').collection('parties');
  const now = new Date();

  // Idempotency: reuse existing ids when codes already present
  const existingSnap = await col.where('code', 'in', ['ACME', 'GLOBEX', 'SUPPLIER-X']).get();
  const existingByCode = new Map<string, string>();
  existingSnap.docs.forEach((d) => {
    const data = d.data();
    existingByCode.set(data.code, data.id || d.id);
  });

  const acme = existingByCode.get('ACME') || randomUUID();
  const globex = existingByCode.get('GLOBEX') || randomUUID();
  const supplierX = existingByCode.get('SUPPLIER-X') || randomUUID();

  const customers = [
    {
      id: acme,
      companyId,
      code: 'ACME',
      legalName: 'ACME Corporation',
      displayName: 'ACME Corp',
      roles: ['CUSTOMER'],
      paymentTermsDays: 30,
      defaultCurrency: 'USD',
      defaultARAccountId: accounts.ar.id,
      creditHoldPolicy: 'NONE',
      active: true,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: globex,
      companyId,
      code: 'GLOBEX',
      legalName: 'Globex Industries',
      displayName: 'Globex',
      roles: ['CUSTOMER'],
      paymentTermsDays: 15,
      defaultCurrency: 'USD',
      defaultARAccountId: accounts.ar.id,
      creditHoldPolicy: 'NONE',
      active: true,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    },
  ];

  const vendors = [
    {
      id: supplierX,
      companyId,
      code: 'SUPPLIER-X',
      legalName: 'Supplier X Ltd',
      displayName: 'Supplier X',
      roles: ['VENDOR'],
      paymentTermsDays: 30,
      defaultCurrency: 'USD',
      defaultAPAccountId: accounts.ap.id,
      active: true,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    },
  ];

  for (const p of [...customers, ...vendors]) {
    const isExisting = existingByCode.has(p.code);
    if (!dryRun) await col.doc(p.id).set(p, { merge: true });
    console.log(`${isExisting ? '✓' : '+'} Party ${p.code} (${p.roles.join('/')})${dryRun ? ' (dry-run)' : isExisting ? ' (reused)' : ''}`);
  }

  return {
    customerIds: [acme, globex],
    vendorIds: [supplierX],
  };
}

async function seedOpeningStockDraft(
  db: FirebaseFirestore.Firestore,
  companyId: string,
  userId: string,
  warehouseId: string,
  widgetAItemId: string,
  openingBalanceAccountId: string,
  dryRun: boolean,
): Promise<string> {
  const col = db.collection('companies').doc(companyId)
    .collection('inventory').doc('Data').collection('opening_stock_documents');

  // Idempotency: reuse the first DRAFT seed OV if one already exists.
  // (POSTED ones are immutable — leave alone.)
    const existing = await col.where('seedTag', '==', 'seed-test-tenant').get();
  const draft = existing.docs.find((d) => d.data().status === 'DRAFT');
  if (draft) {
    const data = draft.data();
    const id = data.id || draft.id;
    console.log(`✓ OV draft exists (id=${id.slice(0, 8)}...) — reusing`);
    return id;
  }

  const id = randomUUID();
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  const line = {
    lineId: randomUUID(),
    itemId: widgetAItemId,
    quantity: 100,
    unitCostInMoveCurrency: 10,
    moveCurrency: 'USD',
    fxRateMovToBase: 1,
    fxRateCCYToBase: 1,
    unitCostBase: 10,
    totalValueBase: 1000,
  };

  const doc = {
    id,
    companyId,
    warehouseId,
    date: today,
    notes: 'Seeded OV - establishes cost basis for WIDGET-A. Post via UI.',
    lines: [line],
    status: 'DRAFT',
    createAccountingEffect: true,
    openingBalanceAccountId,
    totalValueBase: 1000,
    seedTag: 'seed-test-tenant',
    createdBy: userId,
    createdAt: now,
  };

  if (!dryRun) await col.doc(id).set(doc);
  console.log(`+ Opening Stock DRAFT (WIDGET-A, 100 @ $10)${dryRun ? ' (dry-run)' : ''}`);
  console.log('  → Post this through the UI to apply journals.');
  return id;
}

/**
 * Post the Opening Stock document via the real PostOpeningStockDocumentUseCase.
 * Imports DI lazily so the rest of the script (master data seeding) can run
 * without any backend wiring overhead when --post-ov is not set.
 */
async function postOpeningStockViaUseCase(
  companyId: string,
  ovDocId: string,
  userId: string,
): Promise<void> {
  console.log('\n— Posting Opening Stock via use case —');

  // Lazy imports so the rest of the script doesn't pull the full backend.
  const { diContainer } = await import('../src/infrastructure/di/bindRepositories');
  const { PostOpeningStockDocumentUseCase } = await import(
    '../src/application/inventory/use-cases/OpeningStockDocumentUseCases'
  );
  const { RecordStockMovementUseCase } = await import(
    '../src/application/inventory/use-cases/RecordStockMovementUseCase'
  );
  const { SubledgerVoucherPostingService } = await import(
    '../src/application/accounting/services/SubledgerVoucherPostingService'
  );
  const { VoucherValidationService } = await import(
    '../src/domain/accounting/services/VoucherValidationService'
  );

  const movementUseCase = new RecordStockMovementUseCase({
    itemRepository: diContainer.itemRepository,
    warehouseRepository: diContainer.warehouseRepository,
    stockMovementRepository: diContainer.stockMovementRepository,
    stockLevelRepository: diContainer.stockLevelRepository,
    companyRepository: diContainer.companyRepository,
    inventorySettingsRepository: diContainer.inventorySettingsRepository,
    transactionManager: diContainer.transactionManager,
  });

  const accountingPostingService = new SubledgerVoucherPostingService(
    diContainer.voucherRepository,
    diContainer.ledgerRepository,
    diContainer.companyCurrencyRepository,
    diContainer.accountRepository,
    new VoucherValidationService(),
  );

  const useCase = new PostOpeningStockDocumentUseCase(
    diContainer.openingStockDocumentRepository,
    diContainer.itemRepository,
    diContainer.itemCategoryRepository,
    diContainer.warehouseRepository,
    diContainer.inventorySettingsRepository,
    diContainer.companyRepository,
    diContainer.companyModuleRepository,
    diContainer.accountRepository,
    movementUseCase,
    accountingPostingService,
    diContainer.transactionManager,
  );

  const posted = await useCase.execute(companyId, ovDocId, userId);
  console.log(`✓ OV ${ovDocId} POSTED (voucherId=${posted.voucherId || 'n/a'})`);
  console.log(`  Total value posted: ${posted.totalValueBase}`);
  console.log('  Expected GL impact:');
  console.log('    DR Inventory      = 1000.00');
  console.log('    CR Opening Equity = 1000.00');
}

async function main() {
  const args = parseArgs();
  console.log(`\nseed-test-tenant — companyId=${args.companyId} userId=${args.userId} dryRun=${args.dryRun}\n`);

  const db = admin.firestore();

  // 1. Verify company exists
  const companyDoc = await db.collection('companies').doc(args.companyId).get();
  if (!companyDoc.exists) {
    console.error(`ERROR: Company ${args.companyId} not found in Firestore.`);
    process.exit(1);
  }
  console.log(`✓ Company found: ${companyDoc.data()?.name || args.companyId}`);

  // 2. Load + resolve accounts
  const rows = await loadAccounts(db, args.companyId);
  if (rows.length === 0) {
    console.error('ERROR: No accounts found. Did you initialize Accounting with a COA template?');
    process.exit(1);
  }
  console.log(`✓ Loaded ${rows.length} accounts from COA`);
  const accounts = resolveAccounts(rows);
  console.log('  Resolved:');
  console.log(`    AR        = ${accounts.ar.code} ${accounts.ar.name}`);
  console.log(`    Revenue   = ${accounts.revenue.code} ${accounts.revenue.name}`);
  console.log(`    Inventory = ${accounts.inventory.code} ${accounts.inventory.name}`);
  console.log(`    COGS      = ${accounts.cogs.code} ${accounts.cogs.name}`);
  console.log(`    AP        = ${accounts.ap.code} ${accounts.ap.name}`);
  console.log(`    Cash      = ${accounts.cash.code} ${accounts.cash.name}`);
  console.log(`    Tax       = ${accounts.tax.code} ${accounts.tax.name}`);
  console.log('');

  // 3. Seed
  const warehouseId = await seedWarehouse(db, args.companyId, args.userId, args.dryRun);
  const taxCodeId = await seedTaxCode(db, args.companyId, args.userId, accounts.tax, args.dryRun);
  const items = await seedItems(db, args.companyId, args.userId, accounts, taxCodeId, args.dryRun);
  await seedParties(db, args.companyId, args.userId, accounts, args.dryRun);
  const ovId = await seedOpeningStockDraft(
    db,
    args.companyId,
    args.userId,
    warehouseId,
    items.widgetA,
    accounts.openingEquity.id,  // CR side: equity, not inventory
    args.dryRun,
  );

  if (args.postOv && !args.dryRun) {
    try {
      await postOpeningStockViaUseCase(args.companyId, ovId, args.userId);
    } catch (err: any) {
      console.error('\n❌ OV posting failed:', err?.message || err);
      console.error('   The OV doc was created as DRAFT. You can retry by re-running with --post-ov,');
      console.error('   or post it through the UI. Master data seeding above is unaffected.');
      throw err;
    }
  }

  console.log(`\n${args.dryRun ? '(dry-run complete — nothing was written)' : '✅ Seed complete.'}\n`);
  console.log('Next steps:');
  if (!args.postOv) {
    console.log('  1. Open the Opening Stock document in the UI and POST it (sets cost basis for WIDGET-A).');
    console.log('     OR: re-run with --post-ov to post via the use case in-script.');
  } else {
    console.log('  1. ✓ OV posted via use case — cost basis for WIDGET-A is now $10.');
  }
  console.log('  2. Create a few Sales Invoices through the UI:');
  console.log('     - One with WIDGET-A only → has cost basis, COGS will post normally.');
  console.log('     - One with WIDGET-B only → no cost basis, COGS will post as 0 (the by-design path).');
  console.log('     - One with SERVICE-A → no inventory, revenue only.');
  console.log('  3. Run: npx ts-node scripts/verify-gl-tie.ts --companyId ' + args.companyId);
}

main().catch((err) => {
  console.error('\nFATAL:', err);
  process.exit(1);
});
