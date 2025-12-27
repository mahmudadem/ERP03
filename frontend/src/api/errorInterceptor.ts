import { AxiosError } from 'axios';
import { client } from './client';
import { errorHandler } from '../services/errorHandler';
import { ApiErrorResponse } from '../types/errors';

/**
 * Setup error handling interceptor for API client
 * Must be called after client is created
 */
export function setupErrorInterceptor() {
  // Add response interceptor for data unwrapping and error handling
  client.interceptors.response.use(
    (response) => {
      // Restore response unwrapping: Unwrap common { success, data } envelopes
      return (response.data && response.data.data !== undefined)
        ? response.data.data
        : response.data;
    },
    async (error: AxiosError) => {
      // Handle authentication errors FIRST before showing any UI
      // Support 401 Unauthorized AND 500 Internal Server Error (if message is auth-related)
      const isAuthStatus = error.response?.status === 401 || error.response?.status === 500;
      
      if (isAuthStatus) {
        const errorResponse = error.response?.data as ApiErrorResponse | undefined;
        const errorCode = errorResponse?.error?.code;
        const errorMessage = errorResponse?.error?.message || (error.response?.data as any)?.message || '';
        
        // Only force logout on actual authentication failures (invalid/expired token)
        const isAuthTokenFailure = 
          errorCode === 'AUTH_002' || 
          errorCode === 'AUTH_003' ||
          errorCode === 'INFRA_999' && errorMessage.toLowerCase().includes('token') ||
          errorMessage.toLowerCase().includes('invalid authentication token') ||
          errorMessage.toLowerCase().includes('unauthorized') ||
          errorMessage.toLowerCase().includes('authentication') ||
          (error.response?.status === 401 && errorMessage === ''); // Empty message on 401 usually means token validation failed

        if (isAuthTokenFailure) {
          console.warn('[API] Authentication token error - clearing auth and redirecting to login');
          
          try {
            const { getAuth, signOut } = await import('firebase/auth');
            const auth = getAuth();
            await signOut(auth);
          } catch (authError) {
            console.error('[API] Error signing out:', authError);
          }
          
          localStorage.clear();
          // Use hash-friendly path
          window.location.href = '/#/auth?mode=login';
          return Promise.reject(error);
        }
      }

      // Check if response has structured error
      const errorResponse = error.response?.data as ApiErrorResponse | undefined;
      
      if (errorResponse && !errorResponse.success && errorResponse.error) {
        // Show error using centralized handler
        errorHandler.showError(errorResponse.error);
      } else {
        // Handle non-structured errors (network errors, etc.)
        if (!error.response) {
          // Network error
          errorHandler.showError({
            code: 'INFRA_002' as any,
            message: 'Network error occurred',
            severity: 'error' as any,
            timestamp: new Date().toISOString(),
          });
        }
      }
      
      return Promise.reject(error);
    }
  );
}
