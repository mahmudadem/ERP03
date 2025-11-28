
/**
 * inventory.validators.ts
 */
import { ApiError } from '../errors/ApiError';

export const validateCreateItemInput = (body: any) => {
  if (!body.name || !body.code || !body.unit) {
    throw ApiError.badRequest('Missing required fields for Item creation');
  }
};
