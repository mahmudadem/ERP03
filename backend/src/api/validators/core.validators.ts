
/**
 * core.validators.ts
 * Purpose: Validates input payloads for Core API endpoints.
 */
import { ApiError } from '../errors/ApiError';

export const validateCreateCompanyInput = (body: any) => {
  const { name, taxId } = body;
  
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    throw ApiError.badRequest('Company name is required and must be a string.');
  }

  if (!taxId || typeof taxId !== 'string' || taxId.trim().length === 0) {
    throw ApiError.badRequest('Tax ID is required.');
  }

  // Optional fields validation if needed
  if (body.address && typeof body.address !== 'string') {
    throw ApiError.badRequest('Address must be a string.');
  }
};
