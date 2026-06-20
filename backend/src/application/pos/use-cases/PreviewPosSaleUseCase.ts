import { IItemRepository } from '../../../repository/interfaces/inventory/IItemRepository';
import { ITaxCodeRepository } from '../../../repository/interfaces/shared/ITaxCodeRepository';
import {
  calculateSalesInvoiceLineAmounts,
  calculateSalesInvoiceTotals,
} from '../../sales/services/SalesInvoiceCalculationService';

export interface PreviewPosSaleLine {
  itemId: string;
  qty: number;
  unitPrice: number;
  discountType?: 'PERCENT' | 'AMOUNT';
  discountValue?: number;
  taxCodeId?: string;
}

export interface PreviewPosSaleInput {
  companyId: string;
  lines: PreviewPosSaleLine[];
}

export interface PreviewPosSaleResult {
  subtotal: number;
  taxTotal: number;
  grandTotal: number;
  lines: Array<{
    itemId: string;
    itemName: string;
    qty: number;
    unitPrice: number;
    lineTotal: number;
    taxAmount: number;
  }>;
}

/**
 * Calculation-only quote for the cashier screen. It does NOT persist anything and
 * does NOT consume an invoice number. It REUSES the exact same calculation service
 * (`calculateSalesInvoiceLineAmounts` / `calculateSalesInvoiceTotals`) that
 * `CreateSalesInvoiceUseCase` uses, so the previewed tax-inclusive total matches the
 * total the Sales module will post. POS is base-currency only, so exchangeRate = 1.
 *
 * The Sales Invoice remains the source of truth at completion time; this is for display.
 */
export class PreviewPosSaleUseCase {
  constructor(
    private readonly itemRepo: IItemRepository,
    private readonly taxCodeRepo: ITaxCodeRepository
  ) {}

  async execute(input: PreviewPosSaleInput): Promise<PreviewPosSaleResult> {
    const exchangeRate = 1;
    const calcLines: Array<{ lineTotalDoc: number; lineTotalBase: number; taxAmountDoc: number; taxAmountBase: number }> = [];
    const outLines: PreviewPosSaleResult['lines'] = [];

    for (const l of input.lines) {
      const item = await this.itemRepo.getItem(l.itemId);
      if (!item || item.companyId !== input.companyId) {
        throw new Error(`Item not found: ${l.itemId}`);
      }

      const taxCodeId = l.taxCodeId || item.defaultSalesTaxCodeId;
      let taxRate = 0;
      let priceIsInclusive = false;
      if (taxCodeId) {
        const tc = await this.taxCodeRepo.getById(input.companyId, taxCodeId);
        if (tc && tc.active && (tc.scope === 'SALES' || tc.scope === 'BOTH')) {
          taxRate = tc.rate;
          priceIsInclusive = tc.priceIsInclusive === true;
        }
      }

      const amounts = calculateSalesInvoiceLineAmounts({
        invoicedQty: l.qty,
        unitPriceDoc: l.unitPrice,
        exchangeRate,
        taxRate,
        priceIsInclusive,
        discountType: l.discountType,
        discountValue: l.discountValue,
      });

      calcLines.push({
        lineTotalDoc: amounts.lineTotalDoc,
        lineTotalBase: amounts.lineTotalBase,
        taxAmountDoc: amounts.taxAmountDoc,
        taxAmountBase: amounts.taxAmountBase,
      });
      outLines.push({
        itemId: item.id,
        itemName: item.name,
        qty: l.qty,
        unitPrice: l.unitPrice,
        lineTotal: amounts.lineTotalBase,
        taxAmount: amounts.taxAmountBase,
      });
    }

    const totals = calculateSalesInvoiceTotals(calcLines as any, []);
    return {
      subtotal: totals.subtotalBase,
      taxTotal: totals.taxTotalBase,
      grandTotal: totals.grandTotalBase,
      lines: outLines,
    };
  }
}
