/**
 * FirebaseAuthProvider.ts
 * 
 * Purpose: Firebase-specific implementation of IAuthProvider.
 * Uses Firebase Auth SDK for authentication operations.
 */

import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import { auth } from '../../config/firebase';
import { IAuthProvider, AuthUser, LoginCredentials } from './IAuthProvider';

/**
 * Maps a Firebase User to our provider-agnostic AuthUser.
 */
function mapFirebaseUser(firebaseUser: FirebaseUser | null): AuthUser | null {
  if (!firebaseUser) return null;
  
  return {
    uid: firebaseUser.uid,
    email: firebaseUser.email,
    displayName: firebaseUser.displayName,
    photoURL: firebaseUser.photoURL,
    emailVerified: firebaseUser.emailVerified,
  };
}

/**
 * Firebase implementation of the IAuthProvider interface.
 */
export class FirebaseAuthProvider implements IAuthProvider {
  /**
   * Store the current Firebase user for sync access.
   */
  private currentFirebaseUser: FirebaseUser | null = null;
  
  constructor() {
    // Keep track of the current user
    firebaseOnAuthStateChanged(auth, (user) => {
      this.currentFirebaseUser = user;
    });
  }
  
  async login(credentials: LoginCredentials): Promise<AuthUser> {
    const result = await signInWithEmailAndPassword(
      auth,
      credentials.email,
      credentials.password
    );
    
    this.currentFirebaseUser = result.user;
    
    const authUser = mapFirebaseUser(result.user);
    if (!authUser) {
      throw new Error('Login succeeded but user mapping failed');
    }
    
    return authUser;
  }
  
  async logout(): Promise<void> {
    await signOut(auth);
    this.currentFirebaseUser = null;
  }
  
  getCurrentUser(): AuthUser | null {
    // Use the cached user for sync access, fall back to auth.currentUser
    return mapFirebaseUser(this.currentFirebaseUser ?? auth.currentUser);
  }
  
  async getToken(forceRefresh = false): Promise<string | null> {
    const user = this.currentFirebaseUser ?? auth.currentUser;
    if (!user) return null;
    
    return user.getIdToken(forceRefresh);
  }
  
  onAuthStateChanged(callback: (user: AuthUser | null) => void): () => void {
    return firebaseOnAuthStateChanged(auth, (firebaseUser) => {
      this.currentFirebaseUser = firebaseUser;
      callback(mapFirebaseUser(firebaseUser));
    });
  }
  
  async refreshToken(): Promise<string | null> {
    return this.getToken(true);
  }
}

/**
 * Singleton instance of the Firebase auth provider.
 * Use this in the application to ensure consistent state.
 */
let providerInstance: FirebaseAuthProvider | null = null;

export function getFirebaseAuthProvider(): FirebaseAuthProvider {
  if (!providerInstance) {
    providerInstance = new FirebaseAuthProvider();
  }
  return providerInstance;
}
