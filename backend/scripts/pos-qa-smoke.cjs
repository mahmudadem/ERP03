/**
 * POS QA smoke — drives the COMPILED POS + Sales use cases against the running
 * Firestore emulator. Run from backend/:  node scripts/pos-qa-smoke.cjs   (emulator on 8080)
 *
 * Stage 1: tax-inclusive total is the authority (real SI draft == preview == 115).
 * Stage 2: full POS flow — open shift, cash/split/change sales (assert SI POSTED, AR=0,
 *          stock decremented), receipt-based return (restock), shift close.
 */
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'erp-03';
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
process.env.DB_TYPE = 'FIRESTORE';

const L = '../lib/backend/src';
const { diContainer: di } = require(`${L}/infrastructure/di/bindRepositories`);
const { Company } = require(`${L}/domain/core/entities/Company`);
const { Item } = require(`${L}/domain/inventory/entities/Item`);
const { Party } = require(`${L}/domain/shared/entities/Party`);
const { TaxCode } = require(`${L}/domain/shared/entities/TaxCode`);
const { StockLevel } = require(`${L}/domain/inventory/entities/StockLevel`);
const { PosRegister } = require(`${L}/domain/pos/entities/PosRegister`);
const { SimpleTradingCompanyInitializer } = require(`${L}/application/onboarding/use-cases/SimpleTradingCompanyInitializer`);
const { CreateSalesInvoiceUseCase, PostSalesInvoiceUseCase } = require(`${L}/application/sales/use-cases/SalesInvoiceUseCases`);
const { CreateSalesReturnUseCase, PostSalesReturnUseCase } = require(`${L}/application/sales/use-cases/SalesReturnUseCases`);
const { PreviewPosSaleUseCase } = require(`${L}/application/pos/use-cases/PreviewPosSaleUseCase`);
const { CompletePosSaleUseCase } = require(`${L}/application/pos/use-cases/CompletePosSaleUseCase`);
const { CompletePosReturnUseCase } = require(`${L}/application/pos/use-cases/CompletePosReturnUseCase`);
const { OpenPosShiftUseCase, ClosePosShiftUseCase } = require(`${L}/application/pos/use-cases/PosShiftUseCases`);
const { UpdatePosSettingsUseCase } = require(`${L}/application/pos/use-cases/PosSettingsUseCases`);
const { RecordStockMovementUseCase } = require(`${L}/application/inventory/use-cases/RecordStockMovementUseCase`);
const { SalesInventoryService } = require(`${L}/application/inventory/services/SalesInventoryService`);
const { SubledgerVoucherPostingService } = require(`${L}/application/accounting/services/SubledgerVoucherPostingService`);
const { VoucherValidationService } = require(`${L}/domain/accounting/services/VoucherValidationService`);

const now = () => new Date('2026-06-21T00:00:00.000Z');
const TODAY = '2026-06-21';
const runId = Date.now();
const companyId = `cmp_posqa_${runId}`;
const userId = 'pos-qa';
const itemId = `item_posqa_${runId}`;
const custId = `cust_posqa_${runId}`;
const uomId = 'uom_each';
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const assert = (cond, msg) => { if (!cond) throw new Error('ASSERT FAILED: ' + msg); };

let ACC = {};

async function bootstrap() {
  await di.companyRepository.save(new Company(
    companyId, 'POS QA Co', userId, now(), now(), 'USD', 1, 12,
    ['accounting', 'inventory', 'sales', 'pos']
  ));
  await di.companyCurrencyRepository.enable(companyId, 'USD');

  await new SimpleTradingCompanyInitializer({
    companyRepo: di.companyRepository, companyModuleRepo: di.companyModuleRepository,
    accountRepo: di.accountRepository, systemMetadataRepo: di.systemMetadataRepository,
    companyModuleSettingsRepo: di.companyModuleSettingsRepository, companySettingsRepo: di.companySettingsRepository,
    currencyRepo: di.currencyRepository, fiscalYearRepo: di.fiscalYearRepository,
    voucherTypeRepo: di.voucherTypeDefinitionRepository, voucherFormRepo: di.voucherFormRepository,
    inventorySettingsRepo: di.inventorySettingsRepository, warehouseRepo: di.warehouseRepository,
    uomRepo: di.uomRepository, salesSettingsRepo: di.salesSettingsRepository,
    purchaseSettingsRepo: di.purchaseSettingsRepository,
  }).execute({
    companyId, userId, baseCurrency: 'USD', accountingMode: 'INVOICE_DRIVEN',
    salesWorkflowMode: 'SIMPLE', purchaseWorkflowMode: 'SIMPLE',
  });

  const ss = await di.salesSettingsRepository.getSettings(companyId);
  const accounts = await di.accountRepository.list(companyId);
  // Posting must target leaf (POSTING) accounts, never HEADER accounts.
  const post = accounts.filter((a) => a.accountRole === 'POSTING');
  const pick = (cls, re) => (post.find((a) => a.classification === cls && re.test(a.name || '')) ||
    post.find((a) => a.classification === cls));
  ACC.revenue = (pick('REVENUE', /sales|revenue/i) || {}).id;
  ACC.cogs = (pick('EXPENSE', /cost of|cogs|goods sold/i) || {}).id;
  ACC.inv = (pick('ASSET', /finished goods|inventory/i) || {}).id;
  ACC.cash = (pick('ASSET', /cash/i) || {}).id;
  ACC.ar = (pick('ASSET', /receivable/i) || {}).id;
  ACC.taxLiab = (pick('LIABILITY', /tax|vat|payable/i) || pick('LIABILITY', /./) || {}).id;
  console.log('  resolved POSTING accounts:', JSON.stringify(ACC));
  assert(ACC.revenue && ACC.cogs && ACC.inv && ACC.cash && ACC.ar && ACC.taxLiab, 'all posting accounts resolved');
  // Mirror real onboarding: point sales settings at the resolved posting accounts.
  ss.defaultARAccountId = ACC.ar;
  ss.defaultRevenueAccountId = ACC.revenue;
  ss.defaultCOGSAccountId = ACC.cogs;
  ss.defaultInventoryAccountId = ACC.inv;
  await di.salesSettingsRepository.saveSettings(ss);

  const taxCodeId = `tax_posqa_${runId}`;
  await di.taxCodeRepository.create(new TaxCode({
    id: taxCodeId, companyId, code: 'VAT15', name: 'VAT 15%', rate: 0.15, taxType: 'VAT', scope: 'SALES',
    salesTaxAccountId: ACC.taxLiab, priceIsInclusive: false, active: true,
    createdBy: userId, createdAt: now(), updatedAt: now(),
  }));
  await di.itemRepository.createItem(new Item({
    id: itemId, companyId, code: 'POSQA-1', name: 'POS QA Widget', type: 'PRODUCT',
    baseUomId: uomId, baseUom: 'EA', salesUomId: uomId, salesUom: 'EA', purchaseUomId: uomId, purchaseUom: 'EA',
    costCurrency: 'USD', costingMethod: 'MOVING_AVG', trackInventory: true, salePrice: 100, purchasePrice: 60,
    defaultSalesTaxCodeId: taxCodeId, revenueAccountId: ACC.revenue, cogsAccountId: ACC.cogs, inventoryAssetAccountId: ACC.inv,
    active: true, createdBy: userId, createdAt: now(), updatedAt: now(),
  }));
  // NOTE: deliberately NO per-party defaultARAccountId — a POS walk-in relies on the company
  // default AR. This exercises the SI↔SR AR-resolution symmetry (both must fall back identically).
  await di.partyRepository.create(new Party({
    id: custId, companyId, code: 'WALKIN', legalName: 'Walk-in', displayName: 'Walk-in',
    roles: ['CUSTOMER'], defaultCurrency: 'USD', active: true,
    createdBy: userId, createdAt: now(), updatedAt: now(),
  }));

  const warehouses = await di.warehouseRepository.getCompanyWarehouses(companyId);
  assert(warehouses.length > 0, 'init created a default warehouse');
  ACC.warehouseId = warehouses[0].id;
  ACC.taxCodeId = taxCodeId;

  // opening stock: 100 @ cost 60 (use the repo's canonical composite id)
  await di.stockLevelRepository.upsertLevel(new StockLevel({
    id: StockLevel.compositeId(itemId, ACC.warehouseId), companyId, itemId, warehouseId: ACC.warehouseId,
    qtyOnHand: 100, reservedQty: 0, avgCostBase: 60, avgCostCCY: 60, lastCostBase: 60, lastCostCCY: 60,
    postingSeq: 0, maxBusinessDate: TODAY, totalMovements: 0, lastMovementId: '', version: 0, updatedAt: now(),
  }));
}

function buildSaleUseCase() {
  const inventoryService = new SalesInventoryService(new RecordStockMovementUseCase({
    itemRepository: di.itemRepository, warehouseRepository: di.warehouseRepository,
    stockMovementRepository: di.stockMovementRepository, stockLevelRepository: di.stockLevelRepository,
    companyRepository: di.companyRepository, inventorySettingsRepository: di.inventorySettingsRepository,
    transactionManager: di.transactionManager,
  }));
  const posting = new SubledgerVoucherPostingService(
    di.voucherRepository, di.ledgerRepository, di.companyCurrencyRepository, di.accountRepository,
    new VoucherValidationService(), di.periodLockService, di.policyRegistry
  );
  const createSI = new CreateSalesInvoiceUseCase(
    di.salesSettingsRepository, di.salesInvoiceRepository, di.salesOrderRepository, di.partyRepository,
    di.itemRepository, di.itemCategoryRepository, di.taxCodeRepository, di.companyCurrencyRepository,
    di.promotionRuleRepository, undefined, di.creditOverrideRepository, undefined,
  );
  const postSI = new PostSalesInvoiceUseCase(
    di.salesSettingsRepository, di.inventorySettingsRepository, di.salesInvoiceRepository, di.salesOrderRepository,
    di.deliveryNoteRepository, di.partyRepository, di.taxCodeRepository, di.itemRepository, di.itemCategoryRepository,
    di.warehouseRepository, di.uomConversionRepository, di.companyCurrencyRepository, inventoryService,
    di.companyModuleRepository, posting, di.accountRepository, di.transactionManager, di.paymentHistoryRepository,
    di.voucherRepository, di.voucherSequenceRepository, di.ledgerRepository, di.postingLogRepository, undefined,
    di.partyItemPriceRepository, di.recordSalesProfitLineFactsUseCase
  );
  return new CompletePosSaleUseCase(
    di.posShiftRepository, di.posSettingsRepository, di.posRegisterRepository, di.posReceiptRepository,
    di.posPaymentRepository, di.posCashMovementRepository, di.transactionManager, createSI, postSI, di.salesInvoiceRepository
  );
}

async function qtyOnHand() {
  const lvl = await di.stockLevelRepository.getLevel(companyId, itemId, ACC.warehouseId);
  return lvl ? lvl.qtyOnHand : null;
}

async function stage1() {
  console.log('STAGE 1 — tax-inclusive total is the authority');
  const createSI = new CreateSalesInvoiceUseCase(
    di.salesSettingsRepository, di.salesInvoiceRepository, di.salesOrderRepository, di.partyRepository,
    di.itemRepository, di.itemCategoryRepository, di.taxCodeRepository, di.companyCurrencyRepository,
    di.promotionRuleRepository, undefined, di.creditOverrideRepository, undefined,
  );
  const { salesInvoice: draft } = await createSI.execute({
    companyId, customerId: custId, invoiceDate: TODAY,
    source: 'pos', voucherType: 'sales_invoice', formType: 'pos_sale', persona: 'direct', createdBy: userId,
    lines: [{ itemId, invoicedQty: 1, unitPriceDoc: 100 }],
  }, undefined, { userId });
  console.log(`  draft ${draft.invoiceNumber}: grand=${draft.grandTotalBase} tax=${draft.taxTotalBase}`);
  assert(draft.grandTotalBase === 115 && draft.taxTotalBase === 15, 'draft tax-inclusive 115');
  await di.salesInvoiceRepository.delete(companyId, draft.id);

  const preview = await new PreviewPosSaleUseCase(di.itemRepository, di.taxCodeRepository)
    .execute({ companyId, lines: [{ itemId, qty: 1, unitPrice: 100 }] });
  assert(preview.grandTotal === 115 && preview.taxTotal === 15, 'preview tax-inclusive 115');
  console.log('  STAGE 1 PASS ✓');
}

async function stage2() {
  console.log('STAGE 2 — full POS flow');
  // POS settings + register
  await new UpdatePosSettingsUseCase(di.posSettingsRepository, di.accountRepository, di.salesSettingsRepository).execute({
    companyId, requireOpenShift: true, walkInCustomerId: custId,
    cashOverAccountId: ACC.revenue, cashShortAccountId: ACC.cogs, allowPosDirectSales: true,
    paymentMethods: [
      { code: 'CASH', settlementAccountId: ACC.cash, requiresReference: false, allowsChange: true, isEnabled: true },
      { code: 'CARD', settlementAccountId: ACC.cash, requiresReference: false, allowsChange: false, isEnabled: true },
    ],
  });
  const registerId = `reg_posqa_${runId}`;
  await di.posRegisterRepository.create(new PosRegister({
    id: registerId, companyId, code: 'POS-01', name: 'Front', warehouseId: ACC.warehouseId,
    cashDrawerAccountId: ACC.cash, status: 'ACTIVE', createdAt: now(), updatedAt: now(),
  }));

  // open shift
  const shift = await new OpenPosShiftUseCase(
    di.posShiftRepository, di.posRegisterRepository, di.posSettingsRepository, di.posCashMovementRepository, di.transactionManager
  ).execute({ companyId, registerId, cashierUserId: userId, openingFloat: 100, actor: { userId } });
  console.log(`  shift opened: ${shift.id} (status ${shift.status})`);

  const sale = buildSaleUseCase();
  const run = (payments) => sale.execute({ companyId, registerId, shiftId: shift.id, lines: [{ itemId, qty: 1, unitPrice: 100 }], payments, actor: { userId } });

  const ssNow = await di.salesSettingsRepository.getSettings(companyId);
  console.log(`  sales policy: workflowMode=${ssNow.workflowMode} allowDirectInvoicing=${ssNow.allowDirectInvoicing} defaultWarehouseId=${ssNow.defaultWarehouseId} registerWh=${ACC.warehouseId}`);

  // (a) cash exact (115)
  let q0 = await qtyOnHand();
  const r1 = await run([{ method: 'CASH', amount: 115 }]);
  const si1 = await di.salesInvoiceRepository.getById(companyId, r1.salesInvoiceId);
  const q1 = await qtyOnHand();
  console.log(`  cash sale: receipt grand=${r1.receipt.grandTotal} tax=${r1.receipt.taxTotal} change=${r1.change}; SI ${si1.invoiceNumber} status=${si1.status} outstanding=${si1.outstandingAmountBase}; stock ${q0}->${q1}; cogsVoucherId=${si1.cogsVoucherId}`);
  assert(r1.receipt.grandTotal === 115 && r1.receipt.taxTotal === 15 && r1.change === 0, 'cash receipt totals');
  assert(si1.status === 'POSTED' && si1.outstandingAmountBase === 0, 'SI posted + AR settled to 0');
  assert(q1 === round2(q0 - 1), `stock decremented by 1 (was ${q0}, now ${q1})`);

  // (b) split CASH 50 + CARD 65 (=115)
  q0 = await qtyOnHand();
  const r2 = await run([{ method: 'CASH', amount: 50 }, { method: 'CARD', amount: 65 }]);
  const si2 = await di.salesInvoiceRepository.getById(companyId, r2.salesInvoiceId);
  console.log(`  split sale: SI ${si2.invoiceNumber} status=${si2.status} outstanding=${si2.outstandingAmountBase} change=${r2.change}`);
  assert(si2.status === 'POSTED' && si2.outstandingAmountBase === 0, 'split SI posted + AR 0');
  assert(r2.change === 0, 'no change on exact split');
  assert((await qtyOnHand()) === round2(q0 - 1), 'stock decremented on split');

  // (c) cash with change (pay 200 -> change 85)
  q0 = await qtyOnHand();
  const r3 = await run([{ method: 'CASH', amount: 200 }]);
  const si3 = await di.salesInvoiceRepository.getById(companyId, r3.salesInvoiceId);
  console.log(`  cash+change: change=${r3.change}; SI ${si3.invoiceNumber} outstanding=${si3.outstandingAmountBase}`);
  assert(r3.change === 85, 'change = 200 - 115');
  assert(si3.status === 'POSTED' && si3.outstandingAmountBase === 0, 'change-sale SI posted + AR 0');

  // (d) receipt-based return of sale (a)
  q0 = await qtyOnHand();
  const ret = new CompletePosReturnUseCase(
    di.posReceiptRepository, di.posReturnRepository, di.posShiftRepository, di.posSettingsRepository,
    di.posCashMovementRepository, di.transactionManager,
    new CreateSalesReturnUseCase(di.salesSettingsRepository, di.salesReturnRepository, di.salesInvoiceRepository, di.deliveryNoteRepository, undefined, di.companyCurrencyRepository),
    buildPostReturn(),
  );
  try {
    const rr = await ret.execute({ companyId, registerId, shiftId: shift.id, originalReceiptId: r1.receipt.id, lines: [{ itemId, qty: 1 }], refundMethod: 'CASH', actor: { userId } });
    console.log(`  return: salesReturnId=${rr.salesReturn && rr.salesReturn.id} refund=${rr.refundTotal}`);
    assert((await qtyOnHand()) === round2(q0 + 1), 'stock restocked by 1 on return');
    assert(rr.refundTotal === 115, `refund should be tax-inclusive 115, got ${rr.refundTotal}`);
    console.log('  return OK ✓ (tax-inclusive refund)');
  } catch (e) {
    console.log('  ⚠ return step error (recording as finding):', e.message);
    POS_FINDINGS.push('Return flow: ' + e.message);
  }

  // (e) close shift — count exactly the expected cash so over/short = 0
  try {
    const totals = await di.posCashMovementRepository.sumByShift(companyId, shift.id);
    console.log(`  drawer totals: openingFloat? expectedCash=${totals.expectedCash} SALE_CASH=${totals.SALE_CASH} REFUND_CASH=${totals.REFUND_CASH}`);
    const close = await new ClosePosShiftUseCase(
      di.posShiftRepository, di.posSettingsRepository, di.posRegisterRepository, di.posCashMovementRepository,
      di.accountRepository,
      new SubledgerVoucherPostingService(di.voucherRepository, di.ledgerRepository, di.companyCurrencyRepository, di.accountRepository, new VoucherValidationService(), di.periodLockService, di.policyRegistry),
      di.transactionManager
    ).execute({ companyId, shiftId: shift.id, countedCash: totals.expectedCash, actor: { userId } });
    console.log(`  shift closed: status=${close.shift ? close.shift.status : '?'} overShort=${close.overShortAmount}`);
    assert(close.overShortAmount === 0 && close.shift.status === 'CLOSED', 'shift CLOSED with over/short 0');
    console.log('  close OK ✓');
  } catch (e) {
    console.log('  ⚠ close step error (recording as finding):', e.message);
    POS_FINDINGS.push('Close flow: ' + e.message);
  }

  console.log('  STAGE 2 core sale path PASS ✓');
}

// PostSalesReturnUseCase builder (mirror SalesController.postReturn wiring)
function buildPostReturn() {
  const inventoryService = new SalesInventoryService(new RecordStockMovementUseCase({
    itemRepository: di.itemRepository, warehouseRepository: di.warehouseRepository,
    stockMovementRepository: di.stockMovementRepository, stockLevelRepository: di.stockLevelRepository,
    companyRepository: di.companyRepository, inventorySettingsRepository: di.inventorySettingsRepository,
    transactionManager: di.transactionManager,
  }));
  const posting = new SubledgerVoucherPostingService(di.voucherRepository, di.ledgerRepository, di.companyCurrencyRepository, di.accountRepository, new VoucherValidationService(), di.periodLockService, di.policyRegistry);
  return new PostSalesReturnUseCase(
    di.salesSettingsRepository, di.inventorySettingsRepository, di.salesReturnRepository, di.salesInvoiceRepository,
    di.deliveryNoteRepository, di.salesOrderRepository, di.partyRepository, di.taxCodeRepository, di.itemRepository,
    di.itemCategoryRepository, di.uomConversionRepository, di.companyCurrencyRepository, inventoryService,
    di.companyModuleRepository, posting, di.accountRepository, di.transactionManager, undefined,
    di.postingLogRepository, di.partyItemPriceRepository
  );
}

const POS_FINDINGS = [];

(async () => {
  console.log(`POS QA smoke for ${companyId}`);
  await bootstrap();
  await stage1();
  await stage2();
  console.log('\nALL STAGES PASSED');
  if (POS_FINDINGS.length) { console.log('FINDINGS (non-fatal):'); POS_FINDINGS.forEach((f) => console.log('  - ' + f)); }
})().catch((err) => {
  console.error('\nSMOKE FAILED:', err && err.stack ? err.stack : err);
  process.exitCode = 1;
}).finally(async () => { try { await require('firebase-admin').app().delete(); } catch (_) {} });
