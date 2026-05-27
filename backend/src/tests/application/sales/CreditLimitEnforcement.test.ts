import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { Party } from '../../../domain/shared/entities/Party';
import { SalesOrder } from '../../../domain/sales/entities/SalesOrder';
import { CreditOverride } from '../../../domain/sales/entities/CreditOverride';
import { CreditLimitExceededError } from '../../../domain/sales/errors/CreditLimitExceededError';
import { CreditCheckService } from '../../../application/sales/services/CreditCheckService';
import {
  ConfirmSalesOrderUseCase,
} from '../../../application/sales/use-cases/SalesOrderUseCases';
import { ISalesInvoiceRepository } from '../../../repository/interfaces/sales/ISalesInvoiceRepository';
import { ISalesOrderRepository } from '../../../repository/interfaces/sales/ISalesOrderRepository';
import { IPartyRepository } from '../../../repository/interfaces/shared/IPartyRepository';
import { ICreditOverrideRepository } from '../../../repository/interfaces/sales/ICreditOverrideRepository';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COMPANY_ID = 'cmp-credit-test';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeParty = (
  overrides: Partial<{
    creditLimit: number | undefined;
    creditHoldPolicy: 'NONE' | 'WARN' | 'BLOCK' | undefined;
  }> = {}
): Party =>
  new Party({
    id: 'cust-1',
    companyId: COMPANY_ID,
    code: 'C001',
    legalName: 'Acme Corp',
    displayName: 'Acme',
    roles: ['CUSTOMER'],
    active: true,
    createdBy: 'u-test',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    creditLimit: overrides.creditLimit,
    creditHoldPolicy: overrides.creditHoldPolicy,
  });

/**
 * Minimal invoice-shaped object that satisfies the list() return signature.
 * We avoid constructing a full SalesInvoice (requires lines etc.) — the
 * CreditCheckService only reads outstandingAmountBase.
 */
const makeInvoiceShape = (outstandingAmountBase: number) => ({
  id: `inv-${Math.random()}`,
  companyId: COMPANY_ID,
  customerId: 'cust-1',
  status: 'POSTED' as const,
  outstandingAmountBase,
});

const makeSalesOrderShape = (
  overrides: Partial<{
    grandTotalBase: number;
    customerId: string;
    orderNumber: string;
    id: string;
  }> = {}
) => ({
  id: overrides.id ?? 'so-1',
  companyId: COMPANY_ID,
  customerId: overrides.customerId ?? 'cust-1',
  orderNumber: overrides.orderNumber ?? 'SO-2026-001',
  status: 'DRAFT',
  grandTotalBase: overrides.grandTotalBase ?? 1000,
  lines: [{ id: 'line-1', itemId: 'item-1', qty: 1, unitPriceBase: 1000 }],
  confirmedAt: undefined as Date | undefined,
  updatedAt: new Date(),
});

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

const makeSalesInvoiceRepo = (
  invoices: ReturnType<typeof makeInvoiceShape>[] = []
): jest.Mocked<ISalesInvoiceRepository> =>
  ({
    create: jest.fn(async () => {}),
    update: jest.fn(async () => {}),
    getById: jest.fn(async () => null),
    getByNumber: jest.fn(async () => null),
    list: jest.fn(async () => invoices),
  } as unknown as jest.Mocked<ISalesInvoiceRepository>);

const makeSalesOrderRepo = (
  so: ReturnType<typeof makeSalesOrderShape>
): jest.Mocked<ISalesOrderRepository> =>
  ({
    create: jest.fn(async () => {}),
    update: jest.fn(async () => {}),
    getById: jest.fn(async () => so as any),
    getByNumber: jest.fn(async () => null),
    list: jest.fn(async () => []),
    hasOpenOrders: jest.fn(async () => false),
    delete: jest.fn(async () => {}),
  } as unknown as jest.Mocked<ISalesOrderRepository>);

const makePartyRepo = (
  party: Party | null = null
): jest.Mocked<IPartyRepository> =>
  ({
    create: jest.fn(async () => {}),
    update: jest.fn(async () => {}),
    getById: jest.fn(async () => party),
    list: jest.fn(async () => []),
    getByCode: jest.fn(async () => null),
    delete: jest.fn(async () => {}),
  } as unknown as jest.Mocked<IPartyRepository>);

const makeCreditOverrideRepo = (): jest.Mocked<ICreditOverrideRepository> =>
  ({
    create: jest.fn(async () => {}),
    getById: jest.fn(async () => null),
    list: jest.fn(async () => []),
  } as unknown as jest.Mocked<ICreditOverrideRepository>);

// ---------------------------------------------------------------------------
// 1. CreditCheckService — no creditLimit
// ---------------------------------------------------------------------------

describe('CreditCheckService', () => {
  it('1. returns enforced:false when customer has no creditLimit', async () => {
    const repo = makeSalesInvoiceRepo();
    const service = new CreditCheckService(repo);
    const customer = makeParty({ creditLimit: undefined });

    const result = await service.check(COMPANY_ID, customer, 500);

    expect(result.enforced).toBe(false);
    expect(result.withinLimit).toBe(true);
    expect(result.policy).toBe('NONE');
    // repo.list should not have been called — no need to query
    expect(repo.list).not.toHaveBeenCalled();
  });

  it('2a. sums outstandingAmountBase correctly across multiple POSTED invoices', async () => {
    const invoices = [makeInvoiceShape(300), makeInvoiceShape(200)];
    const repo = makeSalesInvoiceRepo(invoices);
    const service = new CreditCheckService(repo);
    const customer = makeParty({ creditLimit: 1000, creditHoldPolicy: 'BLOCK' });

    const result = await service.check(COMPANY_ID, customer, 400);

    expect(result.enforced).toBe(true);
    expect(result.currentExposure).toBe(500); // 300+200
    expect(result.projectedExposure).toBe(900); // 500+400
    expect(result.withinLimit).toBe(true);     // 900 <= 1000
    expect(result.policy).toBe('BLOCK');
  });

  it('2b. withinLimit is false when projected exceeds creditLimit', async () => {
    const invoices = [makeInvoiceShape(700), makeInvoiceShape(200)];
    const repo = makeSalesInvoiceRepo(invoices);
    const service = new CreditCheckService(repo);
    const customer = makeParty({ creditLimit: 1000, creditHoldPolicy: 'WARN' });

    const result = await service.check(COMPANY_ID, customer, 200);

    expect(result.currentExposure).toBe(900); // 700+200
    expect(result.projectedExposure).toBe(1100); // 900+200
    expect(result.withinLimit).toBe(false); // 1100 > 1000
  });

  it('2c. boundary — withinLimit true when projectedExposure exactly equals creditLimit', async () => {
    const invoices = [makeInvoiceShape(600)];
    const repo = makeSalesInvoiceRepo(invoices);
    const service = new CreditCheckService(repo);
    const customer = makeParty({ creditLimit: 1000, creditHoldPolicy: 'BLOCK' });

    const result = await service.check(COMPANY_ID, customer, 400);

    expect(result.projectedExposure).toBe(1000);
    expect(result.withinLimit).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. ConfirmSalesOrderUseCase — helpers
// ---------------------------------------------------------------------------

const buildUseCase = (
  so: ReturnType<typeof makeSalesOrderShape>,
  party: Party | null,
  invoices: ReturnType<typeof makeInvoiceShape>[],
  creditOverrideRepo?: jest.Mocked<ICreditOverrideRepository>
) => {
  const salesOrderRepo = makeSalesOrderRepo(so);
  const partyRepo = makePartyRepo(party);
  const invoiceRepo = makeSalesInvoiceRepo(invoices);
  const overrideRepo = creditOverrideRepo ?? makeCreditOverrideRepo();
  const creditCheckService = new CreditCheckService(invoiceRepo);
  const useCase = new ConfirmSalesOrderUseCase(
    salesOrderRepo,
    partyRepo,
    creditCheckService,
    overrideRepo
  );
  return { useCase, salesOrderRepo, partyRepo, invoiceRepo, overrideRepo };
};

describe('ConfirmSalesOrderUseCase', () => {
  it('3. confirms OK when under credit limit', async () => {
    const so = makeSalesOrderShape({ grandTotalBase: 500 });
    const party = makeParty({ creditLimit: 1000, creditHoldPolicy: 'BLOCK' });
    const invoices = [makeInvoiceShape(200)]; // exposure 200 + 500 = 700 <= 1000

    const { useCase } = buildUseCase(so, party, invoices);
    const result = await useCase.execute(COMPANY_ID, 'so-1');

    expect(result.salesOrder.status).toBe('CONFIRMED');
    expect(result.creditCheck.outcome).toBe('OK');
    expect(result.creditCheck.withinLimit).toBe(true);
  });

  it('4. policy WARN over limit — confirms, outcome WARN', async () => {
    const so = makeSalesOrderShape({ grandTotalBase: 900 });
    const party = makeParty({ creditLimit: 1000, creditHoldPolicy: 'WARN' });
    const invoices = [makeInvoiceShape(500)]; // 500 + 900 = 1400 > 1000

    const { useCase } = buildUseCase(so, party, invoices);
    const result = await useCase.execute(COMPANY_ID, 'so-1');

    expect(result.salesOrder.status).toBe('CONFIRMED');
    expect(result.creditCheck.outcome).toBe('WARN');
    expect(result.creditCheck.withinLimit).toBe(false);
  });

  it('5. policy BLOCK over limit, no override — throws CreditLimitExceededError', async () => {
    const so = makeSalesOrderShape({ grandTotalBase: 900 });
    const party = makeParty({ creditLimit: 1000, creditHoldPolicy: 'BLOCK' });
    const invoices = [makeInvoiceShape(500)]; // 500 + 900 = 1400 > 1000

    const { useCase } = buildUseCase(so, party, invoices);

    await expect(useCase.execute(COMPANY_ID, 'so-1')).rejects.toThrow(
      CreditLimitExceededError
    );
  });

  it('5b. thrown CreditLimitExceededError carries correct structured data', async () => {
    const so = makeSalesOrderShape({ grandTotalBase: 900 });
    const party = makeParty({ creditLimit: 1000, creditHoldPolicy: 'BLOCK' });
    const invoices = [makeInvoiceShape(500)];

    const { useCase } = buildUseCase(so, party, invoices);

    let caught: CreditLimitExceededError | undefined;
    try {
      await useCase.execute(COMPANY_ID, 'so-1');
    } catch (err) {
      caught = err as CreditLimitExceededError;
    }

    expect(caught).toBeInstanceOf(CreditLimitExceededError);
    expect(caught!.creditLimit).toBe(1000);
    expect(caught!.currentExposure).toBe(500);
    expect(caught!.orderAmount).toBe(900);
    expect(caught!.projectedExposure).toBe(1400);
  });

  it('6. policy BLOCK over limit, with override — confirms, outcome OVERRIDDEN, persists CreditOverride', async () => {
    const so = makeSalesOrderShape({ grandTotalBase: 900 });
    const party = makeParty({ creditLimit: 1000, creditHoldPolicy: 'BLOCK' });
    const invoices = [makeInvoiceShape(500)];
    const overrideRepo = makeCreditOverrideRepo();

    const { useCase } = buildUseCase(so, party, invoices, overrideRepo);

    const result = await useCase.execute(COMPANY_ID, 'so-1', {
      override: { reason: 'Approved by management', userId: 'u-manager' },
    });

    expect(result.salesOrder.status).toBe('CONFIRMED');
    expect(result.creditCheck.outcome).toBe('OVERRIDDEN');
    expect(overrideRepo.create).toHaveBeenCalledTimes(1);

    // Verify the record passed to create has the right fields
    const [savedRecord] = (overrideRepo.create as jest.MockedFunction<any>).mock.calls[0];
    expect(savedRecord).toBeInstanceOf(CreditOverride);
    expect(savedRecord.reason).toBe('Approved by management');
    expect(savedRecord.overriddenBy).toBe('u-manager');
    expect(savedRecord.sourceType).toBe('SALES_ORDER');
    expect(savedRecord.creditLimit).toBe(1000);
    expect(savedRecord.projectedExposure).toBe(1400);
  });

  it('7. policy NONE over limit — confirms OK (no enforcement)', async () => {
    const so = makeSalesOrderShape({ grandTotalBase: 900 });
    const party = makeParty({ creditLimit: 1000, creditHoldPolicy: 'NONE' });
    const invoices = [makeInvoiceShape(500)]; // 1400 > 1000 but policy is NONE

    const { useCase } = buildUseCase(so, party, invoices);
    const result = await useCase.execute(COMPANY_ID, 'so-1');

    expect(result.salesOrder.status).toBe('CONFIRMED');
    expect(result.creditCheck.outcome).toBe('OK');
  });
});

// ---------------------------------------------------------------------------
// 8. CreditOverride constructor — throws on empty reason
// ---------------------------------------------------------------------------

describe('CreditOverride constructor', () => {
  it('8. throws when reason is empty', () => {
    expect(() =>
      new CreditOverride({
        companyId: COMPANY_ID,
        customerId: 'cust-1',
        sourceType: 'SALES_ORDER',
        sourceId: 'so-1',
        sourceNumber: 'SO-2026-001',
        creditLimit: 1000,
        currentExposure: 500,
        orderAmount: 900,
        projectedExposure: 1400,
        reason: '   ',
        overriddenBy: 'u-manager',
        overriddenAt: new Date(),
      })
    ).toThrow(/reason is required/i);
  });

  it('8b. throws when reason is empty string', () => {
    expect(() =>
      new CreditOverride({
        companyId: COMPANY_ID,
        customerId: 'cust-1',
        sourceType: 'SALES_ORDER',
        sourceId: 'so-1',
        sourceNumber: 'SO-2026-001',
        creditLimit: 1000,
        currentExposure: 500,
        orderAmount: 900,
        projectedExposure: 1400,
        reason: '',
        overriddenBy: 'u-manager',
        overriddenAt: new Date(),
      })
    ).toThrow(/reason is required/i);
  });
});
