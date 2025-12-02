import axios, { InternalAxiosRequestConfig } from 'axios';
import { env } from '../config/env';

// Pluggable Auth Token Getter
let authTokenGetter: (() => Promise<string | null>) | null = null;

export const setAuthTokenGetter = (getter: () => Promise<string | null>) => {
  authTokenGetter = getter;
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
    if (authTokenGetter) {
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
  (error) => {
    return Promise.reject(error);
  }
);

export default client;
