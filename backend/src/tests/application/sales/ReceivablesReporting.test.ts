/**
 * ReceivablesReporting.test.ts
 *
 * Tests for GetArAgingReportUseCase.
 * Customer Statement tests live in LedgerBackedCustomerStatement.test.ts.
 */

import { describe, expect, it, jest } from '@jest/globals';
import { ISalesInvoiceRepository } from '../../../repository/interfaces/sales/ISalesInvoiceRepository';
import {
  GetArAgingReportUseCase,
} from '../../../application/sales/use-cases/ReceivablesReportingUseCases';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COMPANY_ID = 'cmp-ar-test';
const AS_OF = '2026-05-20'; // fixed "today" for aging tests

// ---------------------------------------------------------------------------
// Helpers — plain object shapes (avoid constructing full domain objects)
// ---------------------------------------------------------------------------

const makeInvoice = (overrides: {
  id?: string;
  invoiceNumber?: string;
  customerId?: string;
  customerName?: string;
  invoiceDate?: string;
  dueDate?: string;
  grandTotalBase?: number;
  outstandingAmountBase?: number;
  status?: 'POSTED' | 'DRAFT' | 'CANCELLED';
}) => ({
  id: overrides.id ?? `inv-${Math.random().toString(36).slice(2)}`,
  companyId: COMPANY_ID,
  invoiceNumber: overrides.invoiceNumber ?? 'INV-001',
  customerId: overrides.customerId ?? 'cust-1',
  customerName: overrides.customerName ?? 'Acme Corp',
  invoiceDate: overrides.invoiceDate ?? '2026-01-01',
  dueDate: overrides.dueDate,
  grandTotalBase: overrides.grandTotalBase ?? 1000,
  outstandingAmountBase: overrides.outstandingAmountBase ?? 1000,
  status: overrides.status ?? 'POSTED',
});

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

const makeSalesInvoiceRepo = (
  invoices: ReturnType<typeof makeInvoice>[] = [],
): jest.Mocked<ISalesInvoiceRepository> =>
  ({
    create: jest.fn(async () => {}),
    update: jest.fn(async () => {}),
    getById: jest.fn(async () => null),
    getByNumber: jest.fn(async () => null),
    list: jest.fn(async () => invoices),
  } as unknown as jest.Mocked<ISalesInvoiceRepository>);

// ---------------------------------------------------------------------------
// AR Aging Report tests
// ---------------------------------------------------------------------------

describe('GetArAgingReportUseCase', () => {
  // AS_OF = '2026-05-20'
  // dueDate = '2026-04-05' → 45 days ago → Days31_60
  it('1. invoice 45 days overdue lands in Days31_60', async () => {
    const inv = makeInvoice({ id: 'inv-1', dueDate: '2026-04-05', outstandingAmountBase: 800 });
    const repo = makeSalesInvoiceRepo([inv]);
    const uc = new GetArAgingReportUseCase(repo);

    const report = await uc.execute({ companyId: COMPANY_ID, asOfDate: AS_OF });

    expect(report.rows).toHaveLength(1);
    const row = report.rows[0];
    expect(row.days31_60).toBeCloseTo(800);
    expect(row.current).toBe(0);
    expect(row.days1_30).toBe(0);
    expect(row.invoices[0].bucket).toBe('Days31_60');
    expect(row.invoices[0].daysOverdue).toBe(45);
  });

  it('2. invoice not yet due lands in Current', async () => {
    // dueDate in the future → daysOverdue < 0
    const inv = makeInvoice({ id: 'inv-2', dueDate: '2026-06-01', outstandingAmountBase: 500 });
    const repo = makeSalesInvoiceRepo([inv]);
    const uc = new GetArAgingReportUseCase(repo);

    const report = await uc.execute({ companyId: COMPANY_ID, asOfDate: AS_OF });

    const row = report.rows[0];
    expect(row.current).toBeCloseTo(500);
    expect(row.days1_30).toBe(0);
    expect(row.invoices[0].bucket).toBe('Current');
  });

  it('3. invoice 120 days overdue lands in Days90Plus', async () => {
    // AS_OF = '2026-05-20', dueDate = '2026-01-20' → 120 days
    const inv = makeInvoice({ id: 'inv-3', dueDate: '2026-01-20', outstandingAmountBase: 1200 });
    const repo = makeSalesInvoiceRepo([inv]);
    const uc = new GetArAgingReportUseCase(repo);

    const report = await uc.execute({ companyId: COMPANY_ID, asOfDate: AS_OF });

    const row = report.rows[0];
    expect(row.days90Plus).toBeCloseTo(1200);
    expect(row.invoices[0].bucket).toBe('Days90Plus');
  });

  it('4. bucket amounts sum to grand total', async () => {
    const invoices = [
      makeInvoice({ id: 'inv-a', customerId: 'cust-1', dueDate: '2026-04-05', outstandingAmountBase: 800 }),  // 45 days → Days31_60
      makeInvoice({ id: 'inv-b', customerId: 'cust-1', dueDate: '2026-06-01', outstandingAmountBase: 500 }),  // future → Current
      makeInvoice({ id: 'inv-c', customerId: 'cust-2', customerName: 'Beta Ltd', dueDate: '2026-01-20', outstandingAmountBase: 1200 }), // 120 days → Days90Plus
    ];
    const repo = makeSalesInvoiceRepo(invoices);
    const uc = new GetArAgingReportUseCase(repo);

    const report = await uc.execute({ companyId: COMPANY_ID, asOfDate: AS_OF });

    const { totals } = report;
    const bucketSum = totals.current + totals.days1_30 + totals.days31_60 + totals.days61_90 + totals.days90Plus;
    expect(bucketSum).toBeCloseTo(totals.total);
    expect(totals.total).toBeCloseTo(800 + 500 + 1200);
  });

  it('5. fully-paid invoices (outstanding 0) are excluded', async () => {
    const invoices = [
      makeInvoice({ id: 'inv-paid', outstandingAmountBase: 0 }),
      makeInvoice({ id: 'inv-partial', outstandingAmountBase: 200, dueDate: '2026-04-01' }),
    ];
    const repo = makeSalesInvoiceRepo(invoices);
    const uc = new GetArAgingReportUseCase(repo);

    const report = await uc.execute({ companyId: COMPANY_ID, asOfDate: AS_OF });

    // Only the partial remains
    expect(report.rows[0].invoices).toHaveLength(1);
    expect(report.rows[0].invoices[0].invoiceId).toBe('inv-partial');
    expect(report.totals.total).toBeCloseTo(200);
  });

  it('6. uses invoiceDate when dueDate is absent', async () => {
    // invoiceDate = '2026-04-05', no dueDate → 45 days before AS_OF
    const inv = makeInvoice({ id: 'inv-nodue', invoiceDate: '2026-04-05', dueDate: undefined, outstandingAmountBase: 300 });
    const repo = makeSalesInvoiceRepo([inv]);
    const uc = new GetArAgingReportUseCase(repo);

    const report = await uc.execute({ companyId: COMPANY_ID, asOfDate: AS_OF });

    const detail = report.rows[0].invoices[0];
    expect(detail.daysOverdue).toBe(45);
    expect(detail.bucket).toBe('Days31_60');
    expect(report.rows[0].days31_60).toBeCloseTo(300);
  });
});


