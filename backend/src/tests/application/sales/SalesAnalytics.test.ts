/**
 * SalesAnalytics.test.ts
 *
 * Tests for:
 *   - GetSalesByCustomerUseCase
 *   - GetSalesByItemUseCase
 *   - GetSalesBySalespersonUseCase
 */

import { describe, expect, it, jest } from '@jest/globals';
import { ISalesInvoiceRepository } from '../../../repository/interfaces/sales/ISalesInvoiceRepository';
import { ISalespersonRepository } from '../../../repository/interfaces/sales/ISalespersonRepository';
import {
  GetSalesByCustomerUseCase,
  GetSalesByItemUseCase,
  GetSalesBySalespersonUseCase,
} from '../../../application/sales/use-cases/SalesAnalyticsUseCases';

// ---------------------------------------------------------------------------
// Helpers — minimal plain-object shapes to satisfy the use-case duck-typing.
// The use cases only read fields, so we don't need full domain objects.
// ---------------------------------------------------------------------------

interface FakeLine {
  itemId: string;
  itemCode: string;
  itemName: string;
  invoicedQty: number;
  lineTotalBase: number;
}

interface FakeInvoice {
  id: string;
  companyId: string;
  customerId: string;
  customerName: string;
  salespersonId?: string;
  invoiceDate: string;
  status: 'POSTED' | 'DRAFT' | 'CANCELLED';
  subtotalBase: number;
  taxTotalBase: number;
  grandTotalBase: number;
  lines: FakeLine[];
}

const makeLine = (overrides: Partial<FakeLine> = {}): FakeLine => ({
  itemId: overrides.itemId ?? 'item-1',
  itemCode: overrides.itemCode ?? 'ITEM-001',
  itemName: overrides.itemName ?? 'Widget',
  invoicedQty: overrides.invoicedQty ?? 1,
  lineTotalBase: overrides.lineTotalBase ?? 100,
});

const makeInvoice = (overrides: Partial<FakeInvoice> = {}): FakeInvoice => ({
  id: overrides.id ?? `inv-${Math.random().toString(36).slice(2)}`,
  companyId: 'cmp-test',
  customerId: overrides.customerId ?? 'cust-1',
  customerName: overrides.customerName ?? 'Acme Corp',
  salespersonId: overrides.salespersonId,
  invoiceDate: overrides.invoiceDate ?? '2026-03-01',
  status: overrides.status ?? 'POSTED',
  subtotalBase: overrides.subtotalBase ?? 1000,
  taxTotalBase: overrides.taxTotalBase ?? 100,
  grandTotalBase: overrides.grandTotalBase ?? 1100,
  lines: overrides.lines ?? [makeLine()],
});

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

const makeSalesInvoiceRepo = (
  invoices: FakeInvoice[] = [],
): jest.Mocked<ISalesInvoiceRepository> =>
  ({
    create: jest.fn(async () => {}),
    update: jest.fn(async () => {}),
    getById: jest.fn(async () => null),
    getByNumber: jest.fn(async () => null),
    list: jest.fn(async () => invoices),
  } as unknown as jest.Mocked<ISalesInvoiceRepository>);

interface FakeSalesperson {
  id: string;
  name: string;
}

const makeSalespersonRepo = (
  salespersons: FakeSalesperson[] = [],
): jest.Mocked<ISalespersonRepository> =>
  ({
    create: jest.fn(async () => {}),
    update: jest.fn(async () => {}),
    getById: jest.fn(async () => null),
    getByCode: jest.fn(async () => null),
    list: jest.fn(async () => salespersons),
    delete: jest.fn(async () => {}),
  } as unknown as jest.Mocked<ISalespersonRepository>);

const COMPANY_ID = 'cmp-test';

// ---------------------------------------------------------------------------
// GetSalesByCustomerUseCase
// ---------------------------------------------------------------------------

describe('GetSalesByCustomerUseCase', () => {
  it('1. aggregates two customers across three invoices and sorts by revenue desc', async () => {
    const invoices = [
      makeInvoice({ customerId: 'cust-1', customerName: 'Acme Corp',  subtotalBase: 500,  taxTotalBase: 50,  grandTotalBase: 550  }),
      makeInvoice({ customerId: 'cust-2', customerName: 'Beta Ltd',   subtotalBase: 1500, taxTotalBase: 150, grandTotalBase: 1650 }),
      makeInvoice({ customerId: 'cust-1', customerName: 'Acme Corp',  subtotalBase: 700,  taxTotalBase: 70,  grandTotalBase: 770  }),
    ];
    const repo = makeSalesInvoiceRepo(invoices);
    const uc = new GetSalesByCustomerUseCase(repo);

    const report = await uc.execute({ companyId: COMPANY_ID });

    expect(report.rows).toHaveLength(2);

    // Highest revenue first: Beta Ltd (1500) then Acme Corp (1200)
    expect(report.rows[0].customerId).toBe('cust-2');
    expect(report.rows[0].totalRevenueBase).toBeCloseTo(1500);
    expect(report.rows[0].invoiceCount).toBe(1);

    expect(report.rows[1].customerId).toBe('cust-1');
    expect(report.rows[1].totalRevenueBase).toBeCloseTo(1200);
    expect(report.rows[1].invoiceCount).toBe(2);
    expect(report.rows[1].totalTaxBase).toBeCloseTo(120);
    expect(report.rows[1].totalGrossBase).toBeCloseTo(1320);

    // Grand totals
    expect(report.totals.invoiceCount).toBe(3);
    expect(report.totals.totalRevenueBase).toBeCloseTo(2700);
    expect(report.totals.totalTaxBase).toBeCloseTo(270);
    expect(report.totals.totalGrossBase).toBeCloseTo(2970);
  });

  it('2. DRAFT and CANCELLED invoices are excluded', async () => {
    const invoices = [
      makeInvoice({ status: 'DRAFT',     subtotalBase: 999 }),
      makeInvoice({ status: 'CANCELLED', subtotalBase: 888 }),
      makeInvoice({ status: 'POSTED',    subtotalBase: 200 }),
    ];
    // The use case calls list(companyId, { status: 'POSTED' }) so the repo
    // should only return POSTED ones. Simulate that behaviour in the mock.
    const postedOnly = invoices.filter(i => i.status === 'POSTED');
    const repo = makeSalesInvoiceRepo(postedOnly);
    const uc = new GetSalesByCustomerUseCase(repo);

    const report = await uc.execute({ companyId: COMPANY_ID });

    expect(report.totals.totalRevenueBase).toBeCloseTo(200);
    expect(report.totals.invoiceCount).toBe(1);
  });

  it('3. invoices outside [fromDate, toDate] are excluded', async () => {
    const invoices = [
      makeInvoice({ invoiceDate: '2026-01-15', subtotalBase: 999  }), // before range
      makeInvoice({ invoiceDate: '2026-03-01', subtotalBase: 400  }), // in range
      makeInvoice({ invoiceDate: '2026-06-01', subtotalBase: 888  }), // after range
    ];
    const repo = makeSalesInvoiceRepo(invoices);
    const uc = new GetSalesByCustomerUseCase(repo);

    const report = await uc.execute({
      companyId: COMPANY_ID,
      fromDate: '2026-02-01',
      toDate: '2026-04-30',
    });

    expect(report.totals.invoiceCount).toBe(1);
    expect(report.totals.totalRevenueBase).toBeCloseTo(400);
  });
});

// ---------------------------------------------------------------------------
// GetSalesByItemUseCase
// ---------------------------------------------------------------------------

describe('GetSalesByItemUseCase', () => {
  it('4. lines across multiple invoices for the same item aggregate correctly', async () => {
    const invoices = [
      makeInvoice({
        lines: [
          makeLine({ itemId: 'item-A', itemCode: 'A-001', itemName: 'Alpha', invoicedQty: 3, lineTotalBase: 300 }),
          makeLine({ itemId: 'item-B', itemCode: 'B-001', itemName: 'Beta',  invoicedQty: 2, lineTotalBase: 200 }),
        ],
      }),
      makeInvoice({
        lines: [
          makeLine({ itemId: 'item-A', itemCode: 'A-001', itemName: 'Alpha', invoicedQty: 5, lineTotalBase: 500 }),
        ],
      }),
    ];
    const repo = makeSalesInvoiceRepo(invoices);
    const uc = new GetSalesByItemUseCase(repo);

    const report = await uc.execute({ companyId: COMPANY_ID });

    expect(report.rows).toHaveLength(2);

    // item-A should be first (highest revenue: 800)
    expect(report.rows[0].itemId).toBe('item-A');
    expect(report.rows[0].totalQty).toBeCloseTo(8);
    expect(report.rows[0].totalRevenueBase).toBeCloseTo(800);
    expect(report.rows[0].lineCount).toBe(2);

    expect(report.rows[1].itemId).toBe('item-B');
    expect(report.rows[1].totalQty).toBeCloseTo(2);
    expect(report.rows[1].totalRevenueBase).toBeCloseTo(200);
    expect(report.rows[1].lineCount).toBe(1);

    // Grand totals
    expect(report.totals.totalQty).toBeCloseTo(10);
    expect(report.totals.totalRevenueBase).toBeCloseTo(1000);
    expect(report.totals.lineCount).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// GetSalesBySalespersonUseCase
// ---------------------------------------------------------------------------

describe('GetSalesBySalespersonUseCase', () => {
  it('5. invoices without salespersonId fall into the UNASSIGNED bucket', async () => {
    const invoices = [
      makeInvoice({ salespersonId: undefined, subtotalBase: 600, grandTotalBase: 660 }),
      makeInvoice({ salespersonId: undefined, subtotalBase: 400, grandTotalBase: 440 }),
    ];
    const siRepo = makeSalesInvoiceRepo(invoices);
    const spRepo = makeSalespersonRepo([]);
    const uc = new GetSalesBySalespersonUseCase(siRepo, spRepo);

    const report = await uc.execute({ companyId: COMPANY_ID });

    expect(report.rows).toHaveLength(1);
    expect(report.rows[0].salespersonId).toBe('UNASSIGNED');
    expect(report.rows[0].salespersonName).toBe('Unassigned');
    expect(report.rows[0].invoiceCount).toBe(2);
    expect(report.rows[0].totalRevenueBase).toBeCloseTo(1000);
    expect(report.rows[0].totalGrossBase).toBeCloseTo(1100);
  });

  it('6. salesperson name is resolved from the repository', async () => {
    const invoices = [
      makeInvoice({ salespersonId: 'sp-1', subtotalBase: 800, grandTotalBase: 880 }),
      makeInvoice({ salespersonId: 'sp-2', subtotalBase: 300, grandTotalBase: 330 }),
      makeInvoice({ salespersonId: 'sp-1', subtotalBase: 200, grandTotalBase: 220 }),
    ];
    const salespersons = [
      { id: 'sp-1', name: 'Alice Smith' },
      { id: 'sp-2', name: 'Bob Jones' },
    ];
    const siRepo = makeSalesInvoiceRepo(invoices);
    const spRepo = makeSalespersonRepo(salespersons);
    const uc = new GetSalesBySalespersonUseCase(siRepo, spRepo);

    const report = await uc.execute({ companyId: COMPANY_ID });

    expect(report.rows).toHaveLength(2);

    // sp-1 has higher revenue (1000) → first
    expect(report.rows[0].salespersonId).toBe('sp-1');
    expect(report.rows[0].salespersonName).toBe('Alice Smith');
    expect(report.rows[0].invoiceCount).toBe(2);
    expect(report.rows[0].totalRevenueBase).toBeCloseTo(1000);
    expect(report.rows[0].totalGrossBase).toBeCloseTo(1100);

    expect(report.rows[1].salespersonId).toBe('sp-2');
    expect(report.rows[1].salespersonName).toBe('Bob Jones');
    expect(report.rows[1].invoiceCount).toBe(1);
    expect(report.rows[1].totalRevenueBase).toBeCloseTo(300);

    // Grand totals
    expect(report.totals.invoiceCount).toBe(3);
    expect(report.totals.totalRevenueBase).toBeCloseTo(1300);
    expect(report.totals.totalGrossBase).toBeCloseTo(1430);
  });
});
