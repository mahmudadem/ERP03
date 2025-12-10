/**
 * AuthContext.tsx
 * 
 * Purpose: React context for authentication state management.
 * Uses the IAuthProvider abstraction to remain provider-agnostic.
 * 
 * By default, uses FirebaseAuthProvider, but can be swapped for any
 * other provider implementation (Keycloak, Auth0, custom JWT, etc.)
 */

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { IAuthProvider, AuthUser, LoginCredentials } from '../services/auth/IAuthProvider';
import { getFirebaseAuthProvider } from '../services/auth/FirebaseAuthProvider';

// Re-export types for backwards compatibility
export type { LoginCredentials } from '../services/auth/IAuthProvider';

export interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (creds: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  getToken: () => Promise<string | null>;
  refreshToken?: () => Promise<string | null>;
}

export const AuthContext = createContext<AuthContextType | null>(null);

// Convenience hook so consumers can import from this module directly
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
};

interface AuthProviderProps {
  children: ReactNode;
  /** Optional custom auth provider. Defaults to FirebaseAuthProvider. */
  authProvider?: IAuthProvider;
}

export const AuthProvider = ({ children, authProvider }: AuthProviderProps) => {
  // Use provided auth provider or default to Firebase
  const provider = authProvider ?? getFirebaseAuthProvider();
  
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Subscribe to auth state changes
    const unsubscribe = provider.onAuthStateChanged((authUser) => {
      // eslint-disable-next-line no-console
      console.info('[Auth] onAuthStateChanged', authUser?.uid);
      setUser(authUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [provider]);

  const login = async (creds: LoginCredentials) => {
    // eslint-disable-next-line no-console
    console.info('[Auth] login attempt', creds.email);
    try {
      const authUser = await provider.login(creds);
      setUser(authUser);
      // eslint-disable-next-line no-console
      console.info('[Auth] login success', authUser.uid);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[Auth] login failed', err);
      throw err;
    }
  };

  const logout = async () => {
    await provider.logout();
    setUser(null);
  };

  const getToken = async () => {
    return provider.getToken();
  };

  const refreshToken = async () => {
    if (provider.refreshToken) {
      return provider.refreshToken();
    }
    // Fallback: force refresh via getToken
    return provider.getToken(true);
  };

  const value: AuthContextType = {
    user,
    loading,
    login,
    logout,
    getToken,
    refreshToken,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
