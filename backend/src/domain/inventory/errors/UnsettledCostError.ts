import { PostingError, ErrorCategory, ErrorViolation } from '../../shared/errors/AppError';

export interface UnsettledCostErrorDetails {
  companyId: string;
  itemId: string;
  lineNo?: number;
  hint?: string;
}

/**
 * Thrown at posting time when a line has no recorded cost basis (the item has
 * never been received OR running average is zero with no last-known cost) AND
 * the company has `inventorySettings.allowDeferredCost === false`.
 *
 * Unlike `NegativeStockError` (which is about quantity going below zero) and
 * `AccountMappingError` (which is about missing account configuration), this
 * error is about missing cost *data*. It is recoverable: post a receipt first
 * to establish a cost, or enable allowDeferredCost in Inventory Settings to
 * permit posting with a deferred-cost flag (`cogsPostingStatus = SKIPPED_UNSETTLED_COST`)
 * that must later be resolved via a settlement/adjustment use case.
 */
export class UnsettledCostError extends PostingError {
  constructor(details: UnsettledCostErrorDetails) {
    const lineHint = details.lineNo !== undefined ? ` (line ${details.lineNo})` : '';
    const advice =
      details.hint ??
      'Receive stock to establish a cost basis, or enable allowDeferredCost in Inventory Settings.';
    const message =
      `Item ${details.itemId}${lineHint} has no recorded cost basis and deferred-cost posting is disabled. ${advice}`;
    const violations: ErrorViolation[] = [
      {
        code: 'UNSETTLED_COST_BLOCKED',
        message,
        fieldHints: [
          `itemId=${details.itemId}`,
          ...(details.lineNo !== undefined ? [`lineNo=${details.lineNo}`] : []),
        ],
        policyId: 'allow-deferred-cost',
      },
    ];
    super({
      code: 'UNSETTLED_COST_BLOCKED',
      message,
      category: ErrorCategory.POLICY,
      details: { violations },
    });
    this.name = 'UnsettledCostError';
  }
}
