/**
 * auth.types.ts
 * 
 * Purpose: Provider-agnostic authentication types.
 * These types are decoupled from any specific auth provider (Firebase, Auth0, etc.)
 */

// Re-export types from the auth provider interface for convenience
// Using 'export type' for isolatedModules compatibility
export type { AuthUser, LoginCredentials } from '../services/auth/IAuthProvider';
import type { AuthUser, LoginCredentials } from '../services/auth/IAuthProvider';

/**
 * The current authenticated user.
 * Provider-agnostic type that can work with any identity provider.
 */
export type CurrentUser = AuthUser;

export interface AuthContextType {
  user: CurrentUser | null;
  loading: boolean;
  login: (creds: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  getToken: () => Promise<string | null>;
}

