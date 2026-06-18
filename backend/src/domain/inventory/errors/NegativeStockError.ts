import { PostingError, ErrorCategory, ErrorViolation } from '../../shared/errors/AppError';

export interface NegativeStockErrorDetails {
  companyId: string;
  itemId: string;
  warehouseId: string;
  qtyBefore: number;
  requested: number;
  resultingQty: number;
  /** Optional readable labels so the user-facing message names the item/warehouse instead of raw ids. */
  itemCode?: string;
  itemName?: string;
  warehouseCode?: string;
  warehouseName?: string;
}

const label = (code?: string, name?: string, fallback?: string): string => {
  if (code && name) return `${code} — ${name}`;
  return code || name || fallback || '';
};

export class NegativeStockError extends PostingError {
  constructor(details: NegativeStockErrorDetails) {
    const itemLabel = label(details.itemCode, details.itemName, details.itemId);
    const warehouseLabel = label(details.warehouseCode, details.warehouseName, details.warehouseId);
    const message =
      `Stock OUT would drive ${itemLabel} (warehouse ${warehouseLabel}) ` +
      `to ${details.resultingQty} (current ${details.qtyBefore}, requested ${details.requested}). ` +
      `Negative stock is disabled for this company. ` +
      `Enable allowNegativeStock in Inventory Settings or post a stock receipt first.`;
    const violations: ErrorViolation[] = [
      {
        code: 'NEGATIVE_STOCK_BLOCKED',
        message,
        fieldHints: [`itemId=${details.itemId}`, `warehouseId=${details.warehouseId}`],
        policyId: 'allow-negative-stock',
      },
    ];
    super({
      code: 'NEGATIVE_STOCK_BLOCKED',
      message,
      category: ErrorCategory.POLICY,
      details: { violations },
      // Readable, structured context so the frontend can render a translated, named message.
      context: {
        itemLabel,
        warehouseLabel,
        itemId: details.itemId,
        warehouseId: details.warehouseId,
        current: details.qtyBefore,
        requested: details.requested,
        resulting: details.resultingQty,
      },
    });
    this.name = 'NegativeStockError';
  }
}
