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

const makeStockItem = (): Item =>
  new Item({
    id: 'stock-1',
    companyId: COMPANY_ID,
    code: 'STK-1',
    name: 'Stock Item',
    type: 'PRODUCT',
    baseUom: 'EA',
    purchaseUom: 'EA',
    salesUom: 'EA',
    costCurrency: 'USD',
    costingMethod: 'MOVING_AVG',
    trackInventory: true,
    inventoryAssetAccountId: 'INV-100',
    cogsAccountId: 'COGS-100',
    active: true,
    createdBy: USER_ID,
    createdAt: nowDate(),
    updatedAt: nowDate(),
  });

const makeTaxCode = (overrides: Partial<ConstructorParameters<typeof TaxCode>[0]> = {}): TaxCode =>
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
    ...overrides,
  });

const makePI = (
  item = makeServiceItem(),
  lineOverrides: Partial<PurchaseInvoice['lines'][number]> = {}
): PurchaseInvoice =>
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
        trackInventory: item.trackInventory,
        invoicedQty: lineOverrides.invoicedQty ?? 2,
        uom: 'EA',
        unitPriceDoc: lineOverrides.unitPriceDoc ?? 50,
        lineTotalDoc: lineOverrides.lineTotalDoc ?? 100,
        unitPriceBase: lineOverrides.unitPriceBase ?? 50,
        lineTotalBase: lineOverrides.lineTotalBase ?? 100,
        taxCodeId: 'tax-1',
        taxCode: 'VAT10',
        taxRate: 0.1,
        purchaseTaxTreatment: lineOverrides.purchaseTaxTreatment,
        priceIsInclusive: lineOverrides.priceIsInclusive,
        taxAmountDoc: lineOverrides.taxAmountDoc ?? 10,
        taxAmountBase: lineOverrides.taxAmountBase ?? 10,
        warehouseId: lineOverrides.warehouseId,
        accountId: item.trackInventory ? 'INV-100' : 'EXP-500',
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

function buildUseCase(
  bridge: IAccountingBridge,
  pi = makePI(),
  item = makeServiceItem(),
  taxCode = makeTaxCode()
) {
  const piStore = new Map([[pi.id, pi]]);
  const movements: any[] = [];
  const levels: any[] = [];

  const useCase = new PostPurchaseInvoiceUseCase(
    { getSettings: jest.fn(async () => makeSettings()) } as any,
    makeInventorySettingsRepository() as any,
    {
      getById: jest.fn(async (_companyId: string, id: string) => piStore.get(id) ?? null),
      update: jest.fn(async (updated: PurchaseInvoice) => { piStore.set(updated.id, updated); }),
    } as any,
    { getById: jest.fn(async () => null), update: jest.fn(async () => undefined) } as any,
    { getById: jest.fn(async () => makeVendor()) } as any,
    { getById: jest.fn(async () => taxCode) } as any,
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
      writeStockMovement: jest.fn(async (movement: any) => { movements.push(movement); }),
      writeStockLevel: jest.fn(async (level: any) => { levels.push(level); }),
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

  return { useCase, pi, movements, levels };
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

  it('G4: non-recoverable exclusive purchase tax capitalizes into stock cost with no tax line', async () => {
    const bridge = new CapturingBridge();
    const item = makeStockItem();
    const taxCode = makeTaxCode({ purchaseTaxTreatment: 'NON_RECOVERABLE' });
    const pi = makePI(item, {
      invoicedQty: 1,
      unitPriceDoc: 1200,
      lineTotalDoc: 1200,
      unitPriceBase: 1200,
      lineTotalBase: 1200,
      taxAmountDoc: 120,
      taxAmountBase: 120,
      warehouseId: 'wh-1',
    });
    const { useCase, movements, levels } = buildUseCase(bridge, pi, item, taxCode);

    await useCase.execute(COMPANY_ID, pi.id);

    const voucher = bridge.events[0].subledgerVoucher!;
    expect(voucher.lines).toHaveLength(2);
    expect(voucher.lines.find((line: any) => line.accountId === 'TAX-500')).toBeUndefined();
    const inventoryLine = voucher.lines.find((line: any) => line.accountId === 'INV-100')!;
    const apLine = voucher.lines.find((line: any) => line.accountId === 'AP-200')!;
    expect(inventoryLine.side).toBe('Debit');
    expect(inventoryLine.baseAmount).toBe(1320);
    expect(inventoryLine.docAmount).toBe(1320);
    expect(apLine.side).toBe('Credit');
    expect(apLine.baseAmount).toBe(1320);
    expect(apLine.docAmount).toBe(1320);
    expect(pi.lines[0].lineTotalBase).toBe(1320);
    expect(pi.lines[0].taxAmountBase).toBe(0);
    expect(movements).toHaveLength(1);
    expect(movements[0].unitCostBase).toBe(1320);
    expect(movements[0].totalCostBase).toBe(1320);
    expect(levels[0].avgCostBase).toBe(1320);
  });

  it('G5: non-recoverable inclusive purchase tax keeps gross as cost with no tax line', async () => {
    const bridge = new CapturingBridge();
    const taxCode = makeTaxCode({ priceIsInclusive: true, purchaseTaxTreatment: 'NON_RECOVERABLE' });
    const pi = makePI(makeServiceItem(), {
      invoicedQty: 1,
      unitPriceDoc: 1200,
      lineTotalDoc: 1090.91,
      unitPriceBase: 1090.91,
      lineTotalBase: 1090.91,
      taxAmountDoc: 109.09,
      taxAmountBase: 109.09,
      priceIsInclusive: true,
    });
    const { useCase } = buildUseCase(bridge, pi, makeServiceItem(), taxCode);

    await useCase.execute(COMPANY_ID, pi.id);

    const voucher = bridge.events[0].subledgerVoucher!;
    expect(voucher.lines).toHaveLength(2);
    expect(voucher.lines.find((line: any) => line.accountId === 'TAX-500')).toBeUndefined();
    const expenseLine = voucher.lines.find((line: any) => line.accountId === 'EXP-500')!;
    const apLine = voucher.lines.find((line: any) => line.accountId === 'AP-200')!;
    expect(expenseLine.baseAmount).toBe(1200);
    expect(expenseLine.docAmount).toBe(1200);
    expect(apLine.baseAmount).toBe(1200);
    expect(apLine.docAmount).toBe(1200);
    expect(pi.lines[0].lineTotalBase).toBe(1200);
    expect(pi.lines[0].taxAmountBase).toBe(0);
  });
});
