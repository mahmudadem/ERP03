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

// Response Interceptor is managed by setupErrorInterceptor in errorInterceptor.ts
// to ensure centralized and consistent error handling across the app.

export default client;
