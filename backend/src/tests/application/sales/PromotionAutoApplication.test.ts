import { describe, expect, it, jest } from '@jest/globals';
import { PromotionRule } from '../../../domain/sales/entities/PromotionRule';
import { SalesSettings } from '../../../domain/sales/entities/SalesSettings';
import { Party } from '../../../domain/shared/entities/Party';
import { Item } from '../../../domain/inventory/entities/Item';
import {
  CreateSalesOrderUseCase,
} from '../../../application/sales/use-cases/SalesOrderUseCases';
import {
  CreateSalesInvoiceUseCase,
} from '../../../application/sales/use-cases/SalesInvoiceUseCases';
import { IPromotionRuleRepository } from '../../../repository/interfaces/sales/IPromotionRuleRepository';

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------

const COMPANY_ID = 'cmp-test';
const CUSTOMER_ID = 'cust-1';
const USER_ID = 'u-test';
const USD = 'USD';
const ORDER_DATE = '2026-05-20';

const nowDate = () => new Date('2026-05-20T00:00:00.000Z');

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

const makeSettings = (): SalesSettings =>
  new SalesSettings({
    companyId: COMPANY_ID,
    workflowMode: 'SIMPLE',
    allowDirectInvoicing: true,
    requireSOForStockItems: true,
    defaultARAccountId: 'AR-100',
    defaultRevenueAccountId: 'REV-100',
    defaultCOGSAccountId: 'COGS-100',
    allowOverDelivery: false,
    overDeliveryTolerancePct: 0,
    overInvoiceTolerancePct: 0,
    defaultPaymentTermsDays: 30,
    governanceRules: [],
    defaultWarehouseId: 'wh-1',
    soNumberPrefix: 'SO',
    soNumberNextSeq: 1,
    siNumberPrefix: 'SI',
    siNumberNextSeq: 1,
    dnNumberPrefix: 'DN',
    dnNumberNextSeq: 1,
    srNumberPrefix: 'SR',
    srNumberNextSeq: 1,
  });

const makeCustomer = (): Party =>
  new Party({
    id: CUSTOMER_ID,
    companyId: COMPANY_ID,
    code: 'C001',
    legalName: 'Test Customer',
    displayName: 'Test Customer',
    roles: ['CUSTOMER'],
    defaultCurrency: USD,
    paymentTermsDays: 30,
    active: true,
    createdBy: USER_ID,
    createdAt: nowDate(),
    updatedAt: nowDate(),
  });

const makeItem = (overrides: Record<string, any> = {}): Item =>
  new Item({
    id: overrides.id || 'item-1',
    companyId: COMPANY_ID,
    code: overrides.code || 'IT-1',
    name: overrides.name || 'Test Item',
    type: 'PRODUCT',
    trackInventory: true,
    baseUom: 'EA',
    costCurrency: USD,
    costingMethod: 'MOVING_AVG',
    active: true,
    createdBy: USER_ID,
    createdAt: nowDate(),
    updatedAt: nowDate(),
    ...overrides,
  });

const makeThresholdRule = (overrides: Record<string, any> = {}): PromotionRule =>
  new PromotionRule({
    companyId: COMPANY_ID,
    name: '10% off qty >= 5',
    type: 'THRESHOLD_DISCOUNT',
    status: 'ACTIVE',
    scope: 'ALL',
    thresholdDiscount: { thresholdBasis: 'QTY', thresholdValue: 5, discountPct: 10 },
    createdBy: USER_ID,
    ...overrides,
  });

const makeBxgyRule = (overrides: Record<string, any> = {}): PromotionRule =>
  new PromotionRule({
    companyId: COMPANY_ID,
    name: 'Buy 3 Get 1 Free',
    type: 'BUY_X_GET_Y',
    status: 'ACTIVE',
    scope: 'ALL',
    buyXGetY: { buyQty: 3, getQty: 1 },
    createdBy: USER_ID,
    ...overrides,
  });

const makePromoRepo = (rules: PromotionRule[]): any => ({
  create: jest.fn(async () => {}),
  update: jest.fn(async () => {}),
  getById: jest.fn(async () => null),
  list: jest.fn(async () => rules),
  delete: jest.fn(async () => {}),
});

// ---------------------------------------------------------------------------
// Tests — Sales Order
// ---------------------------------------------------------------------------

describe('CreateSalesOrderUseCase — promotion auto-invocation', () => {
  it('applies a threshold discount promotion to matching SO lines', async () => {
    const settings = makeSettings();
    const item = makeItem();
    const thresholdRule = makeThresholdRule({
      thresholdDiscount: { thresholdBasis: 'QTY', thresholdValue: 5, discountPct: 10 },
    });

    const useCase = new CreateSalesOrderUseCase(
      { getSettings: jest.fn(async () => settings), saveSettings: jest.fn(async () => {}) } as any,
      { create: jest.fn(async () => {}), update: jest.fn(), getById: jest.fn(), getByNumber: jest.fn(async () => null), list: jest.fn(), delete: jest.fn(), hasOpenOrders: jest.fn(async () => false) } as any,
      { getById: jest.fn(async () => makeCustomer()) } as any,
      { getItem: jest.fn(async () => item) } as any,
      { getById: jest.fn(async () => null) } as any,
      { isEnabled: jest.fn(async () => true) } as any,
      makePromoRepo([thresholdRule]),
    );

    const so = await useCase.execute({
      companyId: COMPANY_ID,
      customerId: CUSTOMER_ID,
      orderDate: ORDER_DATE,
      currency: USD,
      exchangeRate: 1,
      lines: [{
        itemId: 'item-1',
        orderedQty: 10,
        uom: 'EA',
        unitPriceDoc: 100,
      }],
      createdBy: USER_ID,
    });

    // The line should have the promotion applied
    const line = so.lines[0]!;
    expect(line.appliedPromotionId).toBe(thresholdRule.id);
    expect(line.appliedPromotionName).toBe('10% off qty >= 5');
    expect(line.appliedDiscountPct).toBe(10);

    // Total should reflect 10% discount: 10 * 100 = 1000 → 10% off = 900
    expect(line.lineTotalDoc).toBe(900);
    expect(so.appliedPromotions).toBeDefined();
    expect(so.appliedPromotions!.length).toBe(1);
    expect(so.appliedPromotions![0]!.type).toBe('THRESHOLD_DISCOUNT');

    // Grand total reflects discount
    expect(so.subtotalDoc).toBe(900);
  });

  it('adds free goods for a Buy-X-Get-Y promotion on SO', async () => {
    const settings = makeSettings();
    const item1 = makeItem({ id: 'item-1' });
    const item2 = makeItem({ id: 'item-1' }); // free item lookup returns same item
    const items = [item1, item2];
    const bxgyRule = makeBxgyRule({
      buyXGetY: { buyQty: 3, getQty: 1 },
    });

    const useCase = new CreateSalesOrderUseCase(
      { getSettings: jest.fn(async () => settings), saveSettings: jest.fn(async () => {}) } as any,
      { create: jest.fn(async () => {}), update: jest.fn(), getById: jest.fn(), getByNumber: jest.fn(async () => null), list: jest.fn(), delete: jest.fn(), hasOpenOrders: jest.fn(async () => false) } as any,
      { getById: jest.fn(async () => makeCustomer()) } as any,
      { getItem: jest.fn(async (id: string) => items.find((i) => i.id === id) || null) } as any,
      { getById: jest.fn(async () => null) } as any,
      { isEnabled: jest.fn(async () => true) } as any,
      makePromoRepo([bxgyRule]),
    );

    const so = await useCase.execute({
      companyId: COMPANY_ID,
      customerId: CUSTOMER_ID,
      orderDate: ORDER_DATE,
      currency: USD,
      exchangeRate: 1,
      lines: [{
        itemId: 'item-1',
        orderedQty: 6,
        uom: 'EA',
        unitPriceDoc: 100,
      }],
      createdBy: USER_ID,
    });

    // Should have original line + 1 free goods line (floor(6/3)*1 = 2)
    expect(so.lines.length).toBe(2);

    // Original line unchanged (no discount)
    expect(so.lines[0]!.appliedPromotionId).toBeUndefined();

    // Free goods line
    const freeLine = so.lines[1]!;
    expect(freeLine.appliedPromotionId).toBe(bxgyRule.id);
    expect(freeLine.appliedPromotionName).toBe('Buy 3 Get 1 Free');
    expect(freeLine.orderedQty).toBe(2);
    expect(freeLine.unitPriceDoc).toBe(0);
    expect(freeLine.lineTotalDoc).toBe(0);

    // SO-level tracking
    expect(so.appliedPromotions).toBeDefined();
    expect(so.appliedPromotions![0]!.type).toBe('BUY_X_GET_Y');
  });

  it('leaves SO lines unchanged when no promotions match', async () => {
    const settings = makeSettings();
    const item = makeItem();

    const useCase = new CreateSalesOrderUseCase(
      { getSettings: jest.fn(async () => settings), saveSettings: jest.fn(async () => {}) } as any,
      { create: jest.fn(async () => {}), update: jest.fn(), getById: jest.fn(), getByNumber: jest.fn(async () => null), list: jest.fn(), delete: jest.fn(), hasOpenOrders: jest.fn(async () => false) } as any,
      { getById: jest.fn(async () => makeCustomer()) } as any,
      { getItem: jest.fn(async () => item) } as any,
      { getById: jest.fn(async () => null) } as any,
      { isEnabled: jest.fn(async () => true) } as any,
      makePromoRepo([]), // No rules
    );

    const so = await useCase.execute({
      companyId: COMPANY_ID,
      customerId: CUSTOMER_ID,
      orderDate: ORDER_DATE,
      currency: USD,
      exchangeRate: 1,
      lines: [{
        itemId: 'item-1',
        orderedQty: 10,
        uom: 'EA',
        unitPriceDoc: 100,
      }],
      createdBy: USER_ID,
    });

    expect(so.lines[0]!.appliedPromotionId).toBeUndefined();
    expect(so.lines[0]!.lineTotalDoc).toBe(1000); // 10 * 100
    expect(so.appliedPromotions).toBeUndefined();
  });

  it('does not apply promotion when promoRuleRepo is not injected', async () => {
    const settings = makeSettings();
    const item = makeItem();

    const useCase = new CreateSalesOrderUseCase(
      { getSettings: jest.fn(async () => settings), saveSettings: jest.fn(async () => {}) } as any,
      { create: jest.fn(async () => {}), update: jest.fn(), getById: jest.fn(), getByNumber: jest.fn(async () => null), list: jest.fn(), delete: jest.fn(), hasOpenOrders: jest.fn(async () => false) } as any,
      { getById: jest.fn(async () => makeCustomer()) } as any,
      { getItem: jest.fn(async () => item) } as any,
      { getById: jest.fn(async () => null) } as any,
      { isEnabled: jest.fn(async () => true) } as any,
      // No promoRuleRepo
    );

    const so = await useCase.execute({
      companyId: COMPANY_ID,
      customerId: CUSTOMER_ID,
      orderDate: ORDER_DATE,
      currency: USD,
      exchangeRate: 1,
      lines: [{
        itemId: 'item-1',
        orderedQty: 10,
        uom: 'EA',
        unitPriceDoc: 100,
      }],
      createdBy: USER_ID,
    });

    expect(so.lines[0]!.lineTotalDoc).toBe(1000);
    expect(so.lines[0]!.appliedPromotionId).toBeUndefined();
    expect(so.appliedPromotions).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Tests — Sales Invoice (direct persona only)
// ---------------------------------------------------------------------------

describe('CreateSalesInvoiceUseCase — promotion auto-invocation', () => {
  it('applies a threshold discount to matching direct SI lines', async () => {
    const settings = makeSettings();
    const item = makeItem();
    const thresholdRule = makeThresholdRule({
      thresholdDiscount: { thresholdBasis: 'QTY', thresholdValue: 5, discountPct: 10 },
    });

    const useCase = new CreateSalesInvoiceUseCase(
      { getSettings: jest.fn(async () => settings), saveSettings: jest.fn(async () => {}) } as any,
      { create: jest.fn(async () => {}), update: jest.fn(), getById: jest.fn(), getByNumber: jest.fn(async () => null), list: jest.fn() } as any,
      { getById: jest.fn(async () => null), update: jest.fn() } as any,
      { getById: jest.fn(async () => makeCustomer()) } as any,
      { getItem: jest.fn(async () => item) } as any,
      { getCategory: jest.fn(async () => null), getCompanyCategories: jest.fn(async () => []) } as any,
      { getById: jest.fn(async () => null) } as any,
      { isEnabled: jest.fn(async () => true), getBaseCurrency: jest.fn(async () => 'USD') } as any,
      makePromoRepo([thresholdRule]),
    );

    const si = await useCase.execute({
      companyId: COMPANY_ID,
      persona: 'direct',
      invoiceDate: ORDER_DATE,
      customerId: CUSTOMER_ID,
      currency: USD,
      exchangeRate: 1,
      lines: [{
        itemId: 'item-1',
        invoicedQty: 10,
        uom: 'EA',
        unitPriceDoc: 100,
      }],
      createdBy: USER_ID,
    });

    const line = si.lines[0]!;
    expect(line.appliedPromotionId).toBe(thresholdRule.id);
    expect(line.appliedPromotionName).toBe('10% off qty >= 5');
    expect(line.appliedDiscountPct).toBe(10);
    expect(line.discountType).toBe('PERCENT');
    expect(line.discountValue).toBe(10);
    expect(si.appliedPromotions).toBeDefined();
    expect(si.appliedPromotions![0]!.type).toBe('THRESHOLD_DISCOUNT');
  });

  it('does NOT apply promotions to linked SI (non-direct persona)', async () => {
    const settings = makeSettings();
    // Enable linked persona through governance
    settings.governanceRules = [{ id: 'g1', scope: 'company', action: 'allow', persona: 'linked' }];
    settings.allowDirectInvoicing = true;
    // Use a non-inventory item (service) so linked persona doesn't require DN reference
    const item = makeItem({ id: 'item-1', code: 'SVC-1', name: 'Service Item', type: 'SERVICE', trackInventory: false });
    const thresholdRule = makeThresholdRule();

    const useCase = new CreateSalesInvoiceUseCase(
      { getSettings: jest.fn(async () => settings), saveSettings: jest.fn(async () => {}) } as any,
      { create: jest.fn(async () => {}), update: jest.fn(), getById: jest.fn(), getByNumber: jest.fn(async () => null), list: jest.fn() } as any,
      { getById: jest.fn(async () => null), update: jest.fn() } as any,
      { getById: jest.fn(async () => makeCustomer()) } as any,
      { getItem: jest.fn(async () => item) } as any,
      { getCategory: jest.fn(async () => null), getCompanyCategories: jest.fn(async () => []) } as any,
      { getById: jest.fn(async () => null) } as any,
      { isEnabled: jest.fn(async () => true), getBaseCurrency: jest.fn(async () => 'USD') } as any,
      makePromoRepo([thresholdRule]),
    );

    const si = await useCase.execute({
      companyId: COMPANY_ID,
      persona: 'linked',
      formType: 'sales_invoice_linked',
      voucherType: 'sales_invoice',
      invoiceDate: ORDER_DATE,
      customerId: CUSTOMER_ID,
      currency: USD,
      exchangeRate: 1,
      lines: [{
        itemId: 'item-1',
        invoicedQty: 10,
        uom: 'EA',
        unitPriceDoc: 100,
      }],
      createdBy: USER_ID,
    });

    // Linked persona should NOT trigger promotion evaluation
    expect(si.lines[0]!.appliedPromotionId).toBeUndefined();
    expect(si.appliedPromotions).toBeUndefined();
  });

  it('skips auto-discount for SI lines with existing manual discount', async () => {
    const settings = makeSettings();
    const item1 = makeItem({ id: 'item-1', code: 'W-A', name: 'Widget A' });
    const item2 = makeItem({ id: 'item-2', code: 'W-B', name: 'Widget B' });
    const items = [item1, item2];
    const thresholdRule = makeThresholdRule({
      thresholdDiscount: { thresholdBasis: 'QTY', thresholdValue: 1, discountPct: 10 },
      scope: 'ALL',
    });

    const useCase = new CreateSalesInvoiceUseCase(
      { getSettings: jest.fn(async () => settings), saveSettings: jest.fn(async () => {}) } as any,
      { create: jest.fn(async () => {}), update: jest.fn(), getById: jest.fn(), getByNumber: jest.fn(async () => null), list: jest.fn() } as any,
      { getById: jest.fn(async () => null), update: jest.fn() } as any,
      { getById: jest.fn(async () => makeCustomer()) } as any,
      { getItem: jest.fn(async (id: string) => items.find((i) => i.id === id) || null) } as any,
      { getCategory: jest.fn(async () => null), getCompanyCategories: jest.fn(async () => []) } as any,
      { getById: jest.fn(async () => null) } as any,
      { isEnabled: jest.fn(async () => true), getBaseCurrency: jest.fn(async () => 'USD') } as any,
      makePromoRepo([thresholdRule]),
    );

    const si = await useCase.execute({
      companyId: COMPANY_ID,
      persona: 'direct',
      invoiceDate: ORDER_DATE,
      customerId: CUSTOMER_ID,
      currency: USD,
      exchangeRate: 1,
      lines: [
        {
          itemId: 'item-1',
          invoicedQty: 10,
          uom: 'EA',
          unitPriceDoc: 100,
          discountType: 'PERCENT' as any,
          discountValue: 5,
        },
        {
          itemId: 'item-2',
          invoicedQty: 10,
          uom: 'EA',
          unitPriceDoc: 200,
          // no manual discount
        },
      ],
      createdBy: USER_ID,
    });

    // Line 1: has manual discount → no auto-promotion
    const line1 = si.lines[0]!;
    expect(line1.appliedPromotionId).toBeUndefined();
    expect(line1.discountType).toBe('PERCENT');
    expect(line1.discountValue).toBe(5);

    // Line 2: no manual discount → gets auto-promotion
    const line2 = si.lines[1]!;
    expect(line2.appliedPromotionId).toBe(thresholdRule.id);
    expect(line2.discountType).toBe('PERCENT');
    expect(line2.discountValue).toBe(10);
  });
});