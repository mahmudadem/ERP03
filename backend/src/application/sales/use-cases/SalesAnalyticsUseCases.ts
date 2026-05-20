/**
 * SalesAnalyticsUseCases.ts
 *
 * Read-side reporting use cases for sales analytics.
 * All three use cases operate only on POSTED invoices.
 * Date filtering is inclusive on both bounds; bounds are optional.
 *
 * No writes, no entity mutation, no API routes.
 */

import { ISalesInvoiceRepository } from '../../../repository/interfaces/sales/ISalesInvoiceRepository';
import { ISalespersonRepository } from '../../../repository/interfaces/sales/ISalespersonRepository';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

interface PeriodFilter {
  companyId: string;
  fromDate?: string;
  toDate?: string;
}

/**
 * Returns true when the invoice passes the date filter.
 * String comparison on YYYY-MM-DD is safe and intentional.
 */
function inPeriod(invoiceDate: string, fromDate?: string, toDate?: string): boolean {
  if (fromDate && invoiceDate < fromDate) return false;
  if (toDate && invoiceDate > toDate) return false;
  return true;
}

// ---------------------------------------------------------------------------
// 1. Sales by Customer
// ---------------------------------------------------------------------------

export interface SalesByCustomerRow {
  customerId: string;
  customerName: string;
  invoiceCount: number;
  totalRevenueBase: number; // Σ subtotalBase
  totalTaxBase: number;     // Σ taxTotalBase
  totalGrossBase: number;   // Σ grandTotalBase
}

export interface SalesByCustomerTotals {
  invoiceCount: number;
  totalRevenueBase: number;
  totalTaxBase: number;
  totalGrossBase: number;
}

export interface SalesByCustomerReport {
  fromDate?: string;
  toDate?: string;
  rows: SalesByCustomerRow[];
  totals: SalesByCustomerTotals;
}

export class GetSalesByCustomerUseCase {
  constructor(private readonly salesInvoiceRepo: ISalesInvoiceRepository) {}

  async execute(params: PeriodFilter): Promise<SalesByCustomerReport> {
    const { companyId, fromDate, toDate } = params;

    const allPosted = await this.salesInvoiceRepo.list(companyId, { status: 'POSTED' });

    const filtered = allPosted.filter(inv => inPeriod(inv.invoiceDate, fromDate, toDate));

    // Accumulator keyed by customerId
    const map = new Map<string, {
      customerName: string;
      invoiceCount: number;
      totalRevenueBase: number;
      totalTaxBase: number;
      totalGrossBase: number;
    }>();

    for (const inv of filtered) {
      const existing = map.get(inv.customerId);
      if (existing) {
        existing.invoiceCount += 1;
        existing.totalRevenueBase += inv.subtotalBase;
        existing.totalTaxBase += inv.taxTotalBase;
        existing.totalGrossBase += inv.grandTotalBase;
      } else {
        map.set(inv.customerId, {
          customerName: inv.customerName,
          invoiceCount: 1,
          totalRevenueBase: inv.subtotalBase,
          totalTaxBase: inv.taxTotalBase,
          totalGrossBase: inv.grandTotalBase,
        });
      }
    }

    const rows: SalesByCustomerRow[] = Array.from(map.entries()).map(([customerId, acc]) => ({
      customerId,
      customerName: acc.customerName,
      invoiceCount: acc.invoiceCount,
      totalRevenueBase: round2(acc.totalRevenueBase),
      totalTaxBase: round2(acc.totalTaxBase),
      totalGrossBase: round2(acc.totalGrossBase),
    }));

    rows.sort((a, b) => b.totalRevenueBase - a.totalRevenueBase);

    const totals: SalesByCustomerTotals = {
      invoiceCount: rows.reduce((s, r) => s + r.invoiceCount, 0),
      totalRevenueBase: round2(rows.reduce((s, r) => s + r.totalRevenueBase, 0)),
      totalTaxBase: round2(rows.reduce((s, r) => s + r.totalTaxBase, 0)),
      totalGrossBase: round2(rows.reduce((s, r) => s + r.totalGrossBase, 0)),
    };

    return { fromDate, toDate, rows, totals };
  }
}

// ---------------------------------------------------------------------------
// 2. Sales by Item
// ---------------------------------------------------------------------------

export interface SalesByItemRow {
  itemId: string;
  itemCode: string;
  itemName: string;
  totalQty: number;         // Σ invoicedQty
  totalRevenueBase: number; // Σ lineTotalBase
  lineCount: number;
}

export interface SalesByItemTotals {
  totalQty: number;
  totalRevenueBase: number;
  lineCount: number;
}

export interface SalesByItemReport {
  fromDate?: string;
  toDate?: string;
  rows: SalesByItemRow[];
  totals: SalesByItemTotals;
}

export class GetSalesByItemUseCase {
  constructor(private readonly salesInvoiceRepo: ISalesInvoiceRepository) {}

  async execute(params: PeriodFilter): Promise<SalesByItemReport> {
    const { companyId, fromDate, toDate } = params;

    const allPosted = await this.salesInvoiceRepo.list(companyId, { status: 'POSTED' });

    const filtered = allPosted.filter(inv => inPeriod(inv.invoiceDate, fromDate, toDate));

    // Accumulator keyed by itemId
    const map = new Map<string, {
      itemCode: string;
      itemName: string;
      totalQty: number;
      totalRevenueBase: number;
      lineCount: number;
    }>();

    for (const inv of filtered) {
      for (const line of inv.lines) {
        const existing = map.get(line.itemId);
        if (existing) {
          existing.totalQty += line.invoicedQty;
          existing.totalRevenueBase += line.lineTotalBase;
          existing.lineCount += 1;
        } else {
          map.set(line.itemId, {
            itemCode: line.itemCode,
            itemName: line.itemName,
            totalQty: line.invoicedQty,
            totalRevenueBase: line.lineTotalBase,
            lineCount: 1,
          });
        }
      }
    }

    const rows: SalesByItemRow[] = Array.from(map.entries()).map(([itemId, acc]) => ({
      itemId,
      itemCode: acc.itemCode,
      itemName: acc.itemName,
      totalQty: round2(acc.totalQty),
      totalRevenueBase: round2(acc.totalRevenueBase),
      lineCount: acc.lineCount,
    }));

    rows.sort((a, b) => b.totalRevenueBase - a.totalRevenueBase);

    const totals: SalesByItemTotals = {
      totalQty: round2(rows.reduce((s, r) => s + r.totalQty, 0)),
      totalRevenueBase: round2(rows.reduce((s, r) => s + r.totalRevenueBase, 0)),
      lineCount: rows.reduce((s, r) => s + r.lineCount, 0),
    };

    return { fromDate, toDate, rows, totals };
  }
}

// ---------------------------------------------------------------------------
// 3. Sales by Salesperson
// ---------------------------------------------------------------------------

const UNASSIGNED_ID = 'UNASSIGNED';
const UNASSIGNED_NAME = 'Unassigned';

export interface SalesBySalespersonRow {
  salespersonId: string;
  salespersonName: string;
  invoiceCount: number;
  totalRevenueBase: number; // Σ subtotalBase
  totalGrossBase: number;   // Σ grandTotalBase
}

export interface SalesBySalespersonTotals {
  invoiceCount: number;
  totalRevenueBase: number;
  totalGrossBase: number;
}

export interface SalesBySalespersonReport {
  fromDate?: string;
  toDate?: string;
  rows: SalesBySalespersonRow[];
  totals: SalesBySalespersonTotals;
}

export class GetSalesBySalespersonUseCase {
  constructor(
    private readonly salesInvoiceRepo: ISalesInvoiceRepository,
    private readonly salespersonRepo: ISalespersonRepository,
  ) {}

  async execute(params: PeriodFilter): Promise<SalesBySalespersonReport> {
    const { companyId, fromDate, toDate } = params;

    // Load salespersons once into a lookup map
    const salespersons = await this.salespersonRepo.list(companyId);
    const nameById = new Map<string, string>(salespersons.map(sp => [sp.id, sp.name]));

    const allPosted = await this.salesInvoiceRepo.list(companyId, { status: 'POSTED' });

    const filtered = allPosted.filter(inv => inPeriod(inv.invoiceDate, fromDate, toDate));

    // Accumulator keyed by salespersonId (or UNASSIGNED_ID)
    const map = new Map<string, {
      salespersonName: string;
      invoiceCount: number;
      totalRevenueBase: number;
      totalGrossBase: number;
    }>();

    for (const inv of filtered) {
      const spId = inv.salespersonId ?? UNASSIGNED_ID;
      const spName = spId === UNASSIGNED_ID
        ? UNASSIGNED_NAME
        : (nameById.get(spId) ?? spId);

      const existing = map.get(spId);
      if (existing) {
        existing.invoiceCount += 1;
        existing.totalRevenueBase += inv.subtotalBase;
        existing.totalGrossBase += inv.grandTotalBase;
      } else {
        map.set(spId, {
          salespersonName: spName,
          invoiceCount: 1,
          totalRevenueBase: inv.subtotalBase,
          totalGrossBase: inv.grandTotalBase,
        });
      }
    }

    const rows: SalesBySalespersonRow[] = Array.from(map.entries()).map(([salespersonId, acc]) => ({
      salespersonId,
      salespersonName: acc.salespersonName,
      invoiceCount: acc.invoiceCount,
      totalRevenueBase: round2(acc.totalRevenueBase),
      totalGrossBase: round2(acc.totalGrossBase),
    }));

    rows.sort((a, b) => b.totalRevenueBase - a.totalRevenueBase);

    const totals: SalesBySalespersonTotals = {
      invoiceCount: rows.reduce((s, r) => s + r.invoiceCount, 0),
      totalRevenueBase: round2(rows.reduce((s, r) => s + r.totalRevenueBase, 0)),
      totalGrossBase: round2(rows.reduce((s, r) => s + r.totalGrossBase, 0)),
    };

    return { fromDate, toDate, rows, totals };
  }
}
