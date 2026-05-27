import { IPurchaseInvoiceRepository } from '../../../repository/interfaces/purchases/IPurchaseInvoiceRepository';

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

interface PeriodFilter {
  companyId: string;
  fromDate?: string;
  toDate?: string;
}

function inPeriod(invoiceDate: string, fromDate?: string, toDate?: string): boolean {
  if (fromDate && invoiceDate < fromDate) return false;
  if (toDate && invoiceDate > toDate) return false;
  return true;
}

// ---------------------------------------------------------------------------
// 1. Purchases by Vendor
// ---------------------------------------------------------------------------

export interface PurchasesByVendorRow {
  vendorId: string;
  vendorName: string;
  invoiceCount: number;
  totalCostBase: number;
  totalTaxBase: number;
  totalGrossBase: number;
}

export interface PurchasesByVendorTotals {
  invoiceCount: number;
  totalCostBase: number;
  totalTaxBase: number;
  totalGrossBase: number;
}

export interface PurchasesByVendorReport {
  fromDate?: string;
  toDate?: string;
  rows: PurchasesByVendorRow[];
  totals: PurchasesByVendorTotals;
}

export class GetPurchasesByVendorUseCase {
  constructor(private readonly purchaseInvoiceRepo: IPurchaseInvoiceRepository) {}

  async execute(params: PeriodFilter): Promise<PurchasesByVendorReport> {
    const { companyId, fromDate, toDate } = params;

    const allPosted = await this.purchaseInvoiceRepo.list(companyId, { status: 'POSTED' });
    const filtered = allPosted.filter(inv => inPeriod(inv.invoiceDate, fromDate, toDate));

    const map = new Map<string, {
      vendorName: string;
      invoiceCount: number;
      totalCostBase: number;
      totalTaxBase: number;
      totalGrossBase: number;
    }>();

    for (const inv of filtered) {
      const existing = map.get(inv.vendorId);
      if (existing) {
        existing.invoiceCount += 1;
        existing.totalCostBase += inv.subtotalBase;
        existing.totalTaxBase += inv.taxTotalBase;
        existing.totalGrossBase += inv.grandTotalBase;
      } else {
        map.set(inv.vendorId, {
          vendorName: inv.vendorName,
          invoiceCount: 1,
          totalCostBase: inv.subtotalBase,
          totalTaxBase: inv.taxTotalBase,
          totalGrossBase: inv.grandTotalBase,
        });
      }
    }

    const rows: PurchasesByVendorRow[] = Array.from(map.entries()).map(([vendorId, acc]) => ({
      vendorId,
      vendorName: acc.vendorName,
      invoiceCount: acc.invoiceCount,
      totalCostBase: round2(acc.totalCostBase),
      totalTaxBase: round2(acc.totalTaxBase),
      totalGrossBase: round2(acc.totalGrossBase),
    }));

    rows.sort((a, b) => b.totalCostBase - a.totalCostBase);

    const totals: PurchasesByVendorTotals = {
      invoiceCount: rows.reduce((s, r) => s + r.invoiceCount, 0),
      totalCostBase: round2(rows.reduce((s, r) => s + r.totalCostBase, 0)),
      totalTaxBase: round2(rows.reduce((s, r) => s + r.totalTaxBase, 0)),
      totalGrossBase: round2(rows.reduce((s, r) => s + r.totalGrossBase, 0)),
    };

    return { fromDate, toDate, rows, totals };
  }
}

// ---------------------------------------------------------------------------
// 2. Purchases by Item
// ---------------------------------------------------------------------------

export interface PurchasesByItemRow {
  itemId: string;
  itemCode: string;
  itemName: string;
  totalQty: number;
  totalCostBase: number;
  lineCount: number;
}

export interface PurchasesByItemTotals {
  totalQty: number;
  totalCostBase: number;
  lineCount: number;
}

export interface PurchasesByItemReport {
  fromDate?: string;
  toDate?: string;
  rows: PurchasesByItemRow[];
  totals: PurchasesByItemTotals;
}

export class GetPurchasesByItemUseCase {
  constructor(private readonly purchaseInvoiceRepo: IPurchaseInvoiceRepository) {}

  async execute(params: PeriodFilter): Promise<PurchasesByItemReport> {
    const { companyId, fromDate, toDate } = params;

    const allPosted = await this.purchaseInvoiceRepo.list(companyId, { status: 'POSTED' });
    const filtered = allPosted.filter(inv => inPeriod(inv.invoiceDate, fromDate, toDate));

    const map = new Map<string, {
      itemCode: string;
      itemName: string;
      totalQty: number;
      totalCostBase: number;
      lineCount: number;
    }>();

    for (const inv of filtered) {
      for (const line of inv.lines) {
        const existing = map.get(line.itemId);
        if (existing) {
          existing.totalQty += line.invoicedQty;
          existing.totalCostBase += line.lineTotalBase;
          existing.lineCount += 1;
        } else {
          map.set(line.itemId, {
            itemCode: line.itemCode,
            itemName: line.itemName,
            totalQty: line.invoicedQty,
            totalCostBase: line.lineTotalBase,
            lineCount: 1,
          });
        }
      }
    }

    const rows: PurchasesByItemRow[] = Array.from(map.entries()).map(([itemId, acc]) => ({
      itemId,
      itemCode: acc.itemCode,
      itemName: acc.itemName,
      totalQty: round2(acc.totalQty),
      totalCostBase: round2(acc.totalCostBase),
      lineCount: acc.lineCount,
    }));

    rows.sort((a, b) => b.totalCostBase - a.totalCostBase);

    const totals: PurchasesByItemTotals = {
      totalQty: round2(rows.reduce((s, r) => s + r.totalQty, 0)),
      totalCostBase: round2(rows.reduce((s, r) => s + r.totalCostBase, 0)),
      lineCount: rows.reduce((s, r) => s + r.lineCount, 0),
    };

    return { fromDate, toDate, rows, totals };
  }
}
