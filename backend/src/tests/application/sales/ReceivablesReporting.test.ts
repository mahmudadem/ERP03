/**
 * ReceivablesReporting.test.ts
 *
 * Tests for GetArAgingReportUseCase, GetCustomerLedgerUseCase,
 * and GetCustomerStatementUseCase.
 */

import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { Party } from '../../../domain/shared/entities/Party';
import { ISalesInvoiceRepository } from '../../../repository/interfaces/sales/ISalesInvoiceRepository';
import { IPaymentHistoryRepository } from '../../../repository/interfaces/shared/IPaymentHistoryRepository';
import { IPartyRepository } from '../../../repository/interfaces/shared/IPartyRepository';
import {
  GetArAgingReportUseCase,
  GetCustomerLedgerUseCase,
  GetCustomerStatementUseCase,
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

const makePayment = (overrides: {
  id?: string;
  invoiceId?: string;
  paymentDate?: string;
  amountBase?: number;
  reference?: string;
}) => ({
  id: overrides.id ?? `pmt-${Math.random().toString(36).slice(2)}`,
  sourceId: overrides.invoiceId ?? 'inv-1',
  paymentDate: overrides.paymentDate ?? '2026-02-01',
  amountBase: overrides.amountBase ?? 500,
  reference: overrides.reference,
});

const makeParty = (overrides: { id?: string; displayName?: string } = {}): Party =>
  new Party({
    id: overrides.id ?? 'cust-1',
    companyId: COMPANY_ID,
    code: 'C001',
    legalName: overrides.displayName ?? 'Acme Corp',
    displayName: overrides.displayName ?? 'Acme Corp',
    roles: ['CUSTOMER'],
    active: true,
    createdBy: 'u-test',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
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

const makePaymentHistoryRepo = (
  paymentsBySourceId: Record<string, ReturnType<typeof makePayment>[]> = {},
): jest.Mocked<IPaymentHistoryRepository> =>
  ({
    create: jest.fn(async () => {}),
    getById: jest.fn(async () => null),
    getBySource: jest.fn(async (_companyId: string, _sourceType: string, sourceId: string) =>
      paymentsBySourceId[sourceId] ?? [],
    ),
  } as unknown as jest.Mocked<IPaymentHistoryRepository>);

const makePartyRepo = (party: Party | null = null): jest.Mocked<IPartyRepository> =>
  ({
    create: jest.fn(async () => {}),
    update: jest.fn(async () => {}),
    getById: jest.fn(async () => party),
    getByCode: jest.fn(async () => null),
    list: jest.fn(async () => []),
    delete: jest.fn(async () => {}),
  } as unknown as jest.Mocked<IPartyRepository>);

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

// ---------------------------------------------------------------------------
// Customer Ledger tests
// ---------------------------------------------------------------------------

describe('GetCustomerLedgerUseCase', () => {
  it('7. invoice then payment → running balance goes up then down; final balance correct', async () => {
    const inv = makeInvoice({
      id: 'inv-1',
      invoiceDate: '2026-03-01',
      grandTotalBase: 1000,
      outstandingAmountBase: 500,
    });
    const payment = makePayment({ id: 'pmt-1', invoiceId: 'inv-1', paymentDate: '2026-03-15', amountBase: 500 });

    const siRepo = makeSalesInvoiceRepo([inv]);
    const pmtRepo = makePaymentHistoryRepo({ 'inv-1': [payment] });
    const partyRepo = makePartyRepo(makeParty());
    const uc = new GetCustomerLedgerUseCase(siRepo, pmtRepo, partyRepo);

    const ledger = await uc.execute({ companyId: COMPANY_ID, customerId: 'cust-1' });

    expect(ledger.events).toHaveLength(2);

    const [invEvent, pmtEvent] = ledger.events;
    expect(invEvent.type).toBe('INVOICE');
    expect(invEvent.debit).toBeCloseTo(1000);
    expect(invEvent.credit).toBe(0);
    expect(invEvent.runningBalance).toBeCloseTo(1000);

    expect(pmtEvent.type).toBe('PAYMENT');
    expect(pmtEvent.debit).toBe(0);
    expect(pmtEvent.credit).toBeCloseTo(500);
    expect(pmtEvent.runningBalance).toBeCloseTo(500);

    expect(ledger.closingBalance).toBeCloseTo(500);
  });

  it('8. openingBalance reflects events before fromDate; period events filtered correctly', async () => {
    // Invoice in Jan (before period), payment in Feb (before period), another invoice in April (in period)
    const inv1 = makeInvoice({ id: 'inv-jan', invoiceNumber: 'INV-001', invoiceDate: '2026-01-10', grandTotalBase: 1000, outstandingAmountBase: 600 });
    const inv2 = makeInvoice({ id: 'inv-apr', invoiceNumber: 'INV-002', invoiceDate: '2026-04-05', grandTotalBase: 500, outstandingAmountBase: 500 });
    const payment = makePayment({ id: 'pmt-feb', invoiceId: 'inv-jan', paymentDate: '2026-02-01', amountBase: 400 });

    const siRepo = makeSalesInvoiceRepo([inv1, inv2]);
    const pmtRepo = makePaymentHistoryRepo({ 'inv-jan': [payment], 'inv-apr': [] });
    const partyRepo = makePartyRepo(makeParty());
    const uc = new GetCustomerLedgerUseCase(siRepo, pmtRepo, partyRepo);

    // Period: March 1 through end of April
    const ledger = await uc.execute({
      companyId: COMPANY_ID,
      customerId: 'cust-1',
      fromDate: '2026-03-01',
      toDate: '2026-04-30',
    });

    // Opening balance = Jan invoice (1000) - Feb payment (400) = 600
    expect(ledger.openingBalance).toBeCloseTo(600);

    // Period events: only the April invoice
    expect(ledger.events).toHaveLength(1);
    expect(ledger.events[0].reference).toBe('INV-002');

    // Closing = opening (600) + April invoice (500) = 1100
    expect(ledger.closingBalance).toBeCloseTo(1100);
  });
});

// ---------------------------------------------------------------------------
// Customer Statement tests
// ---------------------------------------------------------------------------

describe('GetCustomerStatementUseCase', () => {
  it('9. totalInvoiced and totalPaid computed correctly from period lines', async () => {
    const inv1 = makeInvoice({ id: 'inv-a', invoiceNumber: 'INV-A', invoiceDate: '2026-04-01', grandTotalBase: 800, outstandingAmountBase: 300 });
    const inv2 = makeInvoice({ id: 'inv-b', invoiceNumber: 'INV-B', invoiceDate: '2026-04-10', grandTotalBase: 400, outstandingAmountBase: 400 });
    const pmt1 = makePayment({ id: 'pmt-a', invoiceId: 'inv-a', paymentDate: '2026-04-15', amountBase: 500 });

    const siRepo = makeSalesInvoiceRepo([inv1, inv2]);
    const pmtRepo = makePaymentHistoryRepo({ 'inv-a': [pmt1], 'inv-b': [] });
    const partyRepo = makePartyRepo(makeParty());
    const uc = new GetCustomerStatementUseCase(siRepo, pmtRepo, partyRepo);

    const stmt = await uc.execute({
      companyId: COMPANY_ID,
      customerId: 'cust-1',
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
    });

    expect(stmt.totalInvoiced).toBeCloseTo(800 + 400); // both invoices in period
    expect(stmt.totalPaid).toBeCloseTo(500);            // one payment in period
  });

  it('10. openInvoices lists only invoices with outstanding > 0', async () => {
    const invPaid    = makeInvoice({ id: 'inv-paid',    invoiceNumber: 'INV-PAID',    invoiceDate: '2026-04-01', grandTotalBase: 600, outstandingAmountBase: 0   });
    const invPartial = makeInvoice({ id: 'inv-partial', invoiceNumber: 'INV-PARTIAL', invoiceDate: '2026-04-05', grandTotalBase: 400, outstandingAmountBase: 200 });

    const siRepo = makeSalesInvoiceRepo([invPaid, invPartial]);
    const pmtRepo = makePaymentHistoryRepo({ 'inv-paid': [], 'inv-partial': [] });
    const partyRepo = makePartyRepo(makeParty());
    const uc = new GetCustomerStatementUseCase(siRepo, pmtRepo, partyRepo);

    const stmt = await uc.execute({
      companyId: COMPANY_ID,
      customerId: 'cust-1',
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
    });

    expect(stmt.openInvoices).toHaveLength(1);
    expect(stmt.openInvoices[0].invoiceId).toBe('inv-partial');
    expect(stmt.openInvoices[0].outstandingAmountBase).toBeCloseTo(200);
  });
});
