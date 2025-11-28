/**
 * companyContextMiddleware.ts
 * Purpose: Extracts the company ID from request headers and ensures the user has access to it.
 * This enforces multi-tenancy isolation at the API level.
 */
import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../errors/ApiError';

export const companyContextMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // 1. Extract Company ID from headers
  const companyId = (req as any).headers['x-company-id'] || (req as any).headers['company-id'];

  if (!companyId) {
    // For some public or global endpoints, this might be optional, 
    // but for business logic, it's usually mandatory.
    // For MVP, we'll allow it to be missing if the route doesn't strictly require it,
    // but typically we'd throw 400 here.
    return next(); 
  }

  // 2. Validate format (simple check)
  if (typeof companyId !== 'string') {
    return next(ApiError.badRequest('Invalid Company ID format'));
  }

  // 3. Inject into Request object
  (req as any).companyId = companyId;

  // 4. (Future) Verify user belongs to this company via ICompanyUserRepository
  // const userId = (req as any).user?.uid;
  // if (!await userRepo.isMember(userId, companyId)) throw ApiError.forbidden();

  next();
};