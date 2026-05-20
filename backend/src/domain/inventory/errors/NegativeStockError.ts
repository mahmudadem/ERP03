import { PostingError, ErrorCategory, ErrorViolation } from '../../shared/errors/AppError';

export interface NegativeStockErrorDetails {
  companyId: string;
  itemId: string;
  warehouseId: string;
  qtyBefore: number;
  requested: number;
  resultingQty: number;
}

export class NegativeStockError extends PostingError {
  constructor(details: NegativeStockErrorDetails) {
    const message =
      `Stock OUT would drive item ${details.itemId} (warehouse ${details.warehouseId}) ` +
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
    });
    this.name = 'NegativeStockError';
  }
}
