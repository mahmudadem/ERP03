import { AxiosError } from 'axios';
import { client } from './client';
import { errorHandler } from '../services/errorHandler';
import { ApiErrorResponse } from '../types/errors';

/**
 * Setup error handling interceptor for API client
 * Must be called after client is created
 */
export function setupErrorInterceptor() {
  // Add response interceptor for error handling
  client.interceptors.response.use(
    (response) => response, // Pass through successful responses
    async (error: AxiosError) => {
      // Check if response has structured error
      const errorResponse = error.response?.data as ApiErrorResponse | undefined;
      
      if (errorResponse && !errorResponse.success && errorResponse.error) {
        // Show error using centralized handler
        errorHandler.showError(errorResponse.error);
        
        // Handle authentication errors
        if (error.response?.status === 401) {
          const errorCode = errorResponse.error.code;
          
          // Only force logout on actual authentication failures
          if (errorCode === 'AUTH_002' || errorCode === 'AUTH_003') {
            console.warn('[API] Authentication token error - clearing auth and redirecting to login');
            
            try {
              const { getAuth, signOut } = await import('firebase/auth');
              const auth = getAuth();
              await signOut(auth);
            } catch (authError) {
              console.error('[API] Error signing out:', authError);
            }
            
            localStorage.clear();
            window.location.href = '/login';
          }
        }
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
