import { describe, expect, it, jest } from '@jest/globals';
import { PostPurchaseReturnUseCase } from '../../../application/purchases/use-cases/PurchaseReturnUseCases';
import {
  FinancialEvent,
  FinancialEventRecord,
  IAccountingBridge,
  PreBuiltVoucherEvent,
} from '../../../application/system-core/contracts/IAccountingBridge';
import { VoucherEntity } from '../../../domain/accounting/entities/VoucherEntity';
import { VoucherType } from '../../../domain/accounting/types/VoucherTypes';
import { Item } from '../../../domain/inventory/entities/Item';
import { StockLevel } from '../../../domain/inventory/entities/StockLevel';
import { GoodsReceipt } from '../../../domain/purchases/entities/GoodsReceipt';
import { PurchaseInvoice } from '../../../domain/purchases/entities/PurchaseInvoice';
import { PurchaseOrder } from '../../../domain/purchases/entities/PurchaseOrder';
import { PurchaseReturn } from '../../../domain/purchases/entities/PurchaseReturn';
import { PurchaseSettings } from '../../../domain/purchases/entities/PurchaseSettings';
import { Party } from '../../../domain/shared/entities/Party';
import { TaxCode } from '../../../domain/shared/entities/TaxCode';

const COMPANY_ID = 'cmp-pr-golden';
const USER_ID = 'u-pr-golden';
const nowDate = () => new Date('2026-01-01T00:00:00.000Z');

class CapturingBridge implements IAccountingBridge {
  public events: FinancialEvent[] = [];

  constructor(private readonly mode: 'full' | 'minimal' = 'full') {}

  async recordFinancialEvent(event: FinancialEvent): Promise<FinancialEventRecord> {
    this.events.push(event);
    if (this.mode === 'minimal') return { mode: 'minimal', voucher: null };
    return { mode: 'full', voucher: { id: `vch-pr-${this.events.length}` } as VoucherEntity };
  }

  async recordPreBuiltVoucher(_event: PreBuiltVoucherEvent): Promise<FinancialEventRecord> {
    throw new Error('Purchase Return document posting should not send prebuilt voucher events');
  }
}

const makeSettings = (): PurchaseSettings =>
  new PurchaseSettings({
    companyId: COMPANY_ID,
    allowDirectInvoicing: true,
    requirePOForStockItems: true,
    defaultAPAccountId: 'AP-100',
    defaultPurchaseExpenseAccountId: 'EXP-100',
    defaultPurchaseReturnAccountId: 'PUR-RET-500',
    defaultGRNIAccountId: 'GRNI-500',
    allowOverDelivery: false,
    overDeliveryTolerancePct: 0,
    overInvoiceTolerancePct: 0,
    defaultPaymentTermsDays: 30,
    defaultWarehouseId: 'wh-1',
    poNumberPrefix: 'PO',
    poNumberNextSeq: 1,
    grnNumberPrefix: 'GRN',
    grnNumberNextSeq: 1,
    piNumberPrefix: 'PI',
    piNumberNextSeq: 1,
    prNumberPrefix: 'PR',
    prNumberNextSeq: 1,
  });

const makeVendor = (): Party =>
  new Party({
    id: 'ven-1',
    companyId: COMPANY_ID,
    code: 'V001',
    legalName: 'Vendor Legal',
    displayName: 'Vendor One',
    roles: ['VENDOR'],
    paymentTermsDays: 30,
    defaultCurrency: 'USD',
    defaultAPAccountId: 'AP-200',
    active: true,
    createdBy: USER_ID,
    createdAt: nowDate(),
    updatedAt: nowDate(),
  });

const makeItem = (): Item =>
  new Item({
    id: 'item-1',
    companyId: COMPANY_ID,
    code: 'IT-1',
    name: 'Stock Item',
    type: 'PRODUCT',
    baseUom: 'EA',
    purchaseUom: 'EA',
    salesUom: 'EA',
    costCurrency: 'USD',
    costingMethod: 'MOVING_AVG',
    trackInventory: true,
    inventoryAssetAccountId: 'INV-500',
    active: true,
    createdBy: USER_ID,
    createdAt: nowDate(),
    updatedAt: nowDate(),
  });

const makeTaxCode = (): TaxCode =>
  new TaxCode({
    id: 'tax-1',
    companyId: COMPANY_ID,
    code: 'VAT10',
    name: 'VAT 10%',
    rate: 0.1,
    taxType: 'VAT',
    scope: 'PURCHASE',
    purchaseTaxAccountId: 'TAX-500',
    active: true,
    createdBy: USER_ID,
    createdAt: nowDate(),
    updatedAt: nowDate(),
  });

const makePO = (): PurchaseOrder =>
  new PurchaseOrder({
    id: 'po-1',
    companyId: COMPANY_ID,
    orderNumber: 'PO-00001',
    vendorId: 'ven-1',
    vendorName: 'Vendor One',
    orderDate: '2026-01-10',
    currency: 'USD',
    exchangeRate: 1,
    lines: [{
      lineId: 'po-line-1',
      lineNo: 1,
      itemId: 'item-1',
      itemCode: 'IT-1',
      itemName: 'Stock Item',
      itemType: 'PRODUCT',
      trackInventory: true,
      orderedQty: 10,
      uom: 'EA',
      receivedQty: 5,
      invoicedQty: 5,
      returnedQty: 0,
      unitPriceDoc: 10,
      lineTotalDoc: 100,
      unitPriceBase: 10,
      lineTotalBase: 100,
      taxRate: 0.1,
      taxAmountDoc: 10,
      taxAmountBase: 10,
      warehouseId: 'wh-1',
    }],
    subtotalBase: 100,
    taxTotalBase: 10,
    grandTotalBase: 110,
    subtotalDoc: 100,
    taxTotalDoc: 10,
    grandTotalDoc: 110,
    status: 'PARTIALLY_RECEIVED',
    createdBy: USER_ID,
    createdAt: nowDate(),
    updatedAt: nowDate(),
  });

const makePostedPI = (): PurchaseInvoice =>
  new PurchaseInvoice({
    id: 'pi-1',
    companyId: COMPANY_ID,
    invoiceNumber: 'PI-00001',
    formType: 'purchase_invoice_linked',
    voucherType: 'purchase_invoice',
    persona: 'linked',
    purchaseOrderId: 'po-1',
    vendorId: 'ven-1',
    vendorName: 'Vendor One',
    invoiceDate: '2026-01-12',
    dueDate: '2026-02-11',
    currency: 'USD',
    exchangeRate: 1,
    lines: [{
      lineId: 'pi-line-1',
      lineNo: 1,
      poLineId: 'po-line-1',
      itemId: 'item-1',
      itemCode: 'IT-1',
      itemName: 'Stock Item',
      trackInventory: true,
      invoicedQty: 5,
      uom: 'EA',
      unitPriceDoc: 10,
      lineTotalDoc: 50,
      unitPriceBase: 10,
      lineTotalBase: 50,
      taxCodeId: 'tax-1',
      taxCode: 'VAT10',
      taxRate: 0.1,
      taxAmountDoc: 5,
      taxAmountBase: 5,
      warehouseId: 'wh-1',
      accountId: 'INV-500',
      stockMovementId: 'mov-origin-1',
    }],
    subtotalDoc: 50,
    taxTotalDoc: 5,
    grandTotalDoc: 55,
    subtotalBase: 50,
    taxTotalBase: 5,
    grandTotalBase: 55,
    paymentTermsDays: 30,
    paymentStatus: 'UNPAID',
    paidAmountBase: 0,
    outstandingAmountBase: 55,
    status: 'POSTED',
    voucherId: 'v-pi-1',
    createdBy: USER_ID,
    createdAt: nowDate(),
    updatedAt: nowDate(),
    postedAt: nowDate(),
  });

const makePostedGRN = (): GoodsReceipt =>
  new GoodsReceipt({
    id: 'grn-1',
    companyId: COMPANY_ID,
    grnNumber: 'GRN-00001',
    purchaseOrderId: 'po-1',
    vendorId: 'ven-1',
    vendorName: 'Vendor One',
    receiptDate: '2026-01-11',
    warehouseId: 'wh-1',
    lines: [{
      lineId: 'grn-line-1',
      lineNo: 1,
      poLineId: 'po-line-1',
      itemId: 'item-1',
      itemCode: 'IT-1',
      itemName: 'Stock Item',
      receivedQty: 5,
      uom: 'EA',
      unitCostDoc: 10,
      unitCostBase: 10,
      moveCurrency: 'USD',
      fxRateMovToBase: 1,
      fxRateCCYToBase: 1,
      stockMovementId: 'mov-grn-1',
    }],
    status: 'POSTED',
    createdBy: USER_ID,
    createdAt: nowDate(),
    updatedAt: nowDate(),
    postedAt: nowDate(),
  });

const makeAfterInvoiceReturn = (): PurchaseReturn =>
  new PurchaseReturn({
    id: 'pr-1',
    companyId: COMPANY_ID,
    returnNumber: 'PR-00001',
    purchaseInvoiceId: 'pi-1',
    purchaseOrderId: 'po-1',
    vendorId: 'ven-1',
    vendorName: 'Vendor One',
    returnContext: 'AFTER_INVOICE',
    returnDate: '2026-01-15',
    warehouseId: 'wh-1',
    currency: 'USD',
    exchangeRate: 1,
    lines: [{
      lineId: 'pr-line-1',
      lineNo: 1,
      piLineId: 'pi-line-1',
      poLineId: 'po-line-1',
      itemId: 'item-1',
      itemCode: 'IT-1',
      itemName: 'Stock Item',
      returnQty: 2,
      uom: 'EA',
      unitCostDoc: 10,
      unitCostBase: 10,
      fxRateMovToBase: 1,
      fxRateCCYToBase: 1,
      taxCodeId: 'tax-1',
      taxCode: 'VAT10',
      taxRate: 0.1,
      taxAmountDoc: 2,
      taxAmountBase: 2,
      accountId: 'INV-500',
      stockMovementId: null,
    }],
    subtotalDoc: 20,
    taxTotalDoc: 2,
    grandTotalDoc: 22,
    subtotalBase: 20,
    taxTotalBase: 2,
    grandTotalBase: 22,
    reason: 'Damaged goods',
    status: 'DRAFT',
    createdBy: USER_ID,
    createdAt: nowDate(),
    updatedAt: nowDate(),
  });

const makeBeforeInvoiceReturn = (): PurchaseReturn =>
  new PurchaseReturn({
    id: 'pr-2',
    companyId: COMPANY_ID,
    returnNumber: 'PR-00002',
    goodsReceiptId: 'grn-1',
    purchaseOrderId: 'po-1',
    vendorId: 'ven-1',
    vendorName: 'Vendor One',
    returnContext: 'BEFORE_INVOICE',
    returnDate: '2026-01-15',
    warehouseId: 'wh-1',
    currency: 'USD',
    exchangeRate: 1,
    lines: [{
      lineId: 'pr-line-2',
      lineNo: 1,
      grnLineId: 'grn-line-1',
      poLineId: 'po-line-1',
      itemId: 'item-1',
      itemCode: 'IT-1',
      itemName: 'Stock Item',
      returnQty: 2,
      uom: 'EA',
      unitCostDoc: 10,
      unitCostBase: 10,
      fxRateMovToBase: 1,
      fxRateCCYToBase: 1,
      taxRate: 0,
      taxAmountDoc: 0,
      taxAmountBase: 0,
      stockMovementId: null,
    }],
    subtotalDoc: 20,
    taxTotalDoc: 0,
    grandTotalDoc: 20,
    subtotalBase: 20,
    taxTotalBase: 0,
    grandTotalBase: 20,
    reason: 'Rejected lot',
    status: 'DRAFT',
    createdBy: USER_ID,
    createdAt: nowDate(),
    updatedAt: nowDate(),
  });

const makeInventorySettingsRepository = (mode: 'PERIODIC' | 'INVOICE_DRIVEN' | 'PERPETUAL') => ({
  getSettings: jest.fn(async () => ({
    accountingMode: mode,
    inventoryAccountingMethod: mode === 'PERPETUAL' ? 'PERPETUAL' : 'PERIODIC',
    defaultInventoryAssetAccountId: 'INV-500',
  })),
});

const makeCompanyModuleRepo = () => ({
  get: jest.fn(async () => ({ companyId: COMPANY_ID, moduleKey: 'accounting', initialized: true })),
});

function buildUseCase(
  bridge: IAccountingBridge,
  purchaseReturn = makeAfterInvoiceReturn(),
  mode: 'PERIODIC' | 'INVOICE_DRIVEN' | 'PERPETUAL' = 'PERIODIC'
) {
  const item = makeItem();
  const po = makePO();
  const pi = makePostedPI();
  const grn = makePostedGRN();
  const vendor = makeVendor();
  const taxCode = makeTaxCode();
  const returnStore = new Map([[purchaseReturn.id, purchaseReturn]]);

  const useCase = new PostPurchaseReturnUseCase(
    { getSettings: jest.fn(async () => makeSettings()) } as any,
    makeInventorySettingsRepository(mode) as any,
    {
      getById: jest.fn(async (_companyId: string, id: string) => returnStore.get(id) ?? null),
      list: jest.fn(async () => []),
      update: jest.fn(async (updated: PurchaseReturn) => { returnStore.set(updated.id, updated); }),
    } as any,
    { getSettings: jest.fn(async () => null) } as any,
    { getById: jest.fn(async () => pi), update: jest.fn(async () => undefined) } as any,
    { getById: jest.fn(async () => grn), list: jest.fn(async () => []) } as any,
    { getById: jest.fn(async () => po), update: jest.fn(async () => undefined) } as any,
    { getById: jest.fn(async () => vendor) } as any,
    { getById: jest.fn(async () => taxCode) } as any,
    {
      getItem: jest.fn(async () => item),
      updateItemInTransaction: jest.fn(async () => undefined),
    } as any,
    { getById: jest.fn(async () => ({ defaultInventoryAccountId: 'INV-500' })) } as any,
    { getConversionsForItem: jest.fn(async () => []) } as any,
    { getBaseCurrency: jest.fn(async () => 'USD') } as any,
    {
      preFetchStockLevel: jest.fn(async () => StockLevel.createNew(COMPANY_ID, item.id, 'wh-1')),
      writeStockMovement: jest.fn(async () => undefined),
      writeStockLevel: jest.fn(async () => undefined),
    } as any,
    makeCompanyModuleRepo() as any,
    {
      getById: jest.fn(async (_companyId: string, id: string) => ({ id })),
      getByUserCode: jest.fn(async (_companyId: string, code: string) => ({ id: code })),
    } as any,
    { runTransaction: jest.fn(async (fn: (transaction: any) => Promise<any>) => fn({ id: 'txn-pr' })) } as any,
    bridge,
    undefined,
    undefined
  );

  return { useCase, purchaseReturn };
}

describe('Purchase Return document vouchers — golden bridge output (Task 267-F PR slice)', () => {
  it('G1: AFTER_INVOICE return sends exact AP/return/tax reversal voucher output to the bridge', async () => {
    const bridge = new CapturingBridge();
    const { useCase, purchaseReturn } = buildUseCase(bridge);

    await useCase.execute(COMPANY_ID, purchaseReturn.id);

    expect(bridge.events).toHaveLength(1);
    const voucher = bridge.events[0].subledgerVoucher!;
    expect(bridge.events[0].kind).toBe('PURCHASE_RETURN');
    expect(voucher.companyId).toBe(COMPANY_ID);
    expect(voucher.voucherType).toBe(VoucherType.PURCHASE_RETURN);
    expect(voucher.voucherNo).toBe('RET-VCH-PR-00001');
    expect(voucher.date).toBe('2026-01-15');
    expect(voucher.currency).toBe('USD');
    expect(voucher.exchangeRate).toBe(1);
    expect(voucher.reference).toBe('PR-00001');
    expect(voucher.baseCurrencyOverride).toBe('USD');
    expect(voucher.metadata).toEqual({
      sourceModule: 'purchases',
      sourceType: 'PURCHASE_RETURN',
      sourceId: 'pr-1',
      originType: 'purchase_return',
    });
    expect(voucher.lines).toHaveLength(3);
    const returnLine = voucher.lines.find((line: any) => line.accountId === 'PUR-RET-500')!;
    const taxLine = voucher.lines.find((line: any) => line.accountId === 'TAX-500')!;
    const apLine = voucher.lines.find((line: any) => line.accountId === 'AP-200')!;
    expect(returnLine.side).toBe('Credit');
    expect(returnLine.baseAmount).toBe(20);
    expect(returnLine.docAmount).toBe(20);
    expect(taxLine.side).toBe('Credit');
    expect(taxLine.baseAmount).toBe(2);
    expect(taxLine.docAmount).toBe(2);
    expect(apLine.side).toBe('Debit');
    expect(apLine.baseAmount).toBe(22);
    expect(apLine.docAmount).toBe(22);
    expect(purchaseReturn.voucherId).toBe('vch-pr-1');
  });

  it('G2: BEFORE_INVOICE PERPETUAL return sends exact GRNI/Inventory reversal voucher output', async () => {
    const bridge = new CapturingBridge();
    const purchaseReturn = makeBeforeInvoiceReturn();
    const { useCase } = buildUseCase(bridge, purchaseReturn, 'PERPETUAL');

    await useCase.execute(COMPANY_ID, purchaseReturn.id);

    expect(bridge.events).toHaveLength(1);
    const voucher = bridge.events[0].subledgerVoucher!;
    expect(voucher.voucherNo).toBe('RET-VCH-PR-00002');
    expect(voucher.lines).toHaveLength(2);
    const inventoryLine = voucher.lines.find((line: any) => line.accountId === 'INV-500')!;
    const grniLine = voucher.lines.find((line: any) => line.accountId === 'GRNI-500')!;
    expect(inventoryLine.side).toBe('Credit');
    expect(inventoryLine.baseAmount).toBe(20);
    expect(inventoryLine.docAmount).toBe(20);
    expect(grniLine.side).toBe('Debit');
    expect(grniLine.baseAmount).toBe(20);
    expect(grniLine.docAmount).toBe(20);
    expect(purchaseReturn.voucherId).toBe('vch-pr-1');
  });

  it('G3: createAccountingEffect=false posts no bridge event and links no voucher', async () => {
    const bridge = new CapturingBridge();
    const { useCase, purchaseReturn } = buildUseCase(bridge);

    await useCase.execute(COMPANY_ID, purchaseReturn.id, false);

    expect(bridge.events).toHaveLength(0);
    expect(purchaseReturn.voucherId).toBeNull();
  });

  it('G4: minimal mode records the event but links no GL voucher', async () => {
    const bridge = new CapturingBridge('minimal');
    const { useCase, purchaseReturn } = buildUseCase(bridge);

    await useCase.execute(COMPANY_ID, purchaseReturn.id);

    expect(bridge.events).toHaveLength(1);
    expect(purchaseReturn.voucherId).toBeNull();
  });

  it('G5: voucher output is stable across repeated runs', async () => {
    const bridgeA = new CapturingBridge();
    const first = buildUseCase(bridgeA);
    await first.useCase.execute(COMPANY_ID, first.purchaseReturn.id);

    const bridgeB = new CapturingBridge();
    const second = buildUseCase(bridgeB);
    await second.useCase.execute(COMPANY_ID, second.purchaseReturn.id);

    expect(bridgeB.events[0].subledgerVoucher).toEqual(bridgeA.events[0].subledgerVoucher);
  });
});
