/**
 * pos.validators.ts — Lightweight request-body validators for the POS API.
 * These mirror the style of sales.validators.ts (throw with a readable message).
 */

const VALID_METHOD_CODES = ['CASH', 'CARD', 'BANK_TRANSFER', 'CUSTOM'] as const;
const VALID_ROUNDING = ['none', 'nearest_05', 'nearest_1'] as const;
const VALID_REGISTER_STATUS = ['ACTIVE', 'INACTIVE'] as const;

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
  if (body.status !== undefined && !VALID_REGISTER_STATUS.includes(body.status)) {
    throw new Error(`status must be one of: ${VALID_REGISTER_STATUS.join(', ')}`);
  }
}

export function validateUpdatePosSettingsInput(body: any): void {
  if (!body || typeof body !== 'object') throw new Error('Request body is required');
  if (body.cashRounding !== undefined && !VALID_ROUNDING.includes(body.cashRounding)) {
    throw new Error(`cashRounding must be one of: ${VALID_ROUNDING.join(', ')}`);
  }
  if (body.paymentMethods !== undefined) {
    if (!Array.isArray(body.paymentMethods)) throw new Error('paymentMethods must be an array');
    for (const m of body.paymentMethods) {
      if (!VALID_METHOD_CODES.includes(m?.code)) {
        throw new Error(`paymentMethods[].code must be one of: ${VALID_METHOD_CODES.join(', ')}`);
      }
      if (m.isEnabled === true && (!m.settlementAccountId || !String(m.settlementAccountId).trim())) {
        throw new Error(`paymentMethods[].settlementAccountId is required when isEnabled is true`);
      }
    }
  }
  // Unused-but-typed access to keep the linter quiet about unused fields.
  void optionalString; void optionalNumber; void optionalBoolean;
}
