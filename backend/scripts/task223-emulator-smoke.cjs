/**
 * Task 223 — Inventory Revaluation (value-only cost correction) round-trip.
 *
 * Validates the end-to-end posting path against the live Firestore emulator:
 *   1. Seed a fresh company, item, warehouse, and inventory settings.
 *   2. Seed an opening stock movement (drives the sub-ledger avg cost).
 *   3. Create + post an Inventory Revaluation that writes up the item's avg cost.
 *   4. Assert: revaluation is POSTED with a voucher, the sub-ledger level
 *      carries the new average cost, the item's costing-stats avgCost moved,
 *      the GL voucher is balanced, and the dedicated inventory account
 *      moves by the valueDelta (sub-ledger and GL now match).
 *   5. Repeat the loop for a write-DOWN revaluation and verify GL goes the
 *      other way (Dr Revaluation / Cr Inventory).
 */
const admin = require('firebase-admin');

process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'erp-03';
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';

const { InventoryRevaluation } = require('../lib/backend/src/domain/inventory/entities/InventoryRevaluation');
const { InventorySettings } = require('../lib/backend/src/domain/inventory/entities/InventorySettings');
const { Item } = require('../lib/backend/src/domain/inventory/entities/Item');
const { Warehouse } = require('../lib/backend/src/domain/inventory/entities/Warehouse');
const { StockLevel } = require('../lib/backend/src/domain/inventory/entities/StockLevel');
const { StockMovement } = require('../lib/backend/src/domain/inventory/entities/StockMovement');
const { FirestoreTransactionManager } = require('../lib/backend/src/infrastructure/firestore/transaction/FirestoreTransactionManager');
const { FirestoreInventoryRevaluationRepository } = require('../lib/backend/src/infrastructure/firestore/repositories/inventory/FirestoreInventoryRevaluationRepository');
const { FirestoreInventorySettingsRepository } = require('../lib/backend/src/infrastructure/firestore/repositories/inventory/FirestoreInventorySettingsRepository');
const { FirestoreItemRepository } = require('../lib/backend/src/infrastructure/firestore/repositories/inventory/FirestoreItemRepository');
const { FirestoreWarehouseRepository } = require('../lib/backend/src/infrastructure/firestore/repositories/inventory/FirestoreWarehouseRepository');
const { FirestoreStockLevelRepository } = require('../lib/backend/src/infrastructure/firestore/repositories/inventory/FirestoreStockLevelRepository');
const { FirestoreStockMovementRepository } = require('../lib/backend/src/infrastructure/firestore/repositories/inventory/FirestoreStockMovementRepository');
const { FirestoreCompanyModuleRepository } = require('../lib/backend/src/infrastructure/firestore/repositories/company/FirestoreCompanyModuleRepository');
const { CreateInventoryRevaluationUseCase, PostInventoryRevaluationUseCase } = require('../lib/backend/src/application/inventory/use-cases/InventoryRevaluationUseCases');
const { SubledgerVoucherPostingService } = require('../lib/backend/src/application/accounting/services/SubledgerVoucherPostingService');
const { VoucherValidationService } = require('../lib/backend/src/domain/accounting/services/VoucherValidationService');
const { VoucherEntity } = require('../lib/backend/src/domain/accounting/entities/VoucherEntity');
const { VoucherLineEntity } = require('../lib/backend/src/domain/accounting/entities/VoucherLineEntity');

const runId = Date.now();
const COMPANY_ID = `cmp_task223_${runId}`;
const USER_ID = 'task223-smoke';
const ITEM_ID = `item_task223_${runId}`;
const WH_ID = `wh_task223_${runId}`;
const INV_ACCOUNT = 'INV-REVAL-100';
const REV_ACCOUNT = 'REV-ACC-900';

const point = (ccy) => ({ base: ccy, ccy, currency: 'USD', fxRateToBase: 1, asOf: '2026-06-19' });

const log = (...args) => console.log(`[task223]`, ...args);

const companyRef = (db) => db.collection('companies').doc(COMPANY_ID);
const accountingData = (db) => companyRef(db).collection('accounting').doc('Data');

/**
 * Firestore-backed IVoucherRepository. Persists vouchers to
 *   companies/{cid}/accounting/Data/vouchers
 * matching the existing Production VoucherMapper shape.
 */
class FirestoreVoucherRepositoryAdapter {
  constructor(db) { this.db = db; }
  get collection() { return accountingData(this.db).collection('vouchers'); }
  async save(voucher) {
    const id = voucher.id;
    const stripUndefined = (obj) => Object.fromEntries(Object.entries(obj).filter(([_, v]) => v !== undefined));
    const payload = stripUndefined({
      id,
      companyId: voucher.companyId,
      voucherNo: voucher.voucherNo,
      type: voucher.type,
      date: voucher.date,
      description: voucher.description,
      currency: voucher.currency,
      baseCurrency: voucher.baseCurrency,
      exchangeRate: voucher.exchangeRate,
      status: voucher.status,
      metadata: voucher.metadata || {},
      createdBy: voucher.createdBy,
      postedBy: voucher.postedBy,
      createdAt: voucher.createdAt ? voucher.createdAt.toISOString() : new Date().toISOString(),
      updatedAt: voucher.updatedAt ? voucher.updatedAt.toISOString() : new Date().toISOString(),
      postedAt: voucher.postedAt ? voucher.postedAt.toISOString() : null,
      reference: voucher.reference || null,
      lines: voucher.lines.map((l) => stripUndefined({
        id: l.id,
        accountId: l.accountId,
        debit: l.debitAmount,
        credit: l.creditAmount,
        amount: l.debitAmount || l.creditAmount,
        currency: l.currency,
        exchangeRate: l.exchangeRate,
        baseAmount: l.baseAmount,
        docAmount: l.docAmount,
        description: l.description || '',
        costCenter: l.costCenter,
        metadata: l.metadata || {},
      })),
      totalDebit: voucher.totalDebit,
      totalCredit: voucher.totalCredit,
    });
    await this.collection.doc(id).set(payload, { merge: true });
    return voucher;
  }
  async findById(companyId, voucherId) {
    const doc = await this.collection.doc(voucherId).get();
    return doc.exists ? hydrateVoucher(doc.data()) : null;
  }
  async delete(companyId, voucherId) {
    await this.collection.doc(voucherId).delete();
    return true;
  }
  async existsByNumber(companyId, voucherNo) {
    const snap = await this.collection.where('voucherNo', '==', voucherNo).limit(1).get();
    return !snap.empty;
  }
  async hasPostedVouchers(companyId) {
    const snap = await this.collection.where('status', 'in', ['POSTED', 'APPROVED']).limit(1).get();
    return !snap.empty;
  }
}

function hydrateVoucher(data) {
  const lines = (data.lines || []).map((l) => new VoucherLineEntity({
    id: l.id,
    accountId: l.accountId,
    side: l.debit > 0 ? 'Debit' : 'Credit',
    amount: l.amount,
    currency: l.currency,
    exchangeRate: l.exchangeRate,
    baseAmount: l.baseAmount,
    docAmount: l.docAmount,
    description: l.description,
    costCenter: l.costCenter,
    metadata: l.metadata || {},
  }));
  return new VoucherEntity(
    data.id,
    data.companyId,
    data.voucherNo,
    data.type,
    data.date,
    data.description,
    data.currency,
    data.baseCurrency,
    data.exchangeRate,
    lines,
    data.totalDebit,
    data.totalCredit,
    data.status,
    data.metadata || {},
    data.createdBy,
    data.createdAt ? new Date(data.createdAt) : new Date(),
    data.postedBy || data.createdBy,
    data.postedAt ? new Date(data.postedAt) : new Date(),
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    data.reference || null
  );
}

/**
 * Firestore-backed ILedgerRepository. Writes ledger rows to
 *   companies/{cid}/accounting/Data/ledger
 */
class FirestoreLedgerRepositoryAdapter {
  constructor(db) { this.db = db; }
  get collection() { return accountingData(this.db).collection('ledger'); }
  async recordForVoucher(voucher, transaction) {
    const tx = transaction && transaction.set ? transaction : null;
    const stripUndefined = (obj) => Object.fromEntries(Object.entries(obj).filter(([_, v]) => v !== undefined));
    const writes = voucher.lines.map((line) => {
      const doc = stripUndefined({
        id: `${voucher.id}_${line.id}`,
        companyId: voucher.companyId,
        voucherId: voucher.id,
        voucherNo: voucher.voucherNo,
        accountId: line.accountId,
        debit: line.debitAmount || 0,
        credit: line.creditAmount || 0,
        currency: line.currency,
        exchangeRate: line.exchangeRate,
        baseAmount: line.baseAmount,
        docAmount: line.docAmount,
        description: line.description,
        date: voucher.date,
        costCenter: line.costCenter,
        metadata: line.metadata || {},
        createdAt: new Date().toISOString(),
      });
      if (tx) {
        tx.set(this.collection.doc(doc.id), doc, { merge: true });
      } else {
        return this.collection.doc(doc.id).set(doc, { merge: true });
      }
    });
    if (!tx) {
      await Promise.all(writes);
    }
  }
}

/**
 * Firestore-backed IAccountRepository. Reads accounts from
 *   companies/{cid}/accounting/Data/accounts
 */
class FirestoreAccountRepositoryAdapter {
  constructor(db) { this.db = db; }
  get collection() { return accountingData(this.db).collection('accounts'); }
  async findById(accountId) {
    const snap = await this.collection.where('code', '==', accountId).limit(1).get();
    if (snap.empty) return null;
    const d = snap.docs[0].data();
    return {
      id: d.id || d.code,
      companyId: d.companyId,
      code: d.code,
      name: d.name,
      type: d.type,
      active: d.active !== false,
    };
  }
  async getById(companyId, accountId) {
    const snap = await this.collection.where('code', '==', accountId).limit(1).get();
    if (snap.empty) return null;
    const d = snap.docs[0].data();
    if (d.companyId && d.companyId !== companyId) return null;
    return {
      id: d.id || d.code,
      companyId: d.companyId,
      code: d.code,
      name: d.name,
      type: d.type,
      accountRole: d.accountRole || 'POSTING',
      status: d.status || (d.active === false ? 'INACTIVE' : 'ACTIVE'),
      userCode: d.userCode || d.code,
      hasChildren: d.hasChildren === true,
      replacedByAccountId: d.replacedByAccountId || undefined,
    };
  }
  async findByCode(code) { return this.findById(code); }
  async findByCompany(companyId) {
    const snap = await this.collection.get();
    return snap.docs.map((d) => {
      const x = d.data();
      return { id: x.id || x.code, companyId, code: x.code, name: x.name, type: x.type, active: x.active !== false };
    });
  }
}

/**
 * Firestore-backed ICompanyCurrencyRepository.
 *   companies/{cid}/settings/currency.baseCurrency
 */
class FirestoreCompanyCurrencyRepositoryAdapter {
  constructor(db) { this.db = db; }
  async getBaseCurrency(companyId) {
    const doc = await companyRef(this.db).collection('settings').doc('currency').get();
    if (doc.exists && doc.data().baseCurrency) {
      return doc.data().baseCurrency;
    }
    return 'USD';
  }
}

async function getInventoryGlBalance(db, accountCode) {
  const ledgerSnap = await accountingData(db)
    .collection('ledger')
    .where('accountId', '==', accountCode)
    .get();
  let debit = 0;
  let credit = 0;
  ledgerSnap.forEach((doc) => {
    const d = doc.data();
    debit += Number(d.debit || 0);
    credit += Number(d.credit || 0);
  });
  return { debit, credit, balance: debit - credit };
}

async function getVoucherCount(db) {
  const snap = await accountingData(db).collection('vouchers').get();
  return snap.size;
}

async function clearCompany(db) {
  const refs = [
    companyRef(db),
  ];
  for (const ref of refs) {
    try { await ref.recursiveDelete(); } catch (_) { /* ignore */ }
  }
}

async function seedCompany(db) {
  const inventorySettingsRepo = new FirestoreInventorySettingsRepository(db);
  const itemRepo = new FirestoreItemRepository(db);
  const whRepo = new FirestoreWarehouseRepository(db);
  const stockLevelRepo = new FirestoreStockLevelRepository(db);
  const stockMovementRepo = new FirestoreStockMovementRepository(db);
  const companyModuleRepo = new FirestoreCompanyModuleRepository(db);

  await inventorySettingsRepo.saveSettings(new InventorySettings({
    companyId: COMPANY_ID,
    accountingMode: 'PERPETUAL',
    inventoryAccountingMethod: 'PERPETUAL',
    defaultCostingMethod: 'MOVING_AVG',
    costingBasis: 'WAREHOUSE',
    inventoryFxCostBasis: 'REPLACEMENT',
    defaultLinePriceSource: 'LAST_PARTY_PRICE',
    defaultCostCurrency: 'USD',
    defaultInventoryRevaluationAccountId: REV_ACCOUNT,
    defaultInventoryAssetAccountId: INV_ACCOUNT,
    allowNegativeStock: false,
    autoGenerateItemCode: false,
    itemCodeNextSeq: 1,
  }));

  await itemRepo.createItem(new Item({
    id: ITEM_ID,
    companyId: COMPANY_ID,
    code: 'TASK223-ITEM',
    name: 'Task 223 Item',
    type: 'PRODUCT',
    baseUom: 'EA',
    costCurrency: 'USD',
    costingMethod: 'MOVING_AVG',
    trackInventory: true,
    salePrice: 20,
    purchasePrice: 10,
    inventoryAssetAccountId: INV_ACCOUNT,
    revenueAccountId: 'REV-100',
    cogsAccountId: 'COGS-100',
    costingStats: { avgCost: point(10) },
    active: true,
    createdBy: USER_ID,
    createdAt: new Date(),
    updatedAt: new Date(),
  }));

  await whRepo.createWarehouse(new Warehouse({
    id: WH_ID,
    companyId: COMPANY_ID,
    name: 'Main',
    code: 'MAIN',
    isDefault: true,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }));

  const openingLevel = new StockLevel({
    id: `${ITEM_ID}_${WH_ID}`,
    companyId: COMPANY_ID,
    itemId: ITEM_ID,
    warehouseId: WH_ID,
    qtyOnHand: 100,
    reservedQty: 0,
    avgCostBase: 10,
    avgCostCCY: 10,
    lastCostBase: 10,
    lastCostCCY: 10,
    postingSeq: 1,
    maxBusinessDate: '2026-06-19',
    totalMovements: 1,
    lastMovementId: `mv_open_${runId}`,
    version: 1,
    updatedAt: new Date(),
  });
  await stockLevelRepo.upsertLevel(openingLevel);

  await stockMovementRepo.recordMovement(new StockMovement({
    id: `mv_open_${runId}`,
    companyId: COMPANY_ID,
    date: '2026-06-19',
    postingSeq: 1,
    createdAt: new Date(),
    createdBy: USER_ID,
    postedAt: new Date(),
    itemId: ITEM_ID,
    warehouseId: WH_ID,
    direction: 'IN',
    movementType: 'OPENING_STOCK',
    qty: 100,
    uom: 'EA',
    referenceType: 'OPENING',
    referenceId: `openseed_${runId}`,
    unitCostBase: 10,
    totalCostBase: 1000,
    unitCostCCY: 10,
    totalCostCCY: 1000,
    movementCurrency: 'USD',
    fxRateMovToBase: 1,
    fxRateCCYToBase: 1,
    fxRateKind: 'DOCUMENT',
    avgCostBaseAfter: 10,
    avgCostCCYAfter: 10,
    qtyBefore: 0,
    qtyAfter: 100,
    settlesNegativeQty: 0,
    newPositiveQty: 100,
    negativeQtyAtPosting: false,
    costSettled: true,
    isBackdated: false,
    costSource: 'OPENING',
  }));

  // Mark accounting module initialized.
  await companyRef(db)
    .collection('modules').doc('accounting')
    .set({ initialized: true, enabled: true, companyId: COMPANY_ID, moduleCode: 'accounting' }, { merge: true });

  // Seed accounts.
  const accColl = accountingData(db).collection('accounts');
  await accColl.doc(INV_ACCOUNT).set({ id: INV_ACCOUNT, companyId: COMPANY_ID, code: INV_ACCOUNT, name: 'Inventory Asset', type: 'ASSET', accountRole: 'POSTING', status: 'ACTIVE', userCode: INV_ACCOUNT, hasChildren: false, active: true }, { merge: true });
  await accColl.doc(REV_ACCOUNT).set({ id: REV_ACCOUNT, companyId: COMPANY_ID, code: REV_ACCOUNT, name: 'Inventory Revaluation / Variance', type: 'EXPENSE', accountRole: 'POSTING', status: 'ACTIVE', userCode: REV_ACCOUNT, hasChildren: false, active: true }, { merge: true });
  await accColl.doc('REV-100').set({ id: 'REV-100', companyId: COMPANY_ID, code: 'REV-100', name: 'Sales Revenue', type: 'REVENUE', accountRole: 'POSTING', status: 'ACTIVE', userCode: 'REV-100', hasChildren: false, active: true }, { merge: true });
  await accColl.doc('COGS-100').set({ id: 'COGS-100', companyId: COMPANY_ID, code: 'COGS-100', name: 'COGS', type: 'EXPENSE', accountRole: 'POSTING', status: 'ACTIVE', userCode: 'COGS-100', hasChildren: false, active: true }, { merge: true });

  await companyRef(db)
    .collection('settings').doc('currency')
    .set({ baseCurrency: 'USD' }, { merge: true });

  return { inventorySettingsRepo, itemRepo, stockLevelRepo, stockMovementRepo, companyModuleRepo };
}

(async () => {
  if (!admin.apps.length) {
    admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT });
  }
  const db = admin.firestore();
  const txManager = new FirestoreTransactionManager(db);

  log(`seeding company ${COMPANY_ID} ...`);
  await clearCompany(db);
  const { inventorySettingsRepo, itemRepo, stockLevelRepo, stockMovementRepo, companyModuleRepo } = await seedCompany(db);

  const revaluationRepo = new FirestoreInventoryRevaluationRepository(db);
  const voucherRepo = new FirestoreVoucherRepositoryAdapter(db);
  const ledgerRepo = new FirestoreLedgerRepositoryAdapter(db);
  const accountRepo = new FirestoreAccountRepositoryAdapter(db);
  const currencyRepo = new FirestoreCompanyCurrencyRepositoryAdapter(db);

  const policyRegistry = undefined;

  const accountingPostingService = new SubledgerVoucherPostingService(
    voucherRepo,
    ledgerRepo,
    currencyRepo,
    accountRepo,
    new VoucherValidationService(),
    undefined,
    policyRegistry
  );

  const createUseCase = new CreateInventoryRevaluationUseCase(
    revaluationRepo,
    itemRepo,
    stockLevelRepo,
    inventorySettingsRepo
  );
  const postUseCase = new PostInventoryRevaluationUseCase(
    revaluationRepo,
    itemRepo,
    stockLevelRepo,
    inventorySettingsRepo,
    txManager,
    companyModuleRepo,
    accountingPostingService
  );

  // ---- Round 1: WRITE UP from 10 -> 12.5 -------------------------------------
  const upDraft = await createUseCase.execute({
    companyId: COMPANY_ID,
    date: '2026-06-19',
    reason: 'COST_CORRECTION',
    notes: 'Write up task 223',
    createdBy: USER_ID,
    lines: [{ itemId: ITEM_ID, warehouseId: WH_ID, newAvgCostBase: 12.5, newAvgCostCCY: 12.5 }],
  });
  if (upDraft.status !== 'DRAFT') throw new Error(`up draft should be DRAFT, got ${upDraft.status}`);
  if (upDraft.lines[0].valueDeltaBase !== 250) throw new Error(`up draft valueDelta expected 250, got ${upDraft.lines[0].valueDeltaBase}`);
  log(`WRITE-UP DRAFT created valueDeltaBase=250 totalValueDeltaBase=${upDraft.totalValueDeltaBase}`);

  const invBeforeUp = await getInventoryGlBalance(db, INV_ACCOUNT);
  const revBeforeUp = await getInventoryGlBalance(db, REV_ACCOUNT);
  const vouchersBefore = await getVoucherCount(db);

  const upPosted = await postUseCase.execute(COMPANY_ID, upDraft.id, USER_ID);
  if (upPosted.status !== 'POSTED') throw new Error(`up post expected POSTED, got ${upPosted.status}`);
  if (!upPosted.voucherId) throw new Error('up post did not produce a voucher');
  log(`WRITE-UP POSTED voucherId=${upPosted.voucherId} valueDeltaBase=${upPosted.totalValueDeltaBase}`);

  const invAfterUp = await getInventoryGlBalance(db, INV_ACCOUNT);
  const revAfterUp = await getInventoryGlBalance(db, REV_ACCOUNT);

  if (Math.abs(invAfterUp.balance - (invBeforeUp.balance + 250)) > 0.01) {
    throw new Error(`inventory GL did not move +250: before=${invBeforeUp.balance} after=${invAfterUp.balance}`);
  }
  if (Math.abs(revAfterUp.balance - (revBeforeUp.balance - 250)) > 0.01) {
    throw new Error(`revaluation GL did not move -250: before=${revBeforeUp.balance} after=${revAfterUp.balance}`);
  }
  if (await getVoucherCount(db) !== vouchersBefore + 1) {
    throw new Error('voucher count did not grow by exactly 1 after the write-up post');
  }

  // Sub-ledger: stock level must carry the new average cost (12.5) and quantity unchanged.
  const levelAfterUp = await stockLevelRepo.getLevel(COMPANY_ID, ITEM_ID, WH_ID);
  if (!levelAfterUp) throw new Error('stock level missing after write-up');
  if (levelAfterUp.qtyOnHand !== 100) throw new Error(`qty must stay 100, got ${levelAfterUp.qtyOnHand}`);
  if (Math.abs(levelAfterUp.avgCostBase - 12.5) > 0.001) throw new Error(`avg cost should be 12.5, got ${levelAfterUp.avgCostBase}`);

  // Item costing stats: avgCost must be 12.5.
  const itemAfterUp = await itemRepo.getItem(ITEM_ID);
  if (!itemAfterUp.costingStats || Math.abs(itemAfterUp.costingStats.avgCost.base - 12.5) > 0.001) {
    throw new Error(`item costingStats.avgCost.base should be 12.5, got ${itemAfterUp.costingStats && itemAfterUp.costingStats.avgCost && itemAfterUp.costingStats.avgCost.base}`);
  }

  log(`WRITE-UP: inventory GL ${invBeforeUp.balance} -> ${invAfterUp.balance}, variance GL ${revBeforeUp.balance} -> ${revAfterUp.balance}, level avgCost=${levelAfterUp.avgCostBase}, item avgCost=${itemAfterUp.costingStats.avgCost.base}`);

  // ---- Round 2: WRITE DOWN from 12.5 -> 11 ---------------------------------
  const downDraft = await createUseCase.execute({
    companyId: COMPANY_ID,
    date: '2026-06-19',
    reason: 'COST_CORRECTION',
    notes: 'Write down task 223',
    createdBy: USER_ID,
    lines: [{ itemId: ITEM_ID, warehouseId: WH_ID, newAvgCostBase: 11, newAvgCostCCY: 11 }],
  });
  if (downDraft.lines[0].valueDeltaBase !== -150) throw new Error(`down draft valueDelta expected -150, got ${downDraft.lines[0].valueDeltaBase}`);
  log(`WRITE-DOWN DRAFT created valueDeltaBase=-150`);

  const invBeforeDown = await getInventoryGlBalance(db, INV_ACCOUNT);
  const revBeforeDown = await getInventoryGlBalance(db, REV_ACCOUNT);
  const vouchersBeforeDown = await getVoucherCount(db);

  const downPosted = await postUseCase.execute(COMPANY_ID, downDraft.id, USER_ID);
  if (downPosted.status !== 'POSTED') throw new Error('down post expected POSTED');

  const invAfterDown = await getInventoryGlBalance(db, INV_ACCOUNT);
  const revAfterDown = await getInventoryGlBalance(db, REV_ACCOUNT);

  if (Math.abs(invAfterDown.balance - (invBeforeDown.balance - 150)) > 0.01) {
    throw new Error(`inventory GL did not move -150: before=${invBeforeDown.balance} after=${invAfterDown.balance}`);
  }
  if (Math.abs(revAfterDown.balance - (revBeforeDown.balance + 150)) > 0.01) {
    throw new Error(`variance GL did not move +150: before=${revBeforeDown.balance} after=${revAfterDown.balance}`);
  }
  if (await getVoucherCount(db) !== vouchersBeforeDown + 1) {
    throw new Error('voucher count did not grow by exactly 1 after the write-down post');
  }

  const finalLevel = await stockLevelRepo.getLevel(COMPANY_ID, ITEM_ID, WH_ID);
  if (Math.abs(finalLevel.avgCostBase - 11) > 0.001) {
    throw new Error(`final avg cost should be 11, got ${finalLevel.avgCostBase}`);
  }
  if (finalLevel.qtyOnHand !== 100) {
    throw new Error(`final qty should still be 100, got ${finalLevel.qtyOnHand}`);
  }

  log(`WRITE-DOWN: inventory GL ${invBeforeDown.balance} -> ${invAfterDown.balance}, variance GL ${revBeforeDown.balance} -> ${revAfterDown.balance}, final level avgCost=${finalLevel.avgCostBase}, qty=${finalLevel.qtyOnHand}`);

  console.log(`Task 223 emulator smoke PASSED for ${COMPANY_ID}: write-up +250, write-down -150, GL tied, sub-ledger level avg cost updated, qty unchanged, item costing stats updated, voucher count grew by 2.`);
})().catch(async (err) => {
  console.error(err);
  try { await clearCompany(admin.firestore()); } catch (_) { /* ignore */ }
  process.exitCode = 1;
}).finally(async () => {
  try { await admin.app().delete(); } catch (_) { /* ignore */ }
});
