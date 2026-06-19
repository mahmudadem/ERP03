const admin = require('firebase-admin');

process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'erp-03';
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';

const { InventorySettings } = require('../lib/backend/src/domain/inventory/entities/InventorySettings');
const { Item } = require('../lib/backend/src/domain/inventory/entities/Item');
const { Party } = require('../lib/backend/src/domain/shared/entities/Party');
const { GetEffectivePriceUseCase } = require('../lib/backend/src/application/sales/use-cases/PriceListUseCases');
const { GetEffectivePurchasePriceUseCase } = require('../lib/backend/src/application/purchases/use-cases/PurchasePriceListUseCases');
const { FirestoreInventorySettingsRepository } = require('../lib/backend/src/infrastructure/firestore/repositories/inventory/FirestoreInventorySettingsRepository');
const { FirestoreItemRepository } = require('../lib/backend/src/infrastructure/firestore/repositories/inventory/FirestoreItemRepository');
const { FirestorePartyRepository } = require('../lib/backend/src/infrastructure/firestore/repositories/shared/FirestorePartyRepository');
const { FirestorePartyItemPriceRepository } = require('../lib/backend/src/infrastructure/firestore/repositories/shared/FirestorePartyItemPriceRepository');
const { FirestorePriceListRepository } = require('../lib/backend/src/infrastructure/firestore/repositories/sales/FirestorePriceListRepository');
const { FirestorePurchasePriceListRepository } = require('../lib/backend/src/infrastructure/firestore/repositories/purchases/FirestorePurchasePriceListRepository');

const now = () => new Date('2026-06-19T00:00:00.000Z');
const runId = Date.now();
const companyId = `cmp_task242_${runId}`;
const userId = 'task242-smoke';
const itemId = `item_task242_${runId}`;
const customerReturningId = `cust_task242_returning_${runId}`;
const customerNewId = `cust_task242_new_${runId}`;
const vendorReturningId = `vend_task242_returning_${runId}`;
const vendorNewId = `vend_task242_new_${runId}`;
const uomId = 'uom_each';

const point = (ccy) => ({
  base: ccy,
  ccy,
  currency: 'USD',
  fxRateToBase: 1,
  asOf: '2026-06-19',
  qty: 1,
  uomId,
});

const makeParty = (id, role, code) =>
  new Party({
    id,
    companyId,
    code,
    legalName: code,
    displayName: code,
    roles: [role],
    defaultCurrency: 'USD',
    active: true,
    createdBy: userId,
    createdAt: now(),
    updatedAt: now(),
  });

const makeItem = () =>
  new Item({
    id: itemId,
    companyId,
    code: 'TASK242-ITEM',
    name: 'Task 242 Item',
    type: 'PRODUCT',
    baseUomId: uomId,
    baseUom: 'EA',
    purchaseUomId: uomId,
    purchaseUom: 'EA',
    salesUomId: uomId,
    salesUom: 'EA',
    costCurrency: 'USD',
    costingMethod: 'MOVING_AVG',
    trackInventory: true,
    salePrice: 99,
    purchasePrice: 66,
    costingStats: {
      avgCost: point(40),
      lastSalePriceByCcyUom: { [`USD__${uomId}`]: point(88) },
      lastPurchaseCostByCcyUom: { [`USD__${uomId}`]: point(55) },
    },
    inventoryAssetAccountId: 'INV-100',
    revenueAccountId: 'REV-100',
    cogsAccountId: 'COGS-100',
    active: true,
    createdBy: userId,
    createdAt: now(),
    updatedAt: now(),
  });

const assertResult = (label, result, expectedPrice) => {
  if (!result) throw new Error(`${label} expected a result`);
  if (result.source !== 'LAST_PARTY_PRICE') throw new Error(`${label} expected LAST_PARTY_PRICE, got ${result.source}`);
  if (result.unitPrice !== expectedPrice) throw new Error(`${label} expected ${expectedPrice}, got ${result.unitPrice}`);
};

(async () => {
  if (!admin.apps.length) {
    admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT });
  }

  const db = admin.firestore();
  const inventorySettingsRepo = new FirestoreInventorySettingsRepository(db);
  const itemRepo = new FirestoreItemRepository(db);
  const partyRepo = new FirestorePartyRepository(db);
  const partyItemPriceRepo = new FirestorePartyItemPriceRepository(db);
  const salesPriceListRepo = new FirestorePriceListRepository(db);
  const purchasePriceListRepo = new FirestorePurchasePriceListRepository(db);

  await inventorySettingsRepo.saveSettings(new InventorySettings({
    companyId,
    accountingMode: 'PERPETUAL',
    inventoryAccountingMethod: 'PERPETUAL',
    defaultCostingMethod: 'MOVING_AVG',
    costingBasis: 'GLOBAL',
    inventoryFxCostBasis: 'REPLACEMENT',
    defaultLinePriceSource: 'LAST_PARTY_PRICE',
    defaultCostCurrency: 'USD',
    allowNegativeStock: false,
    autoGenerateItemCode: false,
    itemCodeNextSeq: 1,
  }));
  await itemRepo.createItem(makeItem());
  await partyRepo.create(makeParty(customerReturningId, 'CUSTOMER', 'TASK242-CUST-RETURN'));
  await partyRepo.create(makeParty(customerNewId, 'CUSTOMER', 'TASK242-CUST-NEW'));
  await partyRepo.create(makeParty(vendorReturningId, 'VENDOR', 'TASK242-VEND-RETURN'));
  await partyRepo.create(makeParty(vendorNewId, 'VENDOR', 'TASK242-VEND-NEW'));
  await partyItemPriceRepo.upsertLastPrice({
    companyId,
    partyId: customerReturningId,
    itemId,
    direction: 'SALE',
    pricePoint: point(123.45),
  });
  await partyItemPriceRepo.upsertLastPrice({
    companyId,
    partyId: vendorReturningId,
    itemId,
    direction: 'PURCHASE',
    pricePoint: point(54.32),
  });

  const salesResolver = new GetEffectivePriceUseCase(
    salesPriceListRepo,
    partyRepo,
    partyItemPriceRepo,
    itemRepo,
    inventorySettingsRepo
  );
  const purchaseResolver = new GetEffectivePurchasePriceUseCase(
    purchasePriceListRepo,
    partyRepo,
    partyItemPriceRepo,
    itemRepo,
    inventorySettingsRepo
  );

  assertResult('returning customer', await salesResolver.execute({
    companyId,
    customerId: customerReturningId,
    itemId,
    qty: 1,
    currency: 'USD',
    uomId,
  }), 123.45);

  const newCustomer = await salesResolver.execute({
    companyId,
    customerId: customerNewId,
    itemId,
    qty: 1,
    currency: 'USD',
    uomId,
  });
  if (newCustomer !== null) {
    throw new Error(`new customer expected blank/null; got ${JSON.stringify(newCustomer)}`);
  }

  assertResult('returning vendor', await purchaseResolver.execute({
    companyId,
    vendorId: vendorReturningId,
    itemId,
    qty: 1,
    currency: 'USD',
    uomId,
  }), 54.32);

  const newVendor = await purchaseResolver.execute({
    companyId,
    vendorId: vendorNewId,
    itemId,
    qty: 1,
    currency: 'USD',
    uomId,
  });
  if (newVendor !== null) {
    throw new Error(`new vendor expected blank/null; got ${JSON.stringify(newVendor)}`);
  }

  console.log(`Task 242 emulator smoke passed for ${companyId}: returning parties resolved, new parties blank`);
})().catch((err) => {
  console.error(err);
  process.exitCode = 1;
}).finally(async () => {
  await admin.app().delete().catch(() => undefined);
});
