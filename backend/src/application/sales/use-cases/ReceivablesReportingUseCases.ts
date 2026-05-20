/**
 * ReceivablesReportingUseCases.ts
 *
 * Read-side AR reporting: aging report, customer ledger, customer statement.
 * No writes — uses existing repositories via read-only queries.
 */

import { ISalesInvoiceRepository } from '../../../repository/interfaces/sales/ISalesInvoiceRepository';
import { IPaymentHistoryRepository } from '../../../repository/interfaces/shared/IPaymentHistoryRepository';
import { IPartyRepository } from '../../../repository/interfaces/shared/IPartyRepository';

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export interface ArAgingInvoiceDetail {
  invoiceId: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string | undefined;
  daysOverdue: number;
  outstandingAmountBase: number;
  bucket: string;
}

export interface ArAgingCustomerRow {
  customerId: string;
  customerName: string;
  current: number;
  days1_30: number;
  days31_60: number;
  days61_90: number;
  days90Plus: number;
  total: number;
  invoices: ArAgingInvoiceDetail[];
}

export interface ArAgingReport {
  asOfDate: string;
  rows: ArAgingCustomerRow[];
  totals: {
    current: number;
    days1_30: number;
    days31_60: number;
    days61_90: number;
    days90Plus: number;
    total: number;
  };
}

export interface LedgerEvent {
  date: string;
  type: 'INVOICE' | 'PAYMENT';
  reference: string;
  debit: number;
  credit: number;
  runningBalance: number;
}

export interface CustomerLedger {
  customerId: string;
  customerName: string;
  fromDate?: string;
  toDate?: string;
  openingBalance: number;
  events: LedgerEvent[];
  closingBalance: number;
}

export interface CustomerStatement {
  customerId: string;
  customerName: string;
  fromDate: string;
  toDate: string;
  openingBalance: number;
  closingBalance: number;
  lines: LedgerEvent[];
  totalInvoiced: number;
  totalPaid: number;
  openInvoices: {
    invoiceId: string;
    invoiceNumber: string;
    invoiceDate: string;
    dueDate: string | undefined;
    grandTotalBase: number;
    outstandingAmountBase: number;
  }[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/** Return whole-day difference (asOfDate - date), positive means past-due. */
function daysDiff(asOfDate: string, date: string): number {
  const msPerDay = 86_400_000;
  const a = new Date(asOfDate).getTime();
  const b = new Date(date).getTime();
  return Math.floor((a - b) / msPerDay);
}

/** Classify days-overdue into a bucket label. */
function agingBucket(daysOverdue: number): string {
  if (daysOverdue <= 0) return 'Current';
  if (daysOverdue <= 30) return 'Days1_30';
  if (daysOverdue <= 60) return 'Days31_60';
  if (daysOverdue <= 90) return 'Days61_90';
  return 'Days90Plus';
}

// ---------------------------------------------------------------------------
// 1. GetArAgingReportUseCase
// ---------------------------------------------------------------------------

export interface ArAgingInput {
  companyId: string;
  asOfDate?: string;
  customerId?: string;
}

export class GetArAgingReportUseCase {
  constructor(private readonly salesInvoiceRepo: ISalesInvoiceRepository) {}

  async execute(input: ArAgingInput): Promise<ArAgingReport> {
    const { companyId, customerId } = input;
    const asOfDate = input.asOfDate ?? new Date().toISOString().slice(0, 10);

    const invoices = await this.salesInvoiceRepo.list(companyId, {
      status: 'POSTED',
      ...(customerId ? { customerId } : {}),
    });

    // Filter out fully-paid invoices (outstanding <= 0.005)
    const outstanding = invoices.filter(inv => inv.outstandingAmountBase > 0.005);

    // Group by customer
    const byCustomer = new Map<string, ArAgingCustomerRow>();

    for (const inv of outstanding) {
      const agingDate = inv.dueDate ?? inv.invoiceDate;
      const daysOverdue = daysDiff(asOfDate, agingDate);
      const bucket = agingBucket(daysOverdue);
      const amount = round2(inv.outstandingAmountBase);

      const detail: ArAgingInvoiceDetail = {
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        invoiceDate: inv.invoiceDate,
        dueDate: inv.dueDate,
        daysOverdue,
        outstandingAmountBase: amount,
        bucket,
      };

      let row = byCustomer.get(inv.customerId);
      if (!row) {
        row = {
          customerId: inv.customerId,
          customerName: inv.customerName,
          current: 0,
          days1_30: 0,
          days31_60: 0,
          days61_90: 0,
          days90Plus: 0,
          total: 0,
          invoices: [],
        };
        byCustomer.set(inv.customerId, row);
      }

      row.invoices.push(detail);
      row.total = round2(row.total + amount);

      switch (bucket) {
        case 'Current':   row.current   = round2(row.current   + amount); break;
        case 'Days1_30':  row.days1_30  = round2(row.days1_30  + amount); break;
        case 'Days31_60': row.days31_60 = round2(row.days31_60 + amount); break;
        case 'Days61_90': row.days61_90 = round2(row.days61_90 + amount); break;
        case 'Days90Plus':row.days90Plus= round2(row.days90Plus+ amount); break;
      }
    }

    const rows = Array.from(byCustomer.values());

    const totals = {
      current:   round2(rows.reduce((s, r) => s + r.current,   0)),
      days1_30:  round2(rows.reduce((s, r) => s + r.days1_30,  0)),
      days31_60: round2(rows.reduce((s, r) => s + r.days31_60, 0)),
      days61_90: round2(rows.reduce((s, r) => s + r.days61_90, 0)),
      days90Plus:round2(rows.reduce((s, r) => s + r.days90Plus,0)),
      total:     round2(rows.reduce((s, r) => s + r.total,     0)),
    };

    return { asOfDate, rows, totals };
  }
}

// ---------------------------------------------------------------------------
// 2. GetCustomerLedgerUseCase — shared event-building logic
// ---------------------------------------------------------------------------

export interface CustomerLedgerInput {
  companyId: string;
  customerId: string;
  fromDate?: string;
  toDate?: string;
}

/** Internal raw event before running balance is applied. */
interface RawEvent {
  date: string;
  type: 'INVOICE' | 'PAYMENT';
  reference: string;
  debit: number;
  credit: number;
  /** Secondary sort key: INVOICE sorts before PAYMENT on same date. */
  sortOrder: 0 | 1;
}

export class GetCustomerLedgerUseCase {
  constructor(
    private readonly salesInvoiceRepo: ISalesInvoiceRepository,
    private readonly paymentHistoryRepo: IPaymentHistoryRepository,
    private readonly partyRepo: IPartyRepository,
  ) {}

  /**
   * Build an unsorted list of raw ledger events for a customer.
   * Exported as a protected-style helper so GetCustomerStatementUseCase can
   * call it without duplicating logic.
   */
  async _buildRawEvents(companyId: string, customerId: string): Promise<{
    customerName: string;
    rawEvents: RawEvent[];
    invoices: Array<{ id: string; invoiceNumber: string; invoiceDate: string; dueDate?: string; grandTotalBase: number; outstandingAmountBase: number }>;
  }> {
    const party = await this.partyRepo.getById(companyId, customerId);
    if (!party) {
      throw new Error(`Customer not found: ${customerId}`);
    }

    const invoices = await this.salesInvoiceRepo.list(companyId, {
      status: 'POSTED',
      customerId,
    });

    const rawEvents: RawEvent[] = [];

    for (const inv of invoices) {
      // Invoice event — debit
      rawEvents.push({
        date: inv.invoiceDate,
        type: 'INVOICE',
        reference: inv.invoiceNumber,
        debit: round2(inv.grandTotalBase),
        credit: 0,
        sortOrder: 0,
      });

      // Payment events — credit
      const payments = await this.paymentHistoryRepo.getBySource(
        companyId,
        'SALES_INVOICE',
        inv.id,
      );

      for (const pmt of payments) {
        rawEvents.push({
          date: pmt.paymentDate,
          type: 'PAYMENT',
          reference: pmt.reference ?? pmt.id,
          debit: 0,
          credit: round2(pmt.amountBase),
          sortOrder: 1,
        });
      }
    }

    // Sort chronologically; invoices before payments on same date
    rawEvents.sort((a, b) => {
      if (a.date < b.date) return -1;
      if (a.date > b.date) return 1;
      return a.sortOrder - b.sortOrder;
    });

    const invoiceSummary = invoices.map(inv => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      invoiceDate: inv.invoiceDate,
      dueDate: inv.dueDate,
      grandTotalBase: inv.grandTotalBase,
      outstandingAmountBase: inv.outstandingAmountBase,
    }));

    return { customerName: party.displayName || party.legalName, rawEvents, invoices: invoiceSummary };
  }

  async execute(input: CustomerLedgerInput): Promise<CustomerLedger> {
    const { companyId, customerId, fromDate, toDate } = input;

    const { customerName, rawEvents } = await this._buildRawEvents(companyId, customerId);

    // Compute running balance over ALL events (needed for openingBalance)
    let runningBalance = 0;
    let openingBalance = 0;

    const periodEvents: LedgerEvent[] = [];

    for (const raw of rawEvents) {
      const isBeforePeriod = fromDate ? raw.date < fromDate : false;
      const isAfterPeriod  = toDate   ? raw.date > toDate   : false;

      runningBalance = round2(runningBalance + raw.debit - raw.credit);

      if (isBeforePeriod) {
        openingBalance = runningBalance;
        continue;
      }
      if (isAfterPeriod) {
        continue;
      }

      periodEvents.push({
        date: raw.date,
        type: raw.type,
        reference: raw.reference,
        debit: raw.debit,
        credit: raw.credit,
        runningBalance,
      });
    }

    const closingBalance = fromDate
      ? round2(openingBalance + periodEvents.reduce((s, e) => s + e.debit - e.credit, 0))
      : runningBalance;

    return {
      customerId,
      customerName,
      fromDate,
      toDate,
      openingBalance,
      events: periodEvents,
      closingBalance,
    };
  }
}

// ---------------------------------------------------------------------------
// 3. GetCustomerStatementUseCase
// ---------------------------------------------------------------------------

export interface CustomerStatementInput {
  companyId: string;
  customerId: string;
  fromDate: string;
  toDate: string;
}

export class GetCustomerStatementUseCase {
  private readonly ledgerUseCase: GetCustomerLedgerUseCase;

  constructor(
    salesInvoiceRepo: ISalesInvoiceRepository,
    paymentHistoryRepo: IPaymentHistoryRepository,
    partyRepo: IPartyRepository,
  ) {
    this.ledgerUseCase = new GetCustomerLedgerUseCase(
      salesInvoiceRepo,
      paymentHistoryRepo,
      partyRepo,
    );
  }

  async execute(input: CustomerStatementInput): Promise<CustomerStatement> {
    const { companyId, customerId, fromDate, toDate } = input;

    // Reuse the ledger for period events and balances
    const ledger = await this.ledgerUseCase.execute({
      companyId,
      customerId,
      fromDate,
      toDate,
    });

    const totalInvoiced = round2(
      ledger.events.filter(e => e.type === 'INVOICE').reduce((s, e) => s + e.debit, 0),
    );
    const totalPaid = round2(
      ledger.events.filter(e => e.type === 'PAYMENT').reduce((s, e) => s + e.credit, 0),
    );

    // Open invoices as of toDate: use the raw invoice list from the shared helper
    const { invoices } = await this.ledgerUseCase._buildRawEvents(companyId, customerId);
    const openInvoices = invoices
      .filter(inv => inv.outstandingAmountBase > 0.005)
      .map(inv => ({
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        invoiceDate: inv.invoiceDate,
        dueDate: inv.dueDate,
        grandTotalBase: inv.grandTotalBase,
        outstandingAmountBase: inv.outstandingAmountBase,
      }));

    return {
      customerId,
      customerName: ledger.customerName,
      fromDate,
      toDate,
      openingBalance: ledger.openingBalance,
      closingBalance: ledger.closingBalance,
      lines: ledger.events,
      totalInvoiced,
      totalPaid,
      openInvoices,
    };
  }
}
