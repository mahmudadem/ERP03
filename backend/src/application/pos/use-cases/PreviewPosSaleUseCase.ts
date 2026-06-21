import { IItemRepository } from '../../../repository/interfaces/inventory/IItemRepository';
import { ITaxCodeRepository } from '../../../repository/interfaces/shared/ITaxCodeRepository';

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
 * does NOT consume a receipt number. POS is base-currency only in V1.
 */
export class PreviewPosSaleUseCase {
  constructor(
    private readonly itemRepo: IItemRepository,
    private readonly taxCodeRepo: ITaxCodeRepository
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
      if (taxCodeId) {
        const tc = await this.taxCodeRepo.getById(input.companyId, taxCodeId);
        if (tc && tc.active && (tc.scope === 'SALES' || tc.scope === 'BOTH')) {
          taxRate = tc.rate;
          priceIsInclusive = tc.priceIsInclusive === true;
        }
      }

      const amounts = calculatePosLineAmounts({
        qty: l.qty,
        unitPrice: l.unitPrice,
        taxRate,
        priceIsInclusive,
        discountType: l.discountType,
        discountValue: l.discountValue,
      });

      calcLines.push({
        lineTotalBase: amounts.lineTotalBase,
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

    const totals = calculatePosTotals(calcLines);
    return {
      subtotal: totals.subtotalBase,
      taxTotal: totals.taxTotalBase,
      grandTotal: totals.grandTotalBase,
      lines: outLines,
    };
  }
}

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

function calculatePosLineAmounts(input: {
  qty: number;
  unitPrice: number;
  taxRate: number;
  priceIsInclusive: boolean;
  discountType?: 'PERCENT' | 'AMOUNT';
  discountValue?: number;
}): { lineTotalBase: number; taxAmountBase: number } {
  const gross = round2(input.qty * input.unitPrice);
  const discount = input.discountType === 'PERCENT'
    ? round2(gross * ((input.discountValue || 0) / 100))
    : round2(input.discountValue || 0);
  const afterDiscount = round2(gross - discount);
  if (input.priceIsInclusive && input.taxRate > 0) {
    const lineTotalBase = round2(afterDiscount / (1 + input.taxRate));
    return { lineTotalBase, taxAmountBase: round2(afterDiscount - lineTotalBase) };
  }
  return { lineTotalBase: afterDiscount, taxAmountBase: round2(afterDiscount * input.taxRate) };
}

function calculatePosTotals(lines: Array<{ lineTotalBase: number; taxAmountBase: number }>): {
  subtotalBase: number;
  taxTotalBase: number;
  grandTotalBase: number;
} {
  const subtotalBase = round2(lines.reduce((sum, line) => sum + line.lineTotalBase, 0));
  const taxTotalBase = round2(lines.reduce((sum, line) => sum + line.taxAmountBase, 0));
  return { subtotalBase, taxTotalBase, grandTotalBase: round2(subtotalBase + taxTotalBase) };
}
