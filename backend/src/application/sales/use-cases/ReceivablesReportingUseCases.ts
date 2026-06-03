/**
 * ReceivablesReportingUseCases.ts
 *
 * Read-side AR reporting: aging report, customer ledger, customer statement.
 * No writes — uses existing repositories via read-only queries.
 */

import { ISalesInvoiceRepository } from '../../../repository/interfaces/sales/ISalesInvoiceRepository';
import { ISalesOrderRepository } from '../../../repository/interfaces/sales/ISalesOrderRepository';
import { IPaymentHistoryRepository } from '../../../repository/interfaces/shared/IPaymentHistoryRepository';
import { IPartyRepository } from '../../../repository/interfaces/shared/IPartyRepository';
import { VoucherEntity } from '../../../domain/accounting/entities/VoucherEntity';
import { VoucherType } from '../../../domain/accounting/types/VoucherTypes';
import { GetAccountStatementUseCase, AccountStatementEntry } from '../../accounting/use-cases/LedgerUseCases';
import { GetVoucherUseCase } from '../../accounting/use-cases/VoucherUseCases';

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
  ledgerBalance?: number;
  unallocated?: number;
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
  type: 'INVOICE' | 'PAYMENT' | 'CREDIT_NOTE' | 'REFUND' | 'ADJUSTMENT';
  reference: string;
  debit: number;
  credit: number;
  runningBalance: number;
  ledgerEntryId?: string;
  voucherId?: string;
  voucherNo?: string;
  voucherType?: string;
  voucherFormId?: string;
  voucherPart?: string;
  description?: string;
  sourceModule?: string;
  sourceType?: string;
  sourceId?: string;
  sourceLabel?: string;
}

export interface CustomerStatement {
  customerId: string;
  customerName: string;
  accountId?: string;
  accountCode?: string;
  accountName?: string;
  fromDate: string;
  toDate: string;
  openingBalance: number;
  closingBalance: number;
  lines: LedgerEvent[];
  totalInvoiced: number;
  totalPaid: number;
  totalCredited?: number;
  totalAdjusted?: number;
  openInvoices: {
    invoiceId: string;
    invoiceNumber: string;
    invoiceDate: string;
    dueDate: string | undefined;
    grandTotalBase: number;
    outstandingAmountBase: number;
  }[];
  openCommitments?: CustomerStatementCommitment[];
}

export interface CustomerStatementCommitment {
  sourceType: 'SALES_ORDER';
  sourceId: string;
  documentNumber: string;
  date: string;
  expectedDate?: string;
  status: string;
  amountBase: number;
  openAmountBase: number;
  description?: string;
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
// 1b. GetLedgerBackedArAgingUseCase — AR Aging via Accounting ledger
// ---------------------------------------------------------------------------

export class GetLedgerBackedArAgingUseCase {
  constructor(
    private readonly partyRepo: IPartyRepository,
    private readonly salesInvoiceRepo: ISalesInvoiceRepository,
    private readonly accountStatementUseCase: GetAccountStatementUseCase,
  ) {}

  async execute(input: ArAgingInput & { userId: string }): Promise<ArAgingReport> {
    const { companyId, userId, customerId } = input;
    const asOfDate = input.asOfDate ?? new Date().toISOString().slice(0, 10);
    const epochStart = '1900-01-01';

    const customers = customerId
      ? [await this.partyRepo.getById(companyId, customerId)].filter(Boolean) as any[]
      : await this.partyRepo.list(companyId, { role: 'CUSTOMER' as any, active: true });

    const withAccounts = customers.filter((c: any) => c.defaultARAccountId);

    const byCustomer = new Map<string, ArAgingCustomerRow>();

    for (const customer of withAccounts) {
      let ledgerBalance = 0;
      try {
        const stmt = await this.accountStatementUseCase.execute(
          companyId, userId, customer.defaultARAccountId, epochStart, asOfDate,
          { includeUnposted: false },
        );
        ledgerBalance = round2(Number(stmt.closingBalanceBase ?? stmt.closingBalance ?? 0));
      } catch {
        continue;
      }

      if (Math.abs(ledgerBalance) < 0.005) continue;

      const invoices = await this.salesInvoiceRepo.list(companyId, {
        status: 'POSTED',
        customerId: customer.id,
      });

      const outstanding = invoices.filter(inv => inv.outstandingAmountBase > 0.005);

      const row: ArAgingCustomerRow = {
        customerId: customer.id,
        customerName: customer.displayName || customer.legalName,
        current: 0,
        days1_30: 0,
        days31_60: 0,
        days61_90: 0,
        days90Plus: 0,
        total: 0,
        ledgerBalance,
        invoices: [],
      };

      let invoiceSum = 0;
      for (const inv of outstanding) {
        const agingDate = inv.dueDate ?? inv.invoiceDate;
        const daysOverdue = daysDiff(asOfDate, agingDate);
        const bucket = agingBucket(daysOverdue);
        const amount = round2(inv.outstandingAmountBase);
        invoiceSum = round2(invoiceSum + amount);

        row.invoices.push({
          invoiceId: inv.id,
          invoiceNumber: inv.invoiceNumber,
          invoiceDate: inv.invoiceDate,
          dueDate: inv.dueDate,
          daysOverdue,
          outstandingAmountBase: amount,
          bucket,
        });

        switch (bucket) {
          case 'Current':    row.current    = round2(row.current    + amount); break;
          case 'Days1_30':   row.days1_30   = round2(row.days1_30   + amount); break;
          case 'Days31_60':  row.days31_60  = round2(row.days31_60  + amount); break;
          case 'Days61_90':  row.days61_90  = round2(row.days61_90  + amount); break;
          case 'Days90Plus': row.days90Plus = round2(row.days90Plus + amount); break;
        }
      }

      const diff = round2(ledgerBalance - invoiceSum);
      if (Math.abs(diff) > 0.005) {
        row.unallocated = diff;
      }

      row.total = ledgerBalance;
      byCustomer.set(customer.id, row);
    }

    const rows = Array.from(byCustomer.values());

    const totals = {
      current:    round2(rows.reduce((s, r) => s + r.current,    0)),
      days1_30:   round2(rows.reduce((s, r) => s + r.days1_30,   0)),
      days31_60:  round2(rows.reduce((s, r) => s + r.days31_60,  0)),
      days61_90:  round2(rows.reduce((s, r) => s + r.days61_90,  0)),
      days90Plus: round2(rows.reduce((s, r) => s + r.days90Plus, 0)),
      total:      round2(rows.reduce((s, r) => s + r.total,      0)),
    };

    return { asOfDate, rows, totals };
  }
}

// ---------------------------------------------------------------------------
// 2. CustomerStatementInput — shared by the ledger-backed use case below
// ---------------------------------------------------------------------------

export interface CustomerStatementInput {
  companyId: string;
  userId?: string;
  customerId: string;
  fromDate: string;
  toDate: string;
  includeOpenCommitments?: boolean;
}

export class CustomerStatementMissingAccountError extends Error {
  readonly code = 'CUSTOMER_AR_ACCOUNT_MISSING';
  readonly statusCode = 412;

  constructor(customerId: string) {
    super(
      `Customer ${customerId} has no default AR account. Run the customer account backfill or assign an AR account before generating the statement.`,
    );
    this.name = 'CustomerStatementMissingAccountError';
  }
}

export class GetLedgerBackedCustomerStatementUseCase {
  constructor(
    private readonly partyRepo: IPartyRepository,
    private readonly salesInvoiceRepo: ISalesInvoiceRepository,
    private readonly salesOrderRepo: ISalesOrderRepository,
    private readonly accountStatementUseCase: GetAccountStatementUseCase,
    private readonly getVoucherUseCase: GetVoucherUseCase,
  ) {}

  async execute(input: CustomerStatementInput): Promise<CustomerStatement> {
    const { companyId, customerId, fromDate, toDate } = input;
    const userId = input.userId || 'system';

    const party = await this.partyRepo.getById(companyId, customerId);
    if (!party) {
      throw new Error(`Customer not found: ${customerId}`);
    }
    if (!party.defaultARAccountId) {
      throw new CustomerStatementMissingAccountError(customerId);
    }

    const statement = await this.accountStatementUseCase.execute(
      companyId,
      userId,
      party.defaultARAccountId,
      fromDate,
      toDate,
      { includeUnposted: false },
    );

    const vouchers = await this.loadVouchers(companyId, statement.entries || [], userId);
    const lines = (statement.entries || []).map((entry) =>
      this.decorateEntry(entry, vouchers.get(entry.voucherId)),
    );

    const openInvoices = await this.loadOpenInvoices(companyId, customerId);
    const openCommitments = input.includeOpenCommitments
      ? await this.loadOpenCommitments(companyId, customerId)
      : undefined;

    return {
      customerId,
      customerName: party.displayName || party.legalName,
      accountId: statement.accountId,
      accountCode: statement.accountCode,
      accountName: statement.accountName,
      fromDate,
      toDate,
      openingBalance: round2(statement.openingBalanceBase ?? statement.openingBalance ?? 0),
      closingBalance: round2(statement.closingBalanceBase ?? statement.closingBalance ?? 0),
      lines,
      totalInvoiced: round2(lines.filter((line) => line.type === 'INVOICE').reduce((sum, line) => sum + line.debit, 0)),
      totalPaid: round2(lines.filter((line) => line.type === 'PAYMENT').reduce((sum, line) => sum + line.credit, 0)),
      totalCredited: round2(lines.filter((line) => line.type === 'CREDIT_NOTE' || line.type === 'REFUND').reduce((sum, line) => sum + line.credit, 0)),
      totalAdjusted: round2(lines.filter((line) => line.type === 'ADJUSTMENT').reduce((sum, line) => sum + line.debit - line.credit, 0)),
      openInvoices,
      openCommitments,
    };
  }

  private async loadVouchers(
    companyId: string,
    entries: AccountStatementEntry[],
    userId: string,
  ): Promise<Map<string, VoucherEntity>> {
    const voucherIds = [...new Set(entries.map((entry) => entry.voucherId).filter(Boolean))];
    const pairs = await Promise.all(
      voucherIds.map(async (voucherId) => {
        const voucher = await this.getVoucherUseCase.execute(companyId, userId, voucherId).catch(() => null);
        return [voucherId, voucher] as const;
      }),
    );

    const byId = new Map<string, VoucherEntity>();
    for (const [voucherId, voucher] of pairs) {
      if (voucher) byId.set(voucherId, voucher);
    }
    return byId;
  }

  private decorateEntry(entry: AccountStatementEntry, voucher?: VoucherEntity): LedgerEvent {
    const metadata = voucher?.metadata || {};
    const sourceType =
      metadata.sourceType ||
      metadata.referenceType ||
      (metadata.sourceInvoiceId ? 'SALES_INVOICE' : undefined);
    const sourceId = metadata.sourceId || metadata.referenceId || metadata.sourceInvoiceId;
    const type = this.classifyLine(entry, voucher, sourceType, metadata);

    return {
      ledgerEntryId: entry.id,
      date: entry.date,
      type,
      reference: voucher?.reference || voucher?.voucherNo || entry.voucherNo || entry.voucherId,
      debit: round2(Number(entry.baseDebit ?? entry.debit ?? 0)),
      credit: round2(Number(entry.baseCredit ?? entry.credit ?? 0)),
      runningBalance: round2(Number(entry.baseBalance ?? entry.balance ?? 0)),
      voucherId: entry.voucherId,
      voucherNo: voucher?.voucherNo || entry.voucherNo,
      voucherType: voucher?.type,
      voucherFormId: voucher?.formId,
      voucherPart: metadata.voucherPart,
      description: entry.description || voucher?.description,
      sourceModule: metadata.sourceModule,
      sourceType,
      sourceId,
      sourceLabel: this.sourceLabel(sourceType, sourceId),
    };
  }

  private classifyLine(
    entry: AccountStatementEntry,
    voucher: VoucherEntity | undefined,
    sourceType: string | undefined,
    metadata: Record<string, any>,
  ): LedgerEvent['type'] {
    const debit = Number(entry.baseDebit ?? entry.debit ?? 0);
    const credit = Number(entry.baseCredit ?? entry.credit ?? 0);
    const voucherType = voucher?.type;

    if (sourceType === 'SALES_RETURN') {
      return metadata.voucherPart === 'REFUND' ? 'REFUND' : 'CREDIT_NOTE';
    }
    if (voucherType === VoucherType.RECEIPT || metadata.settlementMode || metadata.sourceInvoiceId) {
      return 'PAYMENT';
    }
    if (sourceType === 'SALES_INVOICE' || voucherType === VoucherType.SALES_INVOICE) {
      return debit >= credit ? 'INVOICE' : 'PAYMENT';
    }
    return 'ADJUSTMENT';
  }

  private sourceLabel(sourceType?: string, sourceId?: string): string | undefined {
    if (!sourceType || !sourceId) return undefined;
    switch (sourceType) {
      case 'SALES_INVOICE':
        return 'Sales Invoice';
      case 'SALES_RETURN':
        return 'Sales Return';
      case 'SALES_ORDER':
        return 'Sales Order';
      default:
        return sourceType.replace(/_/g, ' ').toLowerCase();
    }
  }

  private async loadOpenInvoices(companyId: string, customerId: string): Promise<CustomerStatement['openInvoices']> {
    const invoices = await this.salesInvoiceRepo.list(companyId, {
      status: 'POSTED',
      customerId,
    });

    return invoices
      .filter((inv) => inv.outstandingAmountBase > 0.005)
      .map((inv) => ({
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        invoiceDate: inv.invoiceDate,
        dueDate: inv.dueDate,
        grandTotalBase: round2(inv.grandTotalBase),
        outstandingAmountBase: round2(inv.outstandingAmountBase),
      }));
  }

  private async loadOpenCommitments(companyId: string, customerId: string): Promise<CustomerStatementCommitment[]> {
    const orders = await this.salesOrderRepo.list(companyId, { customerId });
    return orders
      .filter((order) => !['CLOSED', 'CANCELLED'].includes(order.status))
      .map((order) => {
        const openAmountBase = round2(
          order.lines.reduce((sum, line) => {
            const remainingQty = Math.max((line.orderedQty || 0) - (line.invoicedQty || 0), 0);
            if (remainingQty <= 0 || !line.orderedQty) return sum;
            const lineTotalWithTax = (line.lineTotalBase || 0) + (line.taxAmountBase || 0);
            return sum + (lineTotalWithTax / line.orderedQty) * remainingQty;
          }, 0),
        );

        return {
          sourceType: 'SALES_ORDER' as const,
          sourceId: order.id,
          documentNumber: order.orderNumber,
          date: order.orderDate,
          expectedDate: order.expectedDeliveryDate,
          status: order.status,
          amountBase: round2(order.grandTotalBase),
          openAmountBase,
          description: order.notes,
        };
      })
      .filter((order) => order.openAmountBase > 0.005 || order.status === 'DRAFT' || order.status === 'CONFIRMED');
  }
}
