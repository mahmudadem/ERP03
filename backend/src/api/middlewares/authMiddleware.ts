/**
 * authMiddleware.ts
 * Purpose: Verifies Firebase ID Tokens.
 */
import { Request, Response, NextFunction } from 'express';
import * as admin from 'firebase-admin';
import { ApiError } from '../errors/ApiError';

// Extend Express Request to include user info
declare global {
  namespace Express {
    interface Request {
      user?: {
        uid: string;
        email?: string;
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
    const decodedToken = await admin.auth().verifyIdToken(token);
    (req as any).user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
    };
    next();
  } catch (error) {
    return next(ApiError.unauthorized('Invalid authentication token'));
  }
};