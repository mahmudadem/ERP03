import axios, { InternalAxiosRequestConfig } from 'axios';
import { env } from '../config/env';

// Pluggable getters
let authTokenGetter: (() => Promise<string | null>) | null = null;
let companyIdGetter: (() => string | null) | null = null;

export const setAuthTokenGetter = (getter: () => Promise<string | null>) => {
  authTokenGetter = getter;
};

export const setCompanyIdGetter = (getter: () => string | null) => {
  companyIdGetter = getter;
};

// Axios Instance
export const client = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor
client.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    // List of public endpoints that should NOT have an auth token attached
    const publicEndpoints = [
      '/onboarding/signup',
      '/onboarding/plans',
      '/onboarding/bundles',
      '/auth/login' // Although login usually doesn't need it, good to be explicit
    ];

    // Check if the current request URL matches any public endpoint
    const isPublicEndpoint = publicEndpoints.some(endpoint => 
      config.url?.includes(endpoint)
    );

    // Attach Auth Token
    if (authTokenGetter && !isPublicEndpoint) {
      try {
        const token = await authTokenGetter();
        if (token) {
          config.headers.set('Authorization', `Bearer ${token}`);
          // eslint-disable-next-line no-console
          console.debug('[API] attaching token', token.slice(0, 8) + '...');
        } else {
          // eslint-disable-next-line no-console
          console.debug('[API] no token available for request');
        }
      } catch (error) {
        console.error('Failed to retrieve auth token', error);
      }
    }

    // Attach Company ID
    if (companyIdGetter && !config.headers.get('x-company-id')) {
      const companyId = companyIdGetter();
      if (companyId) {
        config.headers.set('x-company-id', companyId);
        console.debug('[API] attaching x-company-id', companyId);
      }
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor
client.interceptors.response.use(
  (response) => {
    // Unwrap common { success, data } envelopes while preserving plain responses
    return (response.data && response.data.data !== undefined)
      ? response.data.data
      : response.data;
  },
  async (error) => {
    // Handle authentication errors MORE SELECTIVELY
    // Only log out if it's a real auth token failure, not just a permission error
    if (error.response?.status === 401) {
      const errorMessage = error.response?.data?.message || error.response?.data?.error?.message || '';
      
      // Only force logout on actual authentication failures (invalid/expired token)
      // NOT on permission errors like "voucher.create permission required"
      const isAuthTokenFailure = 
        errorMessage.toLowerCase().includes('token') ||
        errorMessage.toLowerCase().includes('unauthorized') ||
        errorMessage.toLowerCase().includes('authentication') ||
        errorMessage === ''; // Empty message usually means token validation failed
      
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
        window.location.href = '/login';
        return Promise.reject(error);
      } else {
        // It's a permission error, not an auth token error
        console.warn('[API] Permission error (401) but token is valid:', errorMessage);
      }
    }
    
    // Handle 403 Forbidden - don't log out, user is authenticated but lacks permission
    if (error.response?.status === 403) {
      console.warn('[API] Access forbidden (403):', error.response?.data?.message);
    }
    
    // Normalize backend error messages for frontend consumption
    if (error.response?.data?.error?.message) {
      // Ensure error.response.data.message exists for hooks that look there
      if (typeof error.response.data === 'object') {
        error.response.data.message = error.response.data.error.message;
      }
    }
    return Promise.reject(error);
  }
);

export default client;
