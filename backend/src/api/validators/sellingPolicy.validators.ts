/**
 * sellingPolicy.validators.ts — request validation for the shared company-wide
 * SellingPolicy (below-cost / minimum-margin).
 *
 * Lives in a neutral location (not under sales or pos) because the same policy is
 * edited from BOTH the Sales Settings and POS Settings doorways. Keeping it here
 * means neither module's controller has to import the other's validators — POS
 * stays independent of Sales.
 */
import { ApiError } from '../errors/ApiError';

const BELOW_COST_MODES = ['BLOCK', 'REQUIRE_APPROVAL', 'ALLOW'];

export const validateUpdateSellingPolicyInput = (body: any): void => {
  if (!body || typeof body !== 'object') throw ApiError.badRequest('Request body is required');
  if (body.belowCostMode !== undefined && !BELOW_COST_MODES.includes(body.belowCostMode)) {
    throw ApiError.badRequest(`belowCostMode must be one of: ${BELOW_COST_MODES.join(', ')}`);
  }
  if (body.allowManagerOverride !== undefined && typeof body.allowManagerOverride !== 'boolean') {
    throw ApiError.badRequest('allowManagerOverride must be a boolean');
  }
  if (body.minMarginPercent !== undefined && body.minMarginPercent !== null && body.minMarginPercent !== '') {
    const n = Number(body.minMarginPercent);
    if (!Number.isFinite(n) || n < 0) {
      throw ApiError.badRequest('minMarginPercent must be a number greater than or equal to zero');
    }
  }
};
