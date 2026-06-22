import { PostingError, ErrorCategory, ErrorViolation } from '../../shared/errors/AppError';

export interface PosNegativeStockErrorDetails {
  companyId: string;
  itemId: string;
  warehouseId: string;
  qtyBefore: number;
  requested: number;
  resultingQty: number;
  /** Optional readable labels so the user-facing message names the item instead of a raw id. */
  itemCode?: string;
  itemName?: string;
}

const label = (code?: string, name?: string, fallback?: string): string => {
  if (code && name) return `${code} — ${name}`;
  return code || name || fallback || '';
};

/**
 * POS-specific negative-stock block.
 *
 * Distinct from the inventory-domain `NegativeStockError`: this fires when the
 * **POS** policy (`PosSettings.negativeStockPolicy = 'BLOCK'`) refuses a sale,
 * independent of the company-wide `allowNegativeStock` flag. The message must
 * therefore point at POS Settings — NOT at "enable allowNegativeStock", which
 * may already be on and would not change the POS block.
 */
export class PosNegativeStockError extends PostingError {
  constructor(details: PosNegativeStockErrorDetails) {
    const itemLabel = label(details.itemCode, details.itemName, details.itemId);
    const message =
      `POS cannot sell ${itemLabel}: this would take stock to ${details.resultingQty} ` +
      `(current ${details.qtyBefore}, requested ${details.requested}). ` +
      `POS is set to block sales that drive stock below zero. ` +
      `To allow it, set "Negative stock at the till" to Allow in POS Settings, or receive stock first.`;
    const violations: ErrorViolation[] = [
      {
        code: 'POS_NEGATIVE_STOCK_BLOCKED',
        message,
        fieldHints: [`itemId=${details.itemId}`, `warehouseId=${details.warehouseId}`],
        policyId: 'pos-negative-stock-policy',
      },
    ];
    super({
      code: 'POS_NEGATIVE_STOCK_BLOCKED',
      message,
      category: ErrorCategory.POLICY,
      details: { violations },
      // Structured context so the frontend can render a translated, named message.
      context: {
        itemLabel,
        itemId: details.itemId,
        warehouseId: details.warehouseId,
        current: details.qtyBefore,
        requested: details.requested,
        resulting: details.resultingQty,
        policy: 'BLOCK',
      },
    });
    this.name = 'PosNegativeStockError';
  }
}
