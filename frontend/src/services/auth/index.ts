/**
 * Auth Services Index
 * 
 * Central export point for authentication abstractions.
 * Import from here for clean, provider-agnostic auth usage.
 */

// Interfaces
export type { IAuthProvider, AuthUser, LoginCredentials, AuthResult } from './IAuthProvider';

// Implementations
export { FirebaseAuthProvider, getFirebaseAuthProvider } from './FirebaseAuthProvider';
