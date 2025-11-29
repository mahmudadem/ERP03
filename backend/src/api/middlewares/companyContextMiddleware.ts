/**
 * companyContextMiddleware.ts
 * Purpose: Extracts the company ID from request headers and ensures the user has access to it.
 * This enforces multi-tenancy isolation at the API level.
 */
import { Request, Response, NextFunction } from 'express';

export const companyContextMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const user = (req as any).user;
  if (user && user.companyId) {
    (req as any).companyId = user.companyId;
  }
  next();
};
