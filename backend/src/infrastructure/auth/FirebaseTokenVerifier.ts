/**
 * FirebaseTokenVerifier.ts
 * 
 * Purpose: Firebase-specific implementation of ITokenVerifier.
 * Uses Firebase Admin SDK to verify ID tokens.
 */

import admin from '../../firebaseAdmin';
import { ITokenVerifier, DecodedToken } from '../../application/auth/interfaces/ITokenVerifier';

export class FirebaseTokenVerifier implements ITokenVerifier {
  /**
   * Verifies a Firebase ID token and returns a normalized DecodedToken.
   * 
   * @param token - Firebase ID token from the client
   * @returns Normalized decoded token payload
   * @throws Error if token is invalid, expired, or revoked
   */
  async verify(token: string): Promise<DecodedToken> {
    const decoded = await admin.auth().verifyIdToken(token);
    
    return {
      uid: decoded.uid,
      email: decoded.email,
      emailVerified: decoded.email_verified,
      name: decoded.name,
      picture: decoded.picture,
      iat: decoded.iat,
      exp: decoded.exp,
      claims: {
        // Preserve Firebase-specific claims that might be needed
        firebase: decoded.firebase,
        // Include any custom claims
        ...Object.fromEntries(
          Object.entries(decoded).filter(([key]) => 
            !['uid', 'email', 'email_verified', 'name', 'picture', 'iat', 'exp', 'aud', 'iss', 'sub', 'auth_time', 'firebase'].includes(key)
          )
        ),
      },
    };
  }
}
