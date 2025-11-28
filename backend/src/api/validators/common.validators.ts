
/**
 * common.validators.ts
 */
import { ApiError } from '../errors/ApiError';

export const validateIdParam = (req: any) => {
  if (!req.params.id) {
    throw ApiError.badRequest('ID parameter is required');
  }
};
