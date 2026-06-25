import { describe, expect, it, jest } from '@jest/globals';
import { PostPurchaseInvoiceUseCase } from '../../../application/purchases/use-cases/PurchaseInvoiceUseCases';
import {
  FinancialEvent,
  FinancialEventRecord,
  IAccountingBridge,
  PreBuiltVoucherEvent,
} from '../../../application/system-core/contracts/IAccountingBridge';
import { VoucherEntity } from '../../../domain/accounting/entities/VoucherEntity';
import { Item } from '../../../domain/inventory/entities/Item';
import { PurchaseInvoice } from '../../../domain/purchases/entities/PurchaseInvoice';
import { PurchaseSettings } from '../../../domain/purchases/entities/PurchaseSettings';
import { Party } from '../../../domain/shared/entities/Party';
import { TaxCode } from '../../../domain/shared/entities/TaxCode';

const COMPANY_ID = 'cmp-pi-golden';
const USER_ID = 'u-pi-golden';
const nowDate = () => new Date('2026-01-01T00:00:00.000Z');

class CapturingBridge implements IAccountingBridge {
  public events: FinancialEvent[] = [];

  async recordFinancialEvent(event: FinancialEvent): Promise<FinancialEventRecord> {
    this.events.push(event);
    return { mode: 'full', voucher: { id: `vch-pi-${this.events.length}` } as VoucherEntity };
  }

  async recordPreBuiltVoucher(_event: PreBuiltVoucherEvent): Promise<FinancialEventRecord> {
    throw new Error('Purchase Invoice document posting should not send prebuilt voucher events');
  }
}

const makeSettings = (): PurchaseSettings =>
  new PurchaseSettings({
    companyId: COMPANY_ID,
    allowDirectInvoicing: true,
    requirePOForStockItems: false,
    defaultAPAccountId: 'AP-100',
    defaultPurchaseExpenseAccountId: 'EXP-100',
    defaultGRNIAccountId: 'GRNI-100',
    allowOverDelivery: false,
    overDeliveryTolerancePct: 0,
    overInvoiceTolerancePct: 0,
    defaultPaymentTermsDays: 30,
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

const makeServiceItem = (): Item =>
  new Item({
    id: 'svc-1',
    companyId: COMPANY_ID,
    code: 'SVC-1',
    name: 'Service Item',
    type: 'SERVICE',
    baseUom: 'EA',
    purchaseUom: 'EA',
    salesUom: 'EA',
    costCurrency: 'USD',
    costingMethod: 'MOVING_AVG',
    trackInventory: false,
    cogsAccountId: 'EXP-500',
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

const makePI = (item = makeServiceItem()): PurchaseInvoice =>
  new PurchaseInvoice({
    id: 'pi-1',
    companyId: COMPANY_ID,
    invoiceNumber: 'PI-00001',
    formType: 'purchase_invoice_direct',
    voucherType: 'purchase_invoice',
    persona: 'direct',
    vendorId: 'ven-1',
    vendorName: 'Vendor One',
    invoiceDate: '2026-01-12',
    dueDate: '2026-02-11',
    currency: 'USD',
    exchangeRate: 1,
    lines: [
      {
        lineId: 'pi-line-1',
        lineNo: 1,
        itemId: item.id,
        itemCode: item.code,
        itemName: item.name,
        trackInventory: false,
        invoicedQty: 2,
        uom: 'EA',
        unitPriceDoc: 50,
        lineTotalDoc: 100,
        unitPriceBase: 50,
        lineTotalBase: 100,
        taxCodeId: 'tax-1',
        taxCode: 'VAT10',
        taxRate: 0.1,
        taxAmountDoc: 10,
        taxAmountBase: 10,
        accountId: 'EXP-500',
      },
    ],
    subtotalDoc: 100,
    taxTotalDoc: 10,
    grandTotalDoc: 110,
    subtotalBase: 100,
    taxTotalBase: 10,
    grandTotalBase: 110,
    paymentTermsDays: 30,
    paymentStatus: 'UNPAID',
    paidAmountBase: 0,
    outstandingAmountBase: 110,
    status: 'DRAFT',
    createdBy: USER_ID,
    createdAt: nowDate(),
    updatedAt: nowDate(),
  });

const makeInventorySettingsRepository = () => ({
  getSettings: jest.fn(async () => ({
    accountingMode: 'PERPETUAL',
    inventoryAccountingMethod: 'PERPETUAL',
    defaultInventoryAssetAccountId: 'INV-100',
    defaultCOGSAccountId: 'COGS-100',
    costingBasis: 'WAREHOUSE',
  })),
});

const makeCompanyModuleRepo = () => ({
  get: jest.fn(async () => ({ companyId: COMPANY_ID, moduleKey: 'accounting', initialized: true })),
});

function buildUseCase(bridge: IAccountingBridge, pi = makePI()) {
  const item = makeServiceItem();
  const piStore = new Map([[pi.id, pi]]);

  const useCase = new PostPurchaseInvoiceUseCase(
    { getSettings: jest.fn(async () => makeSettings()) } as any,
    makeInventorySettingsRepository() as any,
    {
      getById: jest.fn(async (_companyId: string, id: string) => piStore.get(id) ?? null),
      update: jest.fn(async (updated: PurchaseInvoice) => { piStore.set(updated.id, updated); }),
    } as any,
    { getById: jest.fn(async () => null), update: jest.fn(async () => undefined) } as any,
    { getById: jest.fn(async () => makeVendor()) } as any,
    { getById: jest.fn(async () => makeTaxCode()) } as any,
    {
      getItem: jest.fn(async () => item),
      updateItemInTransaction: jest.fn(async () => undefined),
    } as any,
    { getCategory: jest.fn(async () => null), getCompanyCategories: jest.fn(async () => []) } as any,
    { getWarehouse: jest.fn(async () => ({ id: 'wh-1', companyId: COMPANY_ID })) } as any,
    { getConversionsForItem: jest.fn(async () => []) } as any,
    { getBaseCurrency: jest.fn(async () => 'USD') } as any,
    { getMostRecentRateBeforeDate: jest.fn(async () => null) } as any,
    {
      preFetchLevelsByItem: jest.fn(async () => []),
      writeStockMovement: jest.fn(async () => undefined),
      writeStockLevel: jest.fn(async () => undefined),
    } as any,
    makeCompanyModuleRepo() as any,
    undefined,
    { runTransaction: jest.fn(async (fn: (transaction: any) => Promise<any>) => fn({ id: 'txn-pi' })) } as any,
    bridge,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined
  );

  return { useCase, pi };
}

describe('Purchase Invoice document vouchers — golden bridge output (Task 267-F PI slice)', () => {
  it('G1: service PI sends exact Expense/Tax/AP voucher output to the bridge', async () => {
    const bridge = new CapturingBridge();
    const { useCase, pi } = buildUseCase(bridge);

    await useCase.execute(COMPANY_ID, pi.id);

    expect(bridge.events).toHaveLength(1);
    const voucher = bridge.events[0].subledgerVoucher!;
    expect(bridge.events[0].kind).toBe('purchase_invoice');
    expect(voucher.companyId).toBe(COMPANY_ID);
    expect(voucher.voucherType).toBe('purchase_invoice');
    expect(voucher.voucherNo).toBe('PI-PI-00001');
    expect(voucher.date).toBe('2026-01-12');
    expect(voucher.currency).toBe('USD');
    expect(voucher.exchangeRate).toBe(1);
    expect(voucher.reference).toBe('PI-00001');
    expect(voucher.baseCurrencyOverride).toBe('USD');
    expect(voucher.metadata).toEqual({
      sourceModule: 'purchases',
      sourceType: 'PURCHASE_INVOICE',
      sourceId: 'pi-1',
    });
    expect(voucher.lines).toHaveLength(3);
    const expenseLine = voucher.lines.find((line: any) => line.accountId === 'EXP-500')!;
    const taxLine = voucher.lines.find((line: any) => line.accountId === 'TAX-500')!;
    const apLine = voucher.lines.find((line: any) => line.accountId === 'AP-200')!;
    expect(expenseLine.side).toBe('Debit');
    expect(expenseLine.baseAmount).toBe(100);
    expect(expenseLine.docAmount).toBe(100);
    expect(taxLine.side).toBe('Debit');
    expect(taxLine.baseAmount).toBe(10);
    expect(taxLine.docAmount).toBe(10);
    expect(apLine.side).toBe('Credit');
    expect(apLine.baseAmount).toBe(110);
    expect(apLine.docAmount).toBe(110);
    expect(pi.voucherId).toBe('vch-pi-1');
  });

  it('G2: createAccountingEffect=false posts no bridge event and links no voucher', async () => {
    const bridge = new CapturingBridge();
    const { useCase, pi } = buildUseCase(bridge);

    await useCase.execute(COMPANY_ID, pi.id, false);

    expect(bridge.events).toHaveLength(0);
    expect(pi.voucherId).toBeNull();
  });

  it('G3: output stability across repeated runs', async () => {
    const pi = makePI();
    const bridge1 = new CapturingBridge();
    const { useCase: useCase1 } = buildUseCase(bridge1, pi);
    await useCase1.execute(COMPANY_ID, pi.id);

    pi.status = 'DRAFT';
    pi.voucherId = null;
    const bridge2 = new CapturingBridge();
    const { useCase: useCase2 } = buildUseCase(bridge2, pi);
    await useCase2.execute(COMPANY_ID, pi.id);

    expect(bridge2.events[0].subledgerVoucher).toEqual(bridge1.events[0].subledgerVoucher);
  });
});
