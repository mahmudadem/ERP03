import { GetAccountStatementUseCase, AccountStatementEntry } from '../../accounting/use-cases/LedgerUseCases';
import { VoucherEntity } from '../../../domain/accounting/entities/VoucherEntity';
import { VoucherType } from '../../../domain/accounting/types/VoucherTypes';
import { GetVoucherUseCase } from '../../accounting/use-cases/VoucherUseCases';
import { IPurchaseInvoiceRepository } from '../../../repository/interfaces/purchases/IPurchaseInvoiceRepository';
import { IPurchaseOrderRepository } from '../../../repository/interfaces/purchases/IPurchaseOrderRepository';
import { IPartyRepository } from '../../../repository/interfaces/shared/IPartyRepository';

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

function daysDiff(asOfDate: string, date: string): number {
  const msPerDay = 86_400_000;
  return Math.floor((new Date(asOfDate).getTime() - new Date(date).getTime()) / msPerDay);
}

function agingBucket(daysOverdue: number): string {
  if (daysOverdue <= 0) return 'Current';
  if (daysOverdue <= 30) return 'Days1_30';
  if (daysOverdue <= 60) return 'Days31_60';
  if (daysOverdue <= 90) return 'Days61_90';
  return 'Days90Plus';
}

// ---------------------------------------------------------------------------
// AP Aging types
// ---------------------------------------------------------------------------

export interface ApAgingInvoiceDetail {
  invoiceId: string;
  invoiceNumber: string;
  vendorInvoiceNumber?: string;
  invoiceDate: string;
  dueDate: string | undefined;
  daysOverdue: number;
  outstandingAmountBase: number;
  bucket: string;
}

export interface ApAgingVendorRow {
  vendorId: string;
  vendorName: string;
  current: number;
  days1_30: number;
  days31_60: number;
  days61_90: number;
  days90Plus: number;
  total: number;
  ledgerBalance?: number;
  unallocated?: number;
  invoices: ApAgingInvoiceDetail[];
}

export interface ApAgingReport {
  asOfDate: string;
  rows: ApAgingVendorRow[];
  totals: {
    current: number;
    days1_30: number;
    days31_60: number;
    days61_90: number;
    days90Plus: number;
    total: number;
  };
}

export interface ApAgingInput {
  companyId: string;
  userId: string;
  asOfDate?: string;
  vendorId?: string;
}

// ---------------------------------------------------------------------------
// AP Aging — ledger-backed
// ---------------------------------------------------------------------------

export class GetLedgerBackedApAgingUseCase {
  constructor(
    private readonly partyRepo: IPartyRepository,
    private readonly purchaseInvoiceRepo: IPurchaseInvoiceRepository,
    private readonly accountStatementUseCase: GetAccountStatementUseCase,
  ) {}

  async execute(input: ApAgingInput): Promise<ApAgingReport> {
    const { companyId, userId, vendorId } = input;
    const asOfDate = input.asOfDate ?? new Date().toISOString().slice(0, 10);
    const epochStart = '1900-01-01';

    const vendors = vendorId
      ? [await this.partyRepo.getById(companyId, vendorId)].filter(Boolean) as any[]
      : await this.partyRepo.list(companyId, { role: 'VENDOR' as any, active: true });

    const withAccounts = vendors.filter((v: any) => v.defaultAPAccountId);

    const byVendor = new Map<string, ApAgingVendorRow>();

    for (const vendor of withAccounts) {
      let ledgerBalance = 0;
      try {
        const stmt = await this.accountStatementUseCase.execute(
          companyId, userId, vendor.defaultAPAccountId, epochStart, asOfDate,
          { includeUnposted: false },
        );
        // AP is credit-normal: negate so positive = amount owed
        ledgerBalance = round2(-(Number(stmt.closingBalanceBase ?? stmt.closingBalance ?? 0)));
      } catch {
        continue;
      }

      if (Math.abs(ledgerBalance) < 0.005) continue;

      const invoices = await this.purchaseInvoiceRepo.list(companyId, {
        status: 'POSTED',
        vendorId: vendor.id,
      });

      const outstanding = invoices.filter(inv => inv.outstandingAmountBase > 0.005);

      const row: ApAgingVendorRow = {
        vendorId: vendor.id,
        vendorName: vendor.displayName || vendor.legalName,
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
          vendorInvoiceNumber: inv.vendorInvoiceNumber,
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
      byVendor.set(vendor.id, row);
    }

    const rows = Array.from(byVendor.values());

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

export type VendorStatementLineType = 'BILL' | 'PAYMENT' | 'DEBIT_NOTE' | 'REFUND' | 'ADJUSTMENT';

export interface VendorStatementLine {
  ledgerEntryId?: string;
  date: string;
  type: VendorStatementLineType;
  reference: string;
  debit: number;
  credit: number;
  runningBalance: number;
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

export interface VendorStatementCommitment {
  sourceType: 'PURCHASE_ORDER';
  sourceId: string;
  documentNumber: string;
  date: string;
  expectedDate?: string;
  status: string;
  amountBase: number;
  openAmountBase: number;
  description?: string;
}

export interface VendorStatement {
  vendorId: string;
  vendorName: string;
  accountId?: string;
  accountCode?: string;
  accountName?: string;
  fromDate: string;
  toDate: string;
  openingBalance: number;
  closingBalance: number;
  lines: VendorStatementLine[];
  totalBilled: number;
  totalPaid: number;
  totalDebited: number;
  totalAdjusted: number;
  openBills: {
    invoiceId: string;
    invoiceNumber: string;
    vendorInvoiceNumber?: string;
    invoiceDate: string;
    dueDate: string | undefined;
    grandTotalBase: number;
    outstandingAmountBase: number;
  }[];
  openCommitments?: VendorStatementCommitment[];
}

export interface VendorStatementInput {
  companyId: string;
  userId?: string;
  vendorId: string;
  fromDate: string;
  toDate: string;
  includeOpenCommitments?: boolean;
}

export class VendorStatementMissingAccountError extends Error {
  readonly code = 'VENDOR_AP_ACCOUNT_MISSING';
  readonly statusCode = 412;

  constructor(vendorId: string) {
    super(
      `Vendor ${vendorId} has no default AP account. Run the vendor account backfill or assign an AP account before generating the statement.`,
    );
    this.name = 'VendorStatementMissingAccountError';
  }
}

export class GetLedgerBackedVendorStatementUseCase {
  constructor(
    private readonly partyRepo: IPartyRepository,
    private readonly purchaseInvoiceRepo: IPurchaseInvoiceRepository,
    private readonly purchaseOrderRepo: IPurchaseOrderRepository,
    private readonly accountStatementUseCase: GetAccountStatementUseCase,
    private readonly getVoucherUseCase: GetVoucherUseCase,
  ) {}

  async execute(input: VendorStatementInput): Promise<VendorStatement> {
    const { companyId, vendorId, fromDate, toDate } = input;
    const userId = input.userId || 'system';

    const party = await this.partyRepo.getById(companyId, vendorId);
    if (!party) {
      throw new Error(`Vendor not found: ${vendorId}`);
    }
    if (!party.defaultAPAccountId) {
      throw new VendorStatementMissingAccountError(vendorId);
    }

    const statement = await this.accountStatementUseCase.execute(
      companyId,
      userId,
      party.defaultAPAccountId,
      fromDate,
      toDate,
      { includeUnposted: false },
    );

    const vouchers = await this.loadVouchers(companyId, statement.entries || [], userId);
    const lines = (statement.entries || []).map((entry) =>
      this.decorateEntry(entry, vouchers.get(entry.voucherId)),
    );

    return {
      vendorId,
      vendorName: party.displayName || party.legalName,
      accountId: statement.accountId,
      accountCode: statement.accountCode,
      accountName: statement.accountName,
      fromDate,
      toDate,
      // AP is a credit-normal account. Convert ledger debit-credit sign into amount-owed sign for party statement UX.
      openingBalance: round2(-(statement.openingBalanceBase ?? statement.openingBalance ?? 0)),
      closingBalance: round2(-(statement.closingBalanceBase ?? statement.closingBalance ?? 0)),
      lines,
      totalBilled: round2(lines.filter((line) => line.type === 'BILL').reduce((sum, line) => sum + line.credit, 0)),
      totalPaid: round2(lines.filter((line) => line.type === 'PAYMENT').reduce((sum, line) => sum + line.debit, 0)),
      totalDebited: round2(lines.filter((line) => line.type === 'DEBIT_NOTE' || line.type === 'REFUND').reduce((sum, line) => sum + line.debit, 0)),
      totalAdjusted: round2(lines.filter((line) => line.type === 'ADJUSTMENT').reduce((sum, line) => sum + line.credit - line.debit, 0)),
      openBills: await this.loadOpenBills(companyId, vendorId),
      openCommitments: input.includeOpenCommitments
        ? await this.loadOpenCommitments(companyId, vendorId)
        : undefined,
    };
  }

  private async loadVouchers(companyId: string, entries: AccountStatementEntry[], userId: string): Promise<Map<string, VoucherEntity>> {
    const voucherIds = [...new Set(entries.map((entry) => entry.voucherId).filter(Boolean))];
    const pairs = await Promise.all(
      voucherIds.map(async (voucherId) => [voucherId, await this.getVoucherUseCase.execute(companyId, userId, voucherId).catch(() => null)] as const),
    );

    const byId = new Map<string, VoucherEntity>();
    for (const [voucherId, voucher] of pairs) {
      if (voucher) byId.set(voucherId, voucher);
    }
    return byId;
  }

  private decorateEntry(entry: AccountStatementEntry, voucher?: VoucherEntity): VendorStatementLine {
    const metadata = voucher?.metadata || {};
    const sourceType =
      metadata.sourceType ||
      metadata.referenceType ||
      (metadata.sourceInvoiceId ? 'PURCHASE_INVOICE' : undefined);
    const sourceId = metadata.sourceId || metadata.referenceId || metadata.sourceInvoiceId;
    const debit = round2(Number(entry.baseDebit ?? entry.debit ?? 0));
    const credit = round2(Number(entry.baseCredit ?? entry.credit ?? 0));

    return {
      ledgerEntryId: entry.id,
      date: entry.date,
      type: this.classifyLine(entry, voucher, sourceType, metadata),
      reference: voucher?.reference || voucher?.voucherNo || entry.voucherNo || entry.voucherId,
      debit,
      credit,
      runningBalance: round2(-Number(entry.baseBalance ?? entry.balance ?? 0)),
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
  ): VendorStatementLineType {
    const debit = Number(entry.baseDebit ?? entry.debit ?? 0);
    const credit = Number(entry.baseCredit ?? entry.credit ?? 0);
    const voucherType = voucher?.type;

    if (sourceType === 'PURCHASE_RETURN') {
      return metadata.voucherPart === 'REFUND' ? 'REFUND' : 'DEBIT_NOTE';
    }
    if (voucherType === VoucherType.PAYMENT || metadata.settlementMode || metadata.sourceInvoiceId) {
      return 'PAYMENT';
    }
    if (sourceType === 'PURCHASE_INVOICE' || voucherType === VoucherType.PURCHASE_INVOICE) {
      return credit >= debit ? 'BILL' : 'PAYMENT';
    }
    return 'ADJUSTMENT';
  }

  private sourceLabel(sourceType?: string, sourceId?: string): string | undefined {
    if (!sourceType || !sourceId) return undefined;
    switch (sourceType) {
      case 'PURCHASE_INVOICE':
        return 'Purchase Invoice';
      case 'PURCHASE_RETURN':
        return 'Purchase Return';
      case 'PURCHASE_ORDER':
        return 'Purchase Order';
      case 'GOODS_RECEIPT':
        return 'Goods Receipt';
      default:
        return sourceType.replace(/_/g, ' ').toLowerCase();
    }
  }

  private async loadOpenBills(companyId: string, vendorId: string): Promise<VendorStatement['openBills']> {
    const invoices = await this.purchaseInvoiceRepo.list(companyId, {
      status: 'POSTED',
      vendorId,
    });

    return invoices
      .filter((invoice) => invoice.outstandingAmountBase > 0.005)
      .map((invoice) => ({
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        vendorInvoiceNumber: invoice.vendorInvoiceNumber,
        invoiceDate: invoice.invoiceDate,
        dueDate: invoice.dueDate,
        grandTotalBase: round2(invoice.grandTotalBase),
        outstandingAmountBase: round2(invoice.outstandingAmountBase),
      }));
  }

  private async loadOpenCommitments(companyId: string, vendorId: string): Promise<VendorStatementCommitment[]> {
    const orders = await this.purchaseOrderRepo.list(companyId, { vendorId });
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
          sourceType: 'PURCHASE_ORDER' as const,
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
