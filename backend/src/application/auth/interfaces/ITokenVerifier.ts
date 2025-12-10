/**
 * ITokenVerifier.ts
 * 
 * Purpose: Abstract interface for token verification.
 * This allows swapping Firebase Auth for any other identity provider
 * (Keycloak, Auth0, custom JWT server, etc.) without changing business logic.
 */

/**
 * Represents the decoded payload from a verified token.
 * Provider-agnostic structure.
 */
export interface DecodedToken {
  /** Unique user identifier */
  uid: string;
  
  /** User's email address (optional) */
  email?: string;
  
  /** Email verification status */
  emailVerified?: boolean;
  
  /** Display name (if available) */
  name?: string;
  
  /** Profile picture URL (if available) */
  picture?: string;
  
  /** Token issue timestamp (seconds since epoch) */
  iat?: number;
  
  /** Token expiration timestamp (seconds since epoch) */
  exp?: number;
  
  /** Custom claims from the identity provider */
  claims?: Record<string, any>;
}

/**
 * Interface for token verification services.
 * Implementations should handle provider-specific token validation.
 */
export interface ITokenVerifier {
  /**
   * Verifies the provided token and returns the decoded payload.
   * 
   * @param token - The bearer token to verify (e.g., JWT, Firebase ID token)
   * @returns Decoded token payload
   * @throws Error if token is invalid, expired, or verification fails
   */
  verify(token: string): Promise<DecodedToken>;
}
