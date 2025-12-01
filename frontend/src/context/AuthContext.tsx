import React, { createContext, useEffect, useState } from 'react';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../config/firebase';
import { AuthContextType, CurrentUser, LoginCredentials } from '../types/auth.types';

export const AuthContext = createContext<AuthContextType | null>(null);

// Convenience hook so consumers can import from this module directly
export const useAuth = () => {
  const ctx = React.useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      // eslint-disable-next-line no-console
      console.info('[Auth] onAuthStateChanged', firebaseUser?.uid);
      setUser(firebaseUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (creds: LoginCredentials) => {
    // eslint-disable-next-line no-console
    console.info('[Auth] login attempt', creds.email);
    try {
      const credential = await signInWithEmailAndPassword(auth, creds.email, creds.password);
      setUser(credential.user);
      // eslint-disable-next-line no-console
      console.info('[Auth] login success', credential.user.uid);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[Auth] login failed', err);
      throw err;
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  const getToken = async () => {
    if (!user) return null;
    return user.getIdToken();
  };

  const value: AuthContextType = {
    user,
    loading,
    login,
    logout,
    getToken,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
