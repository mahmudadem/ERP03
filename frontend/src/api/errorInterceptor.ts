import { AxiosError, AxiosRequestConfig } from 'axios';
import { client } from './client';
import { errorHandler } from '../services/errorHandler';
import { ApiErrorResponse } from '../types/errors';

// Backend cold-start: retry 503 transparently before showing any UI error.
// The backend returns 503 "Server not ready" while modules initialize
// (see backend/src/index.ts). Without this, a fresh page load after a
// backend restart spams the user with one toast per in-flight request.
const RETRY_DELAYS_MS = [250, 500, 1000, 2000, 4000];

interface RetryableConfig extends AxiosRequestConfig {
  __retry503Count?: number;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const getRequestPath = (url?: string): string | undefined => {
  if (!url) return undefined;
  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.pathname;
  } catch {
    return url.split('?')[0];
  }
};

/**
 * Setup error handling interceptor for API client
 * Must be called after client is created
 */
export function setupErrorInterceptor() {
  // Add response interceptor for data unwrapping and error handling
  client.interceptors.response.use(
    (response) => {
      // Restore response unwrapping: Unwrap common { success, data } envelopes
      if (response.data && response.data.data !== undefined) {
        if (response.data.meta || response.data.metadata) {
          return {
            data: response.data.data,
            meta: response.data.meta || response.data.metadata
          };
        }
        return response.data.data;
      }
      return response.data;
    },
    async (error: AxiosError) => {
      // Transparent retry for 503 "Server not ready" during backend warm-up.
      // Each request is retried up to RETRY_DELAYS_MS.length times with the
      // listed backoff. No toast is shown unless the final retry also fails.
      if (error.response?.status === 503 && error.config) {
        const cfg = error.config as RetryableConfig;
        const attempt = cfg.__retry503Count ?? 0;
        if (attempt < RETRY_DELAYS_MS.length) {
          cfg.__retry503Count = attempt + 1;
          await sleep(RETRY_DELAYS_MS[attempt]);
          return client.request(cfg);
        }
        // Final retry failed — fall through to normal error handling below.
      }

      // Handle authentication errors FIRST before showing any UI
      // Only 401 Unauthorized is an auth failure. 500 is a server error, not auth.
      const isAuthStatus = error.response?.status === 401;
      
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
          errorMessage.toLowerCase().includes('authorization header') ||
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
      
      const isSilent = 
        error.config?.headers?.['X-Silent-Error'] === 'true' || 
        error.config?.headers?.['x-silent-error'] === 'true';

      if (errorResponse && !errorResponse.success && errorResponse.error) {
        const enrichedError = {
          ...errorResponse.error,
          context: {
            ...(errorResponse.error as any).context,
            httpStatus: error.response?.status,
            apiPath: getRequestPath(error.config?.url),
            method: error.config?.method?.toUpperCase(),
          },
        };

        // Skip auto-toast for POLICY / known-handled error codes — the page's
        // own catch block handles these with a context-specific UX (modals,
        // banners, etc.). Showing a global toast on top creates duplicates.
        const err = enrichedError as any;
        const isPagePolicyHandled =
          err?.category === 'POLICY' ||
          err?.code === 'PERIOD_LOCKED' ||
          err?.code === 'CREDIT_LIMIT_EXCEEDED' ||
          err?.code === 'PERSONA_NOT_ALLOWED' ||
          err?.code === 'UNSETTLED_COST_BLOCKED' ||
          err?.code === 'GOVERNANCE_RULE_VIOLATION';
        if (!isSilent && !isPagePolicyHandled) {
          errorHandler.showError(enrichedError);
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
