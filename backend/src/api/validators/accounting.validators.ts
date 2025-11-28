
/**
 * accounting.validators.ts
 */
import { ApiError } from '../errors/ApiError';

export const validateCreateAccountInput = (body: any) => {
  if (!body.code || !body.name || !body.type || !body.currency) {
    throw ApiError.badRequest('Missing required fields for Account creation');
  }
};

export const validateCreateVoucherInput = (body: any) => {
  if (!body.type || !body.currency || !body.companyId) {
    throw ApiError.badRequest('Missing required fields (type, currency, companyId)');
  }
  if (!body.date) {
    throw ApiError.badRequest('Date is required');
  }
  if (!Array.isArray(body.lines)) {
    throw ApiError.badRequest('Lines must be an array');
  }
  // Basic line validation
  body.lines.forEach((line: any, idx: number) => {
    if (!line.accountId) throw ApiError.badRequest(`Line ${idx + 1} missing accountId`);
    if (typeof line.fxAmount !== 'number') throw ApiError.badRequest(`Line ${idx + 1} invalid amount`);
  });
};
