/**
 * authMiddleware.ts
 * 
 * Purpose: Verifies authentication tokens using the ITokenVerifier abstraction.
 * This middleware is provider-agnostic and works with any identity provider
 * that implements the ITokenVerifier interface.
 */
import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../errors/ApiError';
import { diContainer } from '../../infrastructure/di/bindRepositories';

// Extend Express Request to include user info
declare global {
  namespace Express {
    interface Request {
      user?: {
        uid: string;
        email?: string;
        companyId?: string | null;
        roleId?: string | null;
        permissions?: string[];
        isOwner?: boolean;
        isSuperAdmin?: boolean;
      };
    }
  }
}

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = (req as any).headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(ApiError.unauthorized('Missing or invalid Authorization header'));
  }

  const token = authHeader.split('Bearer ')[1];

  try {
    // Use the token verifier from DI container (provider-agnostic)
    const decodedToken = await diContainer.tokenVerifier.verify(token);
    const uid = decodedToken.uid;
    
    const userEntity = await diContainer.userRepository.getUserById(uid);
    console.log(`[authMiddleware] uid=${uid}, userEntity found=${!!userEntity}, isAdmin=${userEntity?.isAdmin()}`);
    // Check for explicit company context header
    const headerCompanyId = req.headers['x-company-id'] as string;
    
    // Fallback to stored active company if header is missing
    const userStoredActiveCompany = await diContainer.userRepository.getUserActiveCompany(uid);
    let activeCompanyId = headerCompanyId || userStoredActiveCompany;

    let roleId: string | null = null;
    let permissions: string[] = [];
    let isOwner = false;

    if (activeCompanyId) {
      // Validate user belongs to this company (basic check)
      const membership = await diContainer.rbacCompanyUserRepository.getByUserAndCompany(uid, activeCompanyId);
      if (membership) {
        roleId = membership.roleId;
        isOwner = !!membership.isOwner;
        // Permissions lookup not fully implemented; placeholder empty array
        permissions = [];
      } else if (!userEntity?.isAdmin()) {
        // Tenant context is security-critical. Never let a caller-selected or stale
        // company id continue unless the user has an explicit company membership.
        if (headerCompanyId) {
          console.warn(`User ${uid} attempted to access company ${headerCompanyId} without membership.`);
          return next(ApiError.forbidden('Company access denied', 'COMPANY_ACCESS_DENIED'));
        }
        activeCompanyId = null;
      }
    }

    (req as any).user = {
      uid,
      email: decodedToken.email,
      companyId: activeCompanyId || null,
      roleId,
      permissions,
      isOwner,
      isSuperAdmin: userEntity?.isAdmin() || false,
    };
    next();
  } catch (error) {
    return next(ApiError.unauthorized('Invalid authentication token'));
  }
};
