/**
 * pos.validators.ts — Lightweight request-body validators for the POS API.
 * These mirror the style of sales.validators.ts (throw with a readable message).
 */

const VALID_METHOD_CODES = ['CASH', 'CARD', 'BANK_TRANSFER', 'CUSTOM'] as const;
const VALID_ROUNDING = ['none', 'nearest_05', 'nearest_1'] as const;
const VALID_NEGATIVE_STOCK_POLICIES = ['BLOCK', 'ALLOW'] as const;
const VALID_REGISTER_STATUS = ['ACTIVE', 'INACTIVE'] as const;
const VALID_MANAGER_OVERRIDE_ACTIONS = ['VOID_LINE', 'PRICE_OVERRIDE', 'DISCOUNT_OVERRIDE', 'TAX_OVERRIDE', 'RETURN', 'REPRINT'] as const;

function requireString(value: any, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${field} is required`);
  }
  return value.trim();
}

function optionalString(value: any, field: string): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') throw new Error(`${field} must be a string`);
  return value.trim() || undefined;
}

function optionalNumber(value: any, field: string): number | undefined {
  if (value === undefined || value === null) return undefined;
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error(`${field} must be a number`);
  return n;
}

function optionalBoolean(value: any, field: string): boolean | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'boolean') throw new Error(`${field} must be a boolean`);
  return value;
}

export function validateUpsertPosRegisterInput(body: any): void {
  if (!body || typeof body !== 'object') throw new Error('Request body is required');
  requireString(body.code, 'code');
  requireString(body.name, 'name');
  requireString(body.warehouseId, 'warehouseId');
  requireString(body.cashDrawerAccountId, 'cashDrawerAccountId');
  if (body.branchId !== undefined && body.branchId !== null) {
    if (typeof body.branchId !== 'string') throw new Error('branchId must be a string');
  }
  if (body.defaultPriceListId !== undefined && body.defaultPriceListId !== null && typeof body.defaultPriceListId !== 'string') {
    throw new Error('defaultPriceListId must be a string');
  }
  if (body.hardwareProfileId !== undefined && body.hardwareProfileId !== null && typeof body.hardwareProfileId !== 'string') {
    throw new Error('hardwareProfileId must be a string');
  }
  if (body.allowedCashierUserIds !== undefined) {
    if (!Array.isArray(body.allowedCashierUserIds)) throw new Error('allowedCashierUserIds must be an array');
    for (const userId of body.allowedCashierUserIds) {
      if (typeof userId !== 'string') throw new Error('allowedCashierUserIds must contain only strings');
    }
  }
  if (body.status !== undefined && !VALID_REGISTER_STATUS.includes(body.status)) {
    throw new Error(`status must be one of: ${VALID_REGISTER_STATUS.join(', ')}`);
  }
  if (body.settlementAccountIds !== undefined) {
    if (!body.settlementAccountIds || typeof body.settlementAccountIds !== 'object' || Array.isArray(body.settlementAccountIds)) {
      throw new Error('settlementAccountIds must be an object');
    }
    for (const [method, accountId] of Object.entries(body.settlementAccountIds)) {
      if (!VALID_METHOD_CODES.includes(method as any)) {
        throw new Error(`settlementAccountIds key must be one of: ${VALID_METHOD_CODES.join(', ')}`);
      }
      if (accountId !== undefined && accountId !== null && typeof accountId !== 'string') {
        throw new Error(`settlementAccountIds.${method} must be a string`);
      }
    }
  }
}

export function validateUpdatePosSettingsInput(body: any): void {
  if (!body || typeof body !== 'object') throw new Error('Request body is required');
  if (body.cashRounding !== undefined && !VALID_ROUNDING.includes(body.cashRounding)) {
    throw new Error(`cashRounding must be one of: ${VALID_ROUNDING.join(', ')}`);
  }
  if (body.negativeStockPolicy !== undefined && !VALID_NEGATIVE_STOCK_POLICIES.includes(body.negativeStockPolicy)) {
    throw new Error(`negativeStockPolicy must be one of: ${VALID_NEGATIVE_STOCK_POLICIES.join(', ')}`);
  }
  if (body.paymentMethods !== undefined) {
    if (!Array.isArray(body.paymentMethods)) throw new Error('paymentMethods must be an array');
    for (const m of body.paymentMethods) {
      if (!VALID_METHOD_CODES.includes(m?.code)) {
        throw new Error(`paymentMethods[].code must be one of: ${VALID_METHOD_CODES.join(', ')}`);
      }
      // Account assignment is register-level. POS Settings only controls method behavior.
    }
  }
  // Unused-but-typed access to keep the linter quiet about unused fields.
  void optionalString; void optionalNumber; void optionalBoolean;
}

export function validateUpdatePosPolicyInput(body: any): void {
  if (!body || typeof body !== 'object') throw new Error('Request body is required');
  if (body.cashierRolePolicies === undefined) return;
  if (!Array.isArray(body.cashierRolePolicies)) throw new Error('cashierRolePolicies must be an array');
  for (const policy of body.cashierRolePolicies) {
    requireString(policy?.roleId, 'cashierRolePolicies[].roleId');
    optionalBoolean(policy.requireApprovalForDirectSales, 'cashierRolePolicies[].requireApprovalForDirectSales');
    optionalBoolean(policy.allowPriceOverride, 'cashierRolePolicies[].allowPriceOverride');
    optionalBoolean(policy.allowTaxOverride, 'cashierRolePolicies[].allowTaxOverride');
    const maxPercent = optionalNumber(policy.maxLineDiscountPercent, 'cashierRolePolicies[].maxLineDiscountPercent');
    const maxAmount = optionalNumber(policy.maxLineDiscountAmount, 'cashierRolePolicies[].maxLineDiscountAmount');
    if (maxPercent !== undefined && maxPercent < 0) throw new Error('cashierRolePolicies[].maxLineDiscountPercent must be zero or greater');
    if (maxAmount !== undefined && maxAmount < 0) throw new Error('cashierRolePolicies[].maxLineDiscountAmount must be zero or greater');
    if (policy.managerOverrideActions !== undefined) {
      if (!Array.isArray(policy.managerOverrideActions)) throw new Error('cashierRolePolicies[].managerOverrideActions must be an array');
      for (const action of policy.managerOverrideActions) {
        if (!VALID_MANAGER_OVERRIDE_ACTIONS.includes(action)) {
          throw new Error(`cashierRolePolicies[].managerOverrideActions must contain only: ${VALID_MANAGER_OVERRIDE_ACTIONS.join(', ')}`);
        }
      }
    }
  }
}
