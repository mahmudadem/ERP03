const admin = require('firebase-admin');

process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'erp-03';
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';

const { Item } = require('../lib/backend/src/domain/inventory/entities/Item');
const { SalesInvoice } = require('../lib/backend/src/domain/sales/entities/SalesInvoice');
const { SalesSettings } = require('../lib/backend/src/domain/sales/entities/SalesSettings');
const { PurchaseInvoice } = require('../lib/backend/src/domain/purchases/entities/PurchaseInvoice');
const { PurchaseSettings } = require('../lib/backend/src/domain/purchases/entities/PurchaseSettings');
const { Party } = require('../lib/backend/src/domain/shared/entities/Party');
const { PostSalesInvoiceUseCase } = require('../lib/backend/src/application/sales/use-cases/SalesInvoiceUseCases');
const { PostPurchaseInvoiceUseCase } = require('../lib/backend/src/application/purchases/use-cases/PurchaseInvoiceUseCases');
const { FirestoreItemRepository } = require('../lib/backend/src/infrastructure/firestore/repositories/inventory/FirestoreItemRepository');
const { FirestorePartyItemPriceRepository } = require('../lib/backend/src/infrastructure/firestore/repositories/shared/FirestorePartyItemPriceRepository');
const { FirestoreTransactionManager } = require('../lib/backend/src/infrastructure/firestore/transaction/FirestoreTransactionManager');

const now = () => new Date('2026-06-19T00:00:00.000Z');
const runId = Date.now();
const companyId = `cmp_task241_${runId}`;
const userId = 'task241-smoke';
const itemId = `item_task241_service_${runId}`;
const customerId = `cust_task241_${runId}`;
const vendorId = `vend_task241_${runId}`;
const uomId = 'uom_each';
const key = `USD__${uomId}`;

const createParty = (id, role) =>
  new Party({
    id,
    companyId,
    code: role === 'CUSTOMER' ? 'CUST241' : 'VEND241',
    legalName: role === 'CUSTOMER' ? 'Task 241 Customer' : 'Task 241 Vendor',
    displayName: role === 'CUSTOMER' ? 'Task 241 Customer' : 'Task 241 Vendor',
    roles: [role],
    defaultCurrency: 'USD',
    defaultARAccountId: role === 'CUSTOMER' ? 'AR-100' : undefined,
    defaultAPAccountId: role === 'VENDOR' ? 'AP-100' : undefined,
    active: true,
    createdBy: userId,
    createdAt: now(),
    updatedAt: now(),
  });

const makeItem = () =>
  new Item({
    id: itemId,
    companyId,
    code: 'TASK241-SVC',
    name: 'Task 241 Service',
    type: 'SERVICE',
    baseUomId: uomId,
    baseUom: 'EA',
    purchaseUomId: uomId,
    purchaseUom: 'EA',
    salesUomId: uomId,
    salesUom: 'EA',
    costCurrency: 'USD',
    costingMethod: 'MOVING_AVG',
    trackInventory: false,
    revenueAccountId: 'REV-100',
    active: true,
    createdBy: userId,
    createdAt: now(),
    updatedAt: now(),
  });

const makeSalesInvoice = () =>
  new SalesInvoice({
    id: 'si_task241',
    companyId,
    invoiceNumber: 'SI-TASK241',
    formType: 'sales_invoice_service',
    voucherType: 'sales_invoice',
    persona: 'service',
    customerId,
    customerName: 'Task 241 Customer',
    invoiceDate: '2026-06-19',
    dueDate: '2026-06-19',
    currency: 'USD',
    exchangeRate: 1,
    lines: [{
      lineId: 'si_line_1',
      lineNo: 1,
      itemId,
      itemCode: 'TASK241-SVC',
      itemName: 'Task 241 Service',
      trackInventory: false,
      invoicedQty: 2,
      uomId,
      uom: 'EA',
      unitPriceDoc: 19.5,
      lineTotalDoc: 39,
      unitPriceBase: 19.5,
      lineTotalBase: 39,
      taxRate: 0,
      taxAmountDoc: 0,
      taxAmountBase: 0,
      revenueAccountId: 'REV-100',
    }],
    subtotalDoc: 39,
    taxTotalDoc: 0,
    grandTotalDoc: 39,
    subtotalBase: 39,
    taxTotalBase: 0,
    grandTotalBase: 39,
    paymentTermsDays: 0,
    paidAmountBase: 0,
    outstandingAmountBase: 39,
    status: 'DRAFT',
    createdBy: userId,
    createdAt: now(),
    updatedAt: now(),
  });

const makePurchaseInvoice = () =>
  new PurchaseInvoice({
    id: 'pi_task241',
    companyId,
    invoiceNumber: 'PI-TASK241',
    formType: 'purchase_invoice_service',
    voucherType: 'purchase_invoice',
    persona: 'service',
    vendorId,
    vendorName: 'Task 241 Vendor',
    invoiceDate: '2026-06-19',
    dueDate: '2026-06-19',
    currency: 'USD',
    exchangeRate: 1,
    lines: [{
      lineId: 'pi_line_1',
      lineNo: 1,
      itemId,
      itemCode: 'TASK241-SVC',
      itemName: 'Task 241 Service',
      trackInventory: false,
      invoicedQty: 3,
      uomId,
      uom: 'EA',
      unitPriceDoc: 7.25,
      lineTotalDoc: 21.75,
      unitPriceBase: 7.25,
      lineTotalBase: 21.75,
      taxRate: 0,
      taxAmountDoc: 0,
      taxAmountBase: 0,
      accountId: 'EXP-100',
    }],
    subtotalDoc: 21.75,
    taxTotalDoc: 0,
    grandTotalDoc: 21.75,
    subtotalBase: 21.75,
    taxTotalBase: 0,
    grandTotalBase: 21.75,
    paymentTermsDays: 0,
    paidAmountBase: 0,
    outstandingAmountBase: 21.75,
    status: 'DRAFT',
    createdBy: userId,
    createdAt: now(),
    updatedAt: now(),
  });

const assertPoint = (label, point, expected) => {
  if (!point) throw new Error(`${label} missing`);
  if (point.currency !== 'USD') throw new Error(`${label} currency expected USD, got ${point.currency}`);
  if (point.uomId !== uomId) throw new Error(`${label} uomId expected ${uomId}, got ${point.uomId}`);
  if (point.ccy !== expected) throw new Error(`${label} ccy expected ${expected}, got ${point.ccy}`);
};

(async () => {
  if (!admin.apps.length) {
    admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT });
  }

  const db = admin.firestore();
  const itemRepo = new FirestoreItemRepository(db);
  const partyItemPriceRepo = new FirestorePartyItemPriceRepository(db);
  const transactionManager = new FirestoreTransactionManager(db);
  const item = makeItem();
  const customer = createParty(customerId, 'CUSTOMER');
  const vendor = createParty(vendorId, 'VENDOR');
  let salesInvoice = makeSalesInvoice();
  let purchaseInvoice = makePurchaseInvoice();

  await itemRepo.createItem(item);

  const commonInventorySettingsRepo = {
    getSettings: async () => ({
      accountingMode: 'PERIODIC',
      inventoryAccountingMethod: 'PERIODIC',
      costingBasis: 'GLOBAL',
      inventoryFxCostBasis: 'REPLACEMENT',
      allowDeferredCost: true,
    }),
  };
  const companyCurrencyRepo = { getBaseCurrency: async () => 'USD' };
  const itemCategoryRepo = { getCompanyCategories: async () => [], getCategory: async () => null };
  const warehouseRepo = { getWarehouse: async () => null };
  const uomConversionRepo = { getConversionsForItem: async () => [] };
  const inventoryService = {
    preFetchLevelsByItem: async () => [],
    writeStockMovement: async () => undefined,
    writeStockLevel: async () => undefined,
  };
  const companyModuleRepo = { get: async () => null };
  const taxCodeRepo = { getById: async () => null };
  const partyRepo = {
    getById: async (_companyId, id) => {
      if (id === customerId) return customer;
      if (id === vendorId) return vendor;
      return null;
    },
  };

  const salesUseCase = new PostSalesInvoiceUseCase(
    { getSettings: async () => new SalesSettings({
      companyId,
      allowDirectInvoicing: true,
      requireSOForStockItems: false,
      defaultARAccountId: 'AR-100',
      defaultRevenueAccountId: 'REV-100',
      allowOverDelivery: false,
      overDeliveryTolerancePct: 0,
      overInvoiceTolerancePct: 0,
      defaultPaymentTermsDays: 0,
      governanceRules: [],
      soNumberPrefix: 'SO',
      soNumberNextSeq: 1,
      dnNumberPrefix: 'DN',
      dnNumberNextSeq: 1,
      siNumberPrefix: 'SI',
      siNumberNextSeq: 1,
      srNumberPrefix: 'SR',
      srNumberNextSeq: 1,
    }) },
    commonInventorySettingsRepo,
    { getById: async () => salesInvoice, update: async (next) => { salesInvoice = next; } },
    { getById: async () => null, update: async () => undefined },
    { getById: async () => null, list: async () => [] },
    partyRepo,
    taxCodeRepo,
    itemRepo,
    itemCategoryRepo,
    warehouseRepo,
    uomConversionRepo,
    companyCurrencyRepo,
    inventoryService,
    companyModuleRepo,
    {},
    undefined,
    transactionManager,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    partyItemPriceRepo
  );

  const purchaseUseCase = new PostPurchaseInvoiceUseCase(
    { getSettings: async () => new PurchaseSettings({
      companyId,
      allowDirectInvoicing: true,
      requirePOForStockItems: false,
      defaultAPAccountId: 'AP-100',
      defaultPurchaseExpenseAccountId: 'EXP-100',
      allowOverDelivery: false,
      overDeliveryTolerancePct: 0,
      overInvoiceTolerancePct: 0,
      defaultPaymentTermsDays: 0,
      poNumberPrefix: 'PO',
      poNumberNextSeq: 1,
      grnNumberPrefix: 'GRN',
      grnNumberNextSeq: 1,
      piNumberPrefix: 'PI',
      piNumberNextSeq: 1,
      prNumberPrefix: 'PR',
      prNumberNextSeq: 1,
    }) },
    commonInventorySettingsRepo,
    { getById: async () => purchaseInvoice, update: async (next) => { purchaseInvoice = next; } },
    { getById: async () => null, update: async () => undefined },
    partyRepo,
    taxCodeRepo,
    itemRepo,
    itemCategoryRepo,
    warehouseRepo,
    uomConversionRepo,
    companyCurrencyRepo,
    { getRate: async () => null, getLatestRate: async () => null },
    inventoryService,
    companyModuleRepo,
    {},
    undefined,
    transactionManager,
    undefined,
    undefined,
    undefined,
    undefined,
    partyItemPriceRepo
  );

  await salesUseCase.execute(companyId, salesInvoice.id, false);
  await purchaseUseCase.execute(companyId, purchaseInvoice.id, false);

  const storedItem = await itemRepo.getItem(itemId);
  const salePartyPrice = await partyItemPriceRepo.get(companyId, customerId, itemId);
  const purchasePartyPrice = await partyItemPriceRepo.get(companyId, vendorId, itemId);

  assertPoint('item last sale', storedItem.costingStats.lastSalePriceByCcyUom[key], 19.5);
  assertPoint('party last sale', salePartyPrice.lastSaleByCcyUom[key], 19.5);
  assertPoint('item last purchase', storedItem.costingStats.lastPurchaseCostByCcyUom[key], 7.25);
  assertPoint('party last purchase', purchasePartyPrice.lastPurchaseByCcyUom[key], 7.25);

  console.log(`Task 241 emulator smoke passed for ${companyId}: ${key}`);
})().catch((err) => {
  console.error(err);
  process.exitCode = 1;
}).finally(async () => {
  await admin.app().delete().catch(() => undefined);
});
