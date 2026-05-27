import { GetAccountStatementUseCase } from '../../accounting/use-cases/LedgerUseCases';
import { VoucherEntity } from '../../../domain/accounting/entities/VoucherEntity';
import { VoucherType } from '../../../domain/accounting/types/VoucherTypes';
import { IVoucherRepository } from '../../../domain/accounting/repositories/IVoucherRepository';
import { AccountStatementEntry } from '../../../repository/interfaces/accounting/ILedgerRepository';
import { IPurchaseInvoiceRepository } from '../../../repository/interfaces/purchases/IPurchaseInvoiceRepository';
import { IPurchaseOrderRepository } from '../../../repository/interfaces/purchases/IPurchaseOrderRepository';
import { IPartyRepository } from '../../../repository/interfaces/shared/IPartyRepository';

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

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
    private readonly voucherRepo: IVoucherRepository,
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

    const vouchers = await this.loadVouchers(companyId, statement.entries || []);
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

  private async loadVouchers(companyId: string, entries: AccountStatementEntry[]): Promise<Map<string, VoucherEntity>> {
    const voucherIds = [...new Set(entries.map((entry) => entry.voucherId).filter(Boolean))];
    const pairs = await Promise.all(
      voucherIds.map(async (voucherId) => [voucherId, await this.voucherRepo.findById(companyId, voucherId)] as const),
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
