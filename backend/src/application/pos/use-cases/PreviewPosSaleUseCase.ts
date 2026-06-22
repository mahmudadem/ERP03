import { IItemRepository } from '../../../repository/interfaces/inventory/IItemRepository';
import { ITaxCodeRepository } from '../../../repository/interfaces/shared/ITaxCodeRepository';
import { ITaxEngine } from '../../system-core';
import { roundMoney } from '../../system-core/money/roundMoney';

export interface PreviewPosSaleLine {
  itemId: string;
  qty: number;
  unitPrice: number;
  discountType?: 'PERCENT' | 'AMOUNT';
  discountValue?: number;
  taxCodeId?: string;
  manualTaxAmount?: number;
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
    taxCodeId?: string;
    taxCodeName?: string;
    taxRate: number;
    priceIsInclusive: boolean;
  }>;
}

/**
 * Calculation-only quote for the cashier screen. It does NOT persist anything and
 * does NOT consume a receipt number. POS is base-currency only in V1.
 */
export class PreviewPosSaleUseCase {
  constructor(
    private readonly itemRepo: IItemRepository,
    private readonly taxCodeRepo: ITaxCodeRepository,
    private readonly taxEngine: ITaxEngine
  ) {}

  async execute(input: PreviewPosSaleInput): Promise<PreviewPosSaleResult> {
    const calcLines: Array<{ lineTotalBase: number; taxAmountBase: number }> = [];
    const outLines: PreviewPosSaleResult['lines'] = [];

    for (const l of input.lines) {
      const item = await this.itemRepo.getItem(l.itemId);
      if (!item || item.companyId !== input.companyId) {
        throw new Error(`Item not found: ${l.itemId}`);
      }

      const taxCodeId = l.taxCodeId || item.defaultSalesTaxCodeId;
      let taxRate = 0;
      let priceIsInclusive = false;
      let taxCodeName: string | undefined;
      let resolvedTaxCodeId: string | undefined;
      if (taxCodeId) {
        const tc = await this.taxCodeRepo.getById(input.companyId, taxCodeId);
        if (tc && tc.active && (tc.scope === 'SALES' || tc.scope === 'BOTH')) {
          resolvedTaxCodeId = tc.id;
          taxCodeName = `${tc.code} - ${tc.name}`;
          taxRate = tc.rate;
          priceIsInclusive = tc.priceIsInclusive === true;
        }
      }

      const amounts = this.taxEngine.calcLine({
        quantity: l.qty,
        unitPriceDoc: l.unitPrice,
        exchangeRate: 1,
        taxRate,
        priceIsInclusive,
        discountType: l.discountType,
        discountValue: l.discountValue,
        currency: 'USD',
      });

      const taxAmountBase = l.manualTaxAmount === undefined
        ? amounts.taxAmountBase
        : roundMoney(Math.max(0, Number(l.manualTaxAmount) || 0));

      calcLines.push({
        lineTotalBase: amounts.lineTotalBase,
        taxAmountBase,
      });
      outLines.push({
        itemId: item.id,
        itemName: item.name,
        qty: l.qty,
        unitPrice: l.unitPrice,
        lineTotal: amounts.lineTotalBase,
        taxAmount: taxAmountBase,
        taxCodeId: resolvedTaxCodeId,
        taxCodeName,
        taxRate,
        priceIsInclusive,
      });
    }

    const totals = calculatePosTotals(calcLines);
    return {
      subtotal: totals.subtotalBase,
      taxTotal: totals.taxTotalBase,
      grandTotal: totals.grandTotalBase,
      lines: outLines,
    };
  }
}

function calculatePosTotals(lines: Array<{ lineTotalBase: number; taxAmountBase: number }>): {
  subtotalBase: number;
  taxTotalBase: number;
  grandTotalBase: number;
} {
  const subtotalBase = roundMoney(lines.reduce((sum, line) => sum + line.lineTotalBase, 0));
  const taxTotalBase = roundMoney(lines.reduce((sum, line) => sum + line.taxAmountBase, 0));
  return { subtotalBase, taxTotalBase, grandTotalBase: roundMoney(subtotalBase + taxTotalBase) };
}
