import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { Party } from '../../../domain/shared/entities/Party';
import { CreditLimitExceededError } from '../../../domain/sales/errors/CreditLimitExceededError';
import { CreditCheckService } from '../../../application/sales/services/CreditCheckService';
import {
  CreateSalesInvoiceUseCase,
  CreateSalesInvoiceInput,
} from '../../../application/sales/use-cases/SalesInvoiceUseCases';
import { CreditOverride } from '../../../domain/sales/entities/CreditOverride';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COMPANY_ID = 'cmp-si-credit-test';
const CUSTOMER_ID = 'cust-1';
const USER_ID = 'u-test';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeCustomer = (
  overrides: Partial<{ creditLimit: number | null; creditHoldPolicy: 'NONE' | 'WARN' | 'BLOCK' }> = {}
): Party =>
  new Party({
    id: CUSTOMER_ID,
    companyId: COMPANY_ID,
    code: 'C001',
    legalName: 'Acme Corp',
    displayName: 'Acme',
    roles: ['CUSTOMER'],
    active: true,
    createdBy: USER_ID,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    creditLimit: overrides.creditLimit,
    creditHoldPolicy: overrides.creditHoldPolicy,
  });

const makeItem = () => ({
  id: 'item-1',
  companyId: COMPANY_ID,
  code: 'W-001',
  name: 'Widget',
  type: 'GOODS' as const,
  trackInventory: false,
  baseUomId: 'uom-ea',
  baseUom: 'EA',
  salesUomId: 'uom-ea',
  salesUom: 'EA',
  defaultSalesTaxCodeId: undefined,
  revenueAccountId: 'rev-acc-1',
  cogsAccountId: 'cogs-acc-1',
  inventoryAssetAccountId: 'inv-acc-1',
  costCurrency: 'USD',
  active: true,
  categoryId: undefined,
});

const makeSettings = () => ({
  id: 'ss-1',
  companyId: COMPANY_ID,
  workflowMode: 'OPERATIONAL',
  allowDirectInvoicing: true,
  defaultRevenueAccountId: 'rev-acc-1',
  defaultPaymentTermsDays: 30,
  defaultWarehouseId: 'wh-1',
  governanceRules: [{ id: 'g1', scope: 'company', action: 'allow', persona: 'direct' }],
  siNumberNextSeq: 1,
  soNumberNextSeq: 1,
  dnNumberNextSeq: 1,
  srNumberNextSeq: 1,
  quoteNumberNextSeq: 1,
});

const makeInvoiceShape = (outstandingAmountBase: number) => ({
  id: `inv-${Math.random()}`,
  companyId: COMPANY_ID,
  customerId: CUSTOMER_ID,
  status: 'POSTED' as const,
  outstandingAmountBase,
});

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('CreditCheck on Direct Sales Invoice creation', () => {
  // We use `any` for repos to avoid complex Jest mock typing issues.
  let settingsRepo: any;
  let salesInvoiceRepo: any;
  let salesOrderRepo: any;
  let partyRepo: any;
  let itemRepo: any;
  let itemCategoryRepo: any;
  let taxCodeRepo: any;
  let companyCurrencyRepo: any;
  let promotionRuleRepo: any;
  let creditCheckService: CreditCheckService;
  let creditOverrideRepo: any;

  const baseInput: CreateSalesInvoiceInput = {
    companyId: COMPANY_ID,
    persona: 'direct',
    formType: 'sales_invoice_direct',
    voucherType: 'sales_invoice',
    customerId: CUSTOMER_ID,
    invoiceDate: '2026-05-24',
    currency: 'USD',
    exchangeRate: 1,
    lines: [
      { itemId: 'item-1', invoicedQty: 5, uom: 'EA', unitPriceDoc: 100 },
    ],
    createdBy: USER_ID,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    settingsRepo = {
      getSettings: jest.fn(async () => makeSettings()),
      saveSettings: jest.fn(async () => {}),
    };

    salesInvoiceRepo = {
      create: jest.fn(async () => {}),
      update: jest.fn(),
      getById: jest.fn(),
      getByNumber: jest.fn(async () => null),
      list: jest.fn(async () => []),
      delete: jest.fn(),
    };

    salesOrderRepo = {
      getById: jest.fn(async () => null),
    };

    partyRepo = {
      getById: jest.fn(async () => makeCustomer({ creditLimit: undefined, creditHoldPolicy: undefined })),
    };

    itemRepo = {
      getItem: jest.fn(async () => makeItem()),
    };

    itemCategoryRepo = {
      getCategory: jest.fn(async () => null),
      getCompanyCategories: jest.fn(async () => []),
    };

    taxCodeRepo = {
      getById: jest.fn(async () => null),
    };

    companyCurrencyRepo = {
      isEnabled: jest.fn(async () => true),
      getBaseCurrency: jest.fn(async () => 'USD'),
    };

    promotionRuleRepo = {
      list: jest.fn(async () => []),
    };

    creditCheckService = new CreditCheckService(salesInvoiceRepo);
    creditOverrideRepo = {
      create: jest.fn(async () => {}),
      getById: jest.fn(),
      list: jest.fn(),
    };
  });

  const makeUseCase = () =>
    new CreateSalesInvoiceUseCase(
      settingsRepo,
      salesInvoiceRepo,
      salesOrderRepo,
      partyRepo,
      itemRepo,
      itemCategoryRepo,
      taxCodeRepo,
      companyCurrencyRepo,
      promotionRuleRepo,
      creditCheckService,
      creditOverrideRepo,
    );

  it('1. Direct SI on customer with credit limit within bounds → created successfully, creditCheck.outcome = OK', async () => {
    const customer = makeCustomer({ creditLimit: 10000, creditHoldPolicy: 'BLOCK' });
    partyRepo.getById = jest.fn(async () => customer);

    // Exposure is 0 (no invoices), order is 500 — within limit
    const result = await makeUseCase().execute(baseInput);

    expect(result.salesInvoice).toBeDefined();
    expect(result.salesInvoice.id).toBeDefined();
    expect(result.creditCheck).toBeDefined();
    expect(result.creditCheck!.outcome).toBe('OK');
    expect(result.creditCheck!.enforced).toBe(true);
    expect(result.creditCheck!.withinLimit).toBe(true);
  });

  it('2. Direct SI on customer exceeding credit limit with BLOCK policy → throws CreditLimitExceededError', async () => {
    const customer = makeCustomer({ creditLimit: 500, creditHoldPolicy: 'BLOCK' });
    partyRepo.getById = jest.fn(async () => customer);

    // Existing exposure of 300 + order of 500 = 800 projected > 500 limit
    salesInvoiceRepo.list = jest.fn(async () => [makeInvoiceShape(300)]);

    await expect(makeUseCase().execute(baseInput)).rejects.toThrow(CreditLimitExceededError);
  });

  it('3. Direct SI exceeding credit limit with BLOCK policy + override reason → created, creditCheck.outcome = OVERRIDDEN', async () => {
    const customer = makeCustomer({ creditLimit: 500, creditHoldPolicy: 'BLOCK' });
    partyRepo.getById = jest.fn(async () => customer);

    // Existing exposure of 300 + order of 500 = 800 projected > 500 limit
    salesInvoiceRepo.list = jest.fn(async () => [makeInvoiceShape(300)]);

    const result = await makeUseCase().execute({
      ...baseInput,
      creditOverrideReason: 'Approved by regional manager due to long-term relationship',
    });

    expect(result.salesInvoice).toBeDefined();
    expect(result.creditCheck).toBeDefined();
    expect(result.creditCheck!.outcome).toBe('OVERRIDDEN');
    expect(result.creditCheck!.enforced).toBe(true);
    expect(result.creditCheck!.withinLimit).toBe(false);
    expect(creditOverrideRepo.create).toHaveBeenCalledTimes(1);

    const overrideArg: CreditOverride = creditOverrideRepo.create.mock.calls[0][0];
    expect(overrideArg.sourceType).toBe('SALES_INVOICE');
    expect(overrideArg.reason).toBe('Approved by regional manager due to long-term relationship');
  });

  it('4. Direct SI exceeding credit limit with WARN policy → created, creditCheck.outcome = WARN', async () => {
    const customer = makeCustomer({ creditLimit: 500, creditHoldPolicy: 'WARN' });
    partyRepo.getById = jest.fn(async () => customer);

    // Existing exposure of 300 + order of 500 = 800 projected > 500 limit
    salesInvoiceRepo.list = jest.fn(async () => [makeInvoiceShape(300)]);

    const result = await makeUseCase().execute(baseInput);

    expect(result.salesInvoice).toBeDefined();
    expect(result.creditCheck).toBeDefined();
    expect(result.creditCheck!.outcome).toBe('WARN');
    expect(result.creditCheck!.enforced).toBe(true);
    expect(result.creditCheck!.withinLimit).toBe(false);
    // No override record is created for WARN
    expect(creditOverrideRepo.create).not.toHaveBeenCalled();
  });

  it('5. Linked SI (not direct) → no credit check performed (creditCheck is undefined)', async () => {
    const customer = makeCustomer({ creditLimit: 500, creditHoldPolicy: 'BLOCK' });
    partyRepo.getById = jest.fn(async () => customer);

    // Even with exposure that would exceed the limit, no check is performed for linked SIs
    salesInvoiceRepo.list = jest.fn(async () => [makeInvoiceShape(300)]);

    // Linked persona — requires a Sales Order
    const linkedInput: CreateSalesInvoiceInput = {
      ...baseInput,
      persona: 'linked',
      formType: 'sales_invoice_linked',
      salesOrderId: 'so-1',
    };

    salesOrderRepo.getById = jest.fn(async () => ({
      id: 'so-1',
      companyId: COMPANY_ID,
      customerId: CUSTOMER_ID,
      lines: [],
      status: 'CONFIRMED',
    }));

    const result = await makeUseCase().execute(linkedInput);

    expect(result.salesInvoice).toBeDefined();
    expect(result.creditCheck).toBeUndefined();
  });

  it('6. Customer with no credit limit (null) → no credit check, creditCheck is undefined', async () => {
    const customer = makeCustomer({ creditLimit: undefined, creditHoldPolicy: undefined });
    partyRepo.getById = jest.fn(async () => customer);

    const result = await makeUseCase().execute(baseInput);

    expect(result.salesInvoice).toBeDefined();
    expect(result.creditCheck).toBeUndefined();
  });

  it('7. CreditLimitExceededError carries structured fields including companyId and customerName', async () => {
    const customer = makeCustomer({ creditLimit: 500, creditHoldPolicy: 'BLOCK' });
    partyRepo.getById = jest.fn(async () => customer);

    salesInvoiceRepo.list = jest.fn(async () => [makeInvoiceShape(300)]);

    try {
      await makeUseCase().execute(baseInput);
      fail('Expected CreditLimitExceededError');
    } catch (err) {
      expect(err).toBeInstanceOf(CreditLimitExceededError);
      const cle = err as CreditLimitExceededError;
      expect(cle.code).toBe('CREDIT_LIMIT_EXCEEDED');
      expect(cle.statusCode).toBe(422);
      expect(cle.companyId).toBe(COMPANY_ID);
      expect(cle.customerId).toBe(CUSTOMER_ID);
      expect(cle.customerName).toBe('Acme');
      expect(cle.creditLimit).toBe(500);
      expect(cle.currentExposure).toBe(300);
      expect(cle.orderAmount).toBe(500);
      expect(cle.projectedExposure).toBe(800);
    }
  });
});