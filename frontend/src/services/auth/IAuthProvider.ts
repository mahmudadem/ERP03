/**
 * IAuthProvider.ts
 * 
 * Purpose: Abstract interface for authentication providers.
 * This allows swapping Firebase Auth for any other identity provider
 * (Keycloak, Auth0, custom JWT server, etc.) without changing UI components.
 */

/**
 * Provider-agnostic user representation.
 * Contains only the fields needed by the application.
 */
export interface AuthUser {
  /** Unique user identifier */
  uid: string;
  
  /** User's email address */
  email: string | null;
  
  /** User's display name */
  displayName: string | null;
  
  /** Profile picture URL */
  photoURL: string | null;
  
  /** Whether the email has been verified */
  emailVerified: boolean;
}

/**
 * Result of a successful authentication.
 */
export interface AuthResult {
  user: AuthUser;
  token: string;
}

/**
 * Credentials for email/password authentication.
 */
export interface LoginCredentials {
  email: string;
  password: string;
}

/**
 * Interface for authentication provider services.
 * Implementations should handle provider-specific authentication flows.
 */
export interface IAuthProvider {
  /**
   * Authenticates a user with email and password.
   * 
   * @param credentials - Email and password
   * @returns The authenticated user
   * @throws Error if authentication fails
   */
  login(credentials: LoginCredentials): Promise<AuthUser>;
  
  /**
   * Signs out the current user.
   */
  logout(): Promise<void>;
  
  /**
   * Gets the currently authenticated user synchronously.
   * Returns null if no user is authenticated.
   */
  getCurrentUser(): AuthUser | null;
  
  /**
   * Gets a valid authentication token for the current user.
   * Returns null if no user is authenticated.
   * 
   * @param forceRefresh - If true, forces a token refresh
   */
  getToken(forceRefresh?: boolean): Promise<string | null>;
  
  /**
   * Subscribes to auth state changes.
   * 
   * @param callback - Called whenever auth state changes
   * @returns Unsubscribe function
   */
  onAuthStateChanged(callback: (user: AuthUser | null) => void): () => void;
  
  /**
   * Forces a token refresh. Useful for ensuring fresh tokens before
   * sensitive operations.
   * 
   * @returns The new token, or null if not authenticated
   */
  refreshToken?(): Promise<string | null>;
}
