import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { Salesperson } from '../../../domain/sales/entities/Salesperson';
import { CommissionEntry } from '../../../domain/sales/entities/CommissionEntry';
import { SalesOrder } from '../../../domain/sales/entities/SalesOrder';
import { SalesInvoice } from '../../../domain/sales/entities/SalesInvoice';
import {
  AccrueCommissionForInvoiceUseCase,
  MarkCommissionPaidUseCase,
} from '../../../application/sales/use-cases/CommissionUseCases';
import {
  DeleteSalespersonUseCase,
} from '../../../application/sales/use-cases/SalespersonUseCases';
import { ISalespersonRepository } from '../../../repository/interfaces/sales/ISalespersonRepository';
import { ICommissionEntryRepository } from '../../../repository/interfaces/sales/ICommissionEntryRepository';
import { ISalesInvoiceRepository } from '../../../repository/interfaces/sales/ISalesInvoiceRepository';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COMPANY_ID = 'cmp-commission-test';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeSalesperson = (
  overrides: Partial<ConstructorParameters<typeof Salesperson>[0]> = {}
) =>
  new Salesperson({
    companyId: COMPANY_ID,
    code: 'SP-001',
    name: 'Alice Smith',
    defaultCommissionPct: 3,
    status: 'ACTIVE',
    createdBy: 'u-test',
    ...overrides,
  });

/**
 * Minimal SalesInvoice-shaped object returned from a mocked salesInvoiceRepo.
 * We do not instantiate a real SalesInvoice (it requires full lines data) —
 * the use case only reads specific fields from the returned value.
 */
const makeInvoiceShape = (overrides: Partial<{
  id: string;
  companyId: string;
  salespersonId: string | undefined;
  grandTotalBase: number;
  currency: string;
  customerId: string;
  customerName: string;
  invoiceDate: string;
  invoiceNumber: string;
}> = {}) => ({
  id: 'si-1',
  companyId: COMPANY_ID,
  salespersonId: 'sp-1',
  grandTotalBase: 1000,
  currency: 'USD',
  customerId: 'cust-1',
  customerName: 'Acme Corp',
  invoiceDate: '2026-01-15',
  invoiceNumber: 'SI-2026-001',
  ...overrides,
});

const makeCommissionEntry = (
  overrides: Partial<ConstructorParameters<typeof CommissionEntry>[0]> = {}
) =>
  new CommissionEntry({
    companyId: COMPANY_ID,
    salespersonId: 'sp-1',
    sourceType: 'SALES_INVOICE',
    sourceId: 'si-1',
    sourceNumber: 'SI-2026-001',
    customerId: 'cust-1',
    customerName: 'Acme Corp',
    invoiceDate: '2026-01-15',
    baseAmount: 1000,
    commissionPct: 3,
    currency: 'USD',
    status: 'ACCRUED',
    accruedAt: new Date('2026-01-15T10:00:00Z'),
    createdBy: 'SYSTEM',
    ...overrides,
  });

// Mock repos
const makeSalesInvoiceRepo = (
  overrides: Partial<ISalesInvoiceRepository> = {}
): jest.Mocked<ISalesInvoiceRepository> =>
  ({
    create: jest.fn(async () => {}),
    update: jest.fn(async () => {}),
    getById: jest.fn(async () => null),
    getByNumber: jest.fn(async () => null),
    list: jest.fn(async () => []),
    ...overrides,
  } as jest.Mocked<ISalesInvoiceRepository>);

const makeSalespersonRepo = (
  overrides: Partial<ISalespersonRepository> = {}
): jest.Mocked<ISalespersonRepository> =>
  ({
    create: jest.fn(async () => {}),
    update: jest.fn(async () => {}),
    getById: jest.fn(async () => null),
    getByCode: jest.fn(async () => null),
    list: jest.fn(async () => []),
    delete: jest.fn(async () => {}),
    ...overrides,
  } as jest.Mocked<ISalespersonRepository>);

const makeCommissionRepo = (
  overrides: Partial<ICommissionEntryRepository> = {}
): jest.Mocked<ICommissionEntryRepository> =>
  ({
    create: jest.fn(async () => {}),
    update: jest.fn(async () => {}),
    getById: jest.fn(async () => null),
    list: jest.fn(async () => []),
    findBySource: jest.fn(async () => null),
    totalsBySalesperson: jest.fn(async () => ({ accrued: 0, paid: 0, cancelled: 0 })),
    ...overrides,
  } as jest.Mocked<ICommissionEntryRepository>);

// ---------------------------------------------------------------------------
// 1. Salesperson constructor — rejects commissionPct > 100
// ---------------------------------------------------------------------------

describe('Salesperson constructor validation', () => {
  it('rejects defaultCommissionPct > 100', () => {
    expect(() =>
      makeSalesperson({ defaultCommissionPct: 101 })
    ).toThrow(/defaultCommissionPct must be between 0 and 100/i);
  });

  // 2.
  it('rejects defaultCommissionPct < 0', () => {
    expect(() =>
      makeSalesperson({ defaultCommissionPct: -1 })
    ).toThrow(/defaultCommissionPct must be between 0 and 100/i);
  });
});

// ---------------------------------------------------------------------------
// 3–4. CommissionEntry constructor
// ---------------------------------------------------------------------------

describe('CommissionEntry constructor', () => {
  it('3. computes commissionAmountBase correctly: baseAmount=1000, pct=3 → 30', () => {
    const entry = makeCommissionEntry({ baseAmount: 1000, commissionPct: 3 });
    expect(entry.commissionAmountBase).toBe(30);
  });

  it('4. rounds commissionAmountBase correctly: baseAmount=33.33, pct=3 → 1.00', () => {
    const entry = makeCommissionEntry({ baseAmount: 33.33, commissionPct: 3 });
    // 33.33 * 3 / 100 = 0.9999 → rounded to 1.00
    expect(entry.commissionAmountBase).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 5. CommissionEntry.markPaid — throws when status is not ACCRUED
// ---------------------------------------------------------------------------

describe('CommissionEntry.markPaid', () => {
  it('5. throws when entry status is not ACCRUED', () => {
    const entry = makeCommissionEntry({ status: 'CANCELLED' });
    expect(() => entry.markPaid(new Date())).toThrow(/cannot mark.*PAID/i);
  });
});

// ---------------------------------------------------------------------------
// 6. CommissionEntry.cancel — throws when status is PAID
// ---------------------------------------------------------------------------

describe('CommissionEntry.cancel', () => {
  it('6. throws when entry status is PAID', () => {
    const entry = makeCommissionEntry({ status: 'PAID', paidAt: new Date() });
    expect(() => entry.cancel()).toThrow(/cannot cancel.*PAID/i);
  });
});

// ---------------------------------------------------------------------------
// 7–10. AccrueCommissionForInvoiceUseCase
// ---------------------------------------------------------------------------

describe('AccrueCommissionForInvoiceUseCase', () => {
  it('7. returns null when invoice has no salespersonId', async () => {
    const invoice = makeInvoiceShape({ salespersonId: undefined });
    const invoiceRepo = makeSalesInvoiceRepo({
      getById: jest.fn(async () => invoice as any),
    });
    const salespersonRepo = makeSalespersonRepo();
    const commissionRepo = makeCommissionRepo();

    const uc = new AccrueCommissionForInvoiceUseCase(
      invoiceRepo,
      salespersonRepo,
      commissionRepo
    );

    const result = await uc.execute({ companyId: COMPANY_ID, invoiceId: 'si-1' });
    expect(result).toBeNull();
    expect(commissionRepo.create).not.toHaveBeenCalled();
  });

  it('8. creates an entry with the correct amount when invoice has salespersonId and salesperson is ACTIVE', async () => {
    const invoice = makeInvoiceShape({ salespersonId: 'sp-1', grandTotalBase: 1000 });
    const salesperson = makeSalesperson({ id: 'sp-1', defaultCommissionPct: 3, status: 'ACTIVE' });

    const invoiceRepo = makeSalesInvoiceRepo({
      getById: jest.fn(async () => invoice as any),
    });
    const salespersonRepo = makeSalespersonRepo({
      getById: jest.fn(async () => salesperson),
    });
    const commissionRepo = makeCommissionRepo();

    const uc = new AccrueCommissionForInvoiceUseCase(
      invoiceRepo,
      salespersonRepo,
      commissionRepo
    );

    const result = await uc.execute({ companyId: COMPANY_ID, invoiceId: 'si-1' });

    expect(result).not.toBeNull();
    expect(result!.commissionAmountBase).toBe(30); // 1000 * 3% = 30
    expect(result!.commissionPct).toBe(3);
    expect(result!.status).toBe('ACCRUED');
    expect(commissionRepo.create).toHaveBeenCalledTimes(1);
  });

  it('9. is idempotent — second call returns the same entry, does not create duplicate', async () => {
    const invoice = makeInvoiceShape({ salespersonId: 'sp-1' });
    const existingEntry = makeCommissionEntry();
    const salesperson = makeSalesperson({ id: 'sp-1', status: 'ACTIVE' });

    const invoiceRepo = makeSalesInvoiceRepo({
      getById: jest.fn(async () => invoice as any),
    });
    const salespersonRepo = makeSalespersonRepo({
      getById: jest.fn(async () => salesperson),
    });
    const commissionRepo = makeCommissionRepo({
      // findBySource returns an existing entry on "second" call
      findBySource: jest.fn(async () => existingEntry),
    });

    const uc = new AccrueCommissionForInvoiceUseCase(
      invoiceRepo,
      salespersonRepo,
      commissionRepo
    );

    const result = await uc.execute({ companyId: COMPANY_ID, invoiceId: 'si-1' });

    expect(result).toBe(existingEntry);
    // create must NOT be called — entry already existed
    expect(commissionRepo.create).not.toHaveBeenCalled();
  });

  it('10. throws when salesperson is INACTIVE', async () => {
    const invoice = makeInvoiceShape({ salespersonId: 'sp-1' });
    const inactiveSalesperson = makeSalesperson({ id: 'sp-1', status: 'INACTIVE' });

    const invoiceRepo = makeSalesInvoiceRepo({
      getById: jest.fn(async () => invoice as any),
    });
    const salespersonRepo = makeSalespersonRepo({
      getById: jest.fn(async () => inactiveSalesperson),
    });
    const commissionRepo = makeCommissionRepo();

    const uc = new AccrueCommissionForInvoiceUseCase(
      invoiceRepo,
      salespersonRepo,
      commissionRepo
    );

    await expect(
      uc.execute({ companyId: COMPANY_ID, invoiceId: 'si-1' })
    ).rejects.toThrow(/inactive salesperson/i);
  });
});

// ---------------------------------------------------------------------------
// 11. MarkCommissionPaidUseCase
// ---------------------------------------------------------------------------

describe('MarkCommissionPaidUseCase', () => {
  it('11. updates status to PAID and sets paidAt', async () => {
    const entry = makeCommissionEntry({ status: 'ACCRUED' });
    const paidAt = new Date('2026-03-01T09:00:00Z');

    const commissionRepo = makeCommissionRepo({
      getById: jest.fn(async () => entry),
      update: jest.fn(async () => {}),
    });

    const uc = new MarkCommissionPaidUseCase(commissionRepo);
    const result = await uc.execute({
      companyId: COMPANY_ID,
      commissionEntryId: entry.id,
      paidAt,
      paymentReference: 'CHQ-1001',
    });

    expect(result.status).toBe('PAID');
    expect(result.paidAt).toEqual(paidAt);
    expect(result.paymentReference).toBe('CHQ-1001');
    expect(commissionRepo.update).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// 12. DeleteSalespersonUseCase — throws when ACCRUED commission exists
// ---------------------------------------------------------------------------

describe('DeleteSalespersonUseCase', () => {
  it('12. throws when there is at least one ACCRUED commission for the salesperson', async () => {
    const salesperson = makeSalesperson({ id: 'sp-1' });
    const accruedEntry = makeCommissionEntry({ salespersonId: 'sp-1' });

    const salespersonRepo = makeSalespersonRepo({
      getById: jest.fn(async () => salesperson),
    });
    const commissionRepo = makeCommissionRepo({
      list: jest.fn(async () => [accruedEntry]),
    });

    const uc = new DeleteSalespersonUseCase(salespersonRepo, commissionRepo);

    await expect(uc.execute(COMPANY_ID, 'sp-1')).rejects.toThrow(
      /cannot delete/i
    );
    expect(salespersonRepo.delete).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 13. SalesOrder — accepts and round-trips salespersonId
// ---------------------------------------------------------------------------

describe('SalesOrder salespersonId', () => {
  const makeMinimalSOProps = (overrides: Record<string, unknown> = {}) => ({
    id: 'so-1',
    companyId: COMPANY_ID,
    orderNumber: 'SO-2026-001',
    customerId: 'cust-1',
    customerName: 'Acme Corp',
    salespersonId: 'sp-1',
    orderDate: '2026-01-10',
    currency: 'USD',
    exchangeRate: 1,
    lines: [
      {
        lineId: 'l-1',
        lineNo: 1,
        itemId: 'item-1',
        itemCode: 'ITM-001',
        itemName: 'Widget',
        itemType: 'PRODUCT' as const,
        trackInventory: false,
        orderedQty: 1,
        uom: 'PCS',
        deliveredQty: 0,
        invoicedQty: 0,
        returnedQty: 0,
        unitPriceDoc: 100,
        lineTotalDoc: 100,
        unitPriceBase: 100,
        lineTotalBase: 100,
        taxRate: 0,
        taxAmountDoc: 0,
        taxAmountBase: 0,
      },
    ],
    subtotalBase: 100,
    taxTotalBase: 0,
    grandTotalBase: 100,
    subtotalDoc: 100,
    taxTotalDoc: 0,
    grandTotalDoc: 100,
    status: 'DRAFT' as const,
    createdBy: 'u-test',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  it('13. accepts salespersonId in constructor and round-trips through toJSON/fromJSON', () => {
    const so = new SalesOrder(makeMinimalSOProps() as any);

    expect(so.salespersonId).toBe('sp-1');

    const json = so.toJSON();
    expect(json.salespersonId).toBe('sp-1');

    const restored = SalesOrder.fromJSON(json);
    expect(restored.salespersonId).toBe('sp-1');
  });
});

// ---------------------------------------------------------------------------
// 14. SalesInvoice — accepts and round-trips salespersonId
// ---------------------------------------------------------------------------

describe('SalesInvoice salespersonId', () => {
  const makeMinimalSIData = () => ({
    id: 'si-1',
    companyId: COMPANY_ID,
    invoiceNumber: 'SI-2026-001',
    formType: 'sales_invoice_direct',
    voucherType: 'sales_invoice',
    persona: 'direct',
    source: 'default_form',
    salespersonId: 'sp-1',
    customerId: 'cust-1',
    customerName: 'Acme Corp',
    invoiceDate: '2026-01-15',
    currency: 'USD',
    exchangeRate: 1,
    lines: [
      {
        lineId: 'l-1',
        lineNo: 1,
        itemId: 'item-1',
        itemCode: 'ITM-001',
        itemName: 'Widget',
        trackInventory: false,
        invoicedQty: 1,
        uom: 'PCS',
        unitPriceDoc: 100,
        lineTotalDoc: 100,
        unitPriceBase: 100,
        lineTotalBase: 100,
        taxRate: 0,
        taxAmountDoc: 0,
        taxAmountBase: 0,
        revenueAccountId: 'acc-revenue',
      },
    ],
    charges: [],
    subtotalDoc: 100,
    taxTotalDoc: 0,
    grandTotalDoc: 100,
    subtotalBase: 100,
    taxTotalBase: 0,
    grandTotalBase: 100,
    paymentTermsDays: 30,
    paymentStatus: 'UNPAID',
    paidAmountBase: 0,
    outstandingAmountBase: 100,
    status: 'DRAFT',
    createdBy: 'u-test',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  it('14. accepts salespersonId in constructor and round-trips through toJSON/fromJSON', () => {
    const si = SalesInvoice.fromJSON(makeMinimalSIData());

    expect(si.salespersonId).toBe('sp-1');

    const json = si.toJSON();
    expect(json.salespersonId).toBe('sp-1');

    const restored = SalesInvoice.fromJSON(json);
    expect(restored.salespersonId).toBe('sp-1');
  });
});
