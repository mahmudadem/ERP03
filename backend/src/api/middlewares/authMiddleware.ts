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
    const activeCompanyId = await diContainer.userRepository.getUserActiveCompany(uid);

    let roleId: string | null = null;
    let permissions: string[] = [];
    let isOwner = false;

    if (activeCompanyId) {
      const membership = await diContainer.rbacCompanyUserRepository.getByUserAndCompany(uid, activeCompanyId);
      if (membership) {
        roleId = membership.roleId;
        isOwner = !!membership.isOwner;
        // Permissions lookup not fully implemented; placeholder empty array
        permissions = [];
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
