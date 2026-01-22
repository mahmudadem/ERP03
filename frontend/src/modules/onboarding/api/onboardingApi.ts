/**
 * onboardingApi.ts
 * 
 * Purpose: API client for onboarding-related endpoints.
 * Note: The axios client already unwraps { success, data } responses,
 * so we receive the data directly.
 */

import client from '../../../api/client';

export interface SignupRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface SignupResponse {
  userId: string;
  email: string;
  name: string;
  needsPlan: boolean;
}

export interface OnboardingStatus {
  userId: string;
  email: string;
  name: string;
  hasPlan: boolean;
  planId: string | null;
  hasCompanies: boolean;
  companiesCount: number;
  activeCompanyId: string | null;
  nextStep: 'PLAN_SELECTION' | 'COMPANY_SELECT' | 'DASHBOARD';
}

export interface Plan {
  id: string;
  name: string;
  description: string;
  price: number;
  limits: {
    maxCompanies: number;
    maxUsersPerCompany: number;
    maxModulesAllowed: number;
    maxStorageMB: number;
    maxTransactionsPerMonth: number;
  };
}

export interface Bundle {
  id: string;
  name: string;
  description: string;
  modules: string[];
  recommended: boolean;
}

export const onboardingApi = {
  /**
   * Register a new user (public)
   */
  signup: async (data: SignupRequest): Promise<SignupResponse> => {
    // Client already unwraps { success, data } response
    return client.post('/onboarding/signup', data);
  },

  /**
   * Get current user's onboarding status (authenticated)
   */
  getOnboardingStatus: async (): Promise<OnboardingStatus> => {
    return client.get('/onboarding/onboarding-status');
  },

  /**
   * Select a plan for the current user (authenticated)
   */
  selectPlan: async (planId: string): Promise<{ success: boolean; planId: string; planName: string }> => {
    return client.post('/onboarding/select-plan', { planId });
  },

  /**
   * Get all available plans (public)
   */
  getPlans: async (): Promise<Plan[]> => {
    return client.get('/onboarding/plans');
  },

  /**
   * Get all available bundles for company creation (public)
   */
  getBundles: async (): Promise<Bundle[]> => {
    return client.get('/onboarding/bundles');
  },

  /**
   * Create a new company (authenticated)
   */
  createCompany: async (data: CreateCompanyRequest): Promise<{ companyId: string }> => {
    return client.post('/onboarding/create-company', data);
  },
};

export interface CreateCompanyRequest {
  companyName: string;
  description: string;
  country: string;
  email: string; // Admin email
  bundleId: string;
  logoData?: string; // Base64 encoded logo
  currency?: string;
  language?: string;
  timezone?: string;
  dateFormat?: string;
}

