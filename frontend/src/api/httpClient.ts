
/**
 * httpClient.ts
 * Wrapper around fetch API to handle headers, auth, and base URL.
 */

// In a real environment, this comes from env vars
const API_BASE_URL = 'http://localhost:5001/erp-platform/us-central1/api/api/v1'; 

interface RequestOptions extends RequestInit {
  // custom options if needed
}

export const httpClient = async <T>(endpoint: string, options: RequestOptions = {}): Promise<T> => {
  // Mock Auth Token - In real app, get from Firebase Auth
  const token = 'mock-valid-token'; 
  const companyId = 'cmp_123'; // Mock Company Context

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'x-company-id': companyId,
    ...options.headers,
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const responseData = await response.json();

  if (!response.ok) {
    throw new Error(responseData.error?.message || 'API Request Failed');
  }

  return responseData.data as T;
};
