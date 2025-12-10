/**
 * onboardingApi.ts
 * 
 * Purpose: API client for onboarding-related endpoints.
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
    const response = await client.post('/onboarding/signup', data);
    return response.data.data;
  },

  /**
   * Get current user's onboarding status (authenticated)
   */
  getOnboardingStatus: async (): Promise<OnboardingStatus> => {
    const response = await client.get('/onboarding/onboarding-status');
    return response.data.data;
  },

  /**
   * Select a plan for the current user (authenticated)
   */
  selectPlan: async (planId: string): Promise<{ success: boolean; planId: string; planName: string }> => {
    const response = await client.post('/onboarding/select-plan', { planId });
    return response.data.data;
  },

  /**
   * Get all available plans (public)
   */
  getPlans: async (): Promise<Plan[]> => {
    const response = await client.get('/onboarding/plans');
    return response.data.data;
  },

  /**
   * Get all available bundles for company creation (public)
   */
  getBundles: async (): Promise<Bundle[]> => {
    const response = await client.get('/onboarding/bundles');
    return response.data.data;
  },
};
