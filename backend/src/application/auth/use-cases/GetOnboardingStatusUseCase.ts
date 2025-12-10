/**
 * GetOnboardingStatusUseCase.ts
 * 
 * Purpose: Determines user's onboarding status to route them appropriately.
 */

import { IUserRepository } from '../../../repository/interfaces/core/IUserRepository';
import { ICompanyUserRepository } from '../../../repository/interfaces/rbac/ICompanyUserRepository';

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

export class GetOnboardingStatusUseCase {
  constructor(
    private userRepository: IUserRepository,
    private companyUserRepository: ICompanyUserRepository
  ) {}

  async execute(userId: string, email?: string): Promise<OnboardingStatus> {
    const user = await this.userRepository.getUserById(userId);
    
    // If user doesn't exist in our database, they need to complete onboarding
    // This handles legacy Firebase Auth users who don't have a User record yet
    if (!user) {
      return {
        userId,
        email: email || 'unknown',
        name: 'User',
        hasPlan: false,
        planId: null,
        hasCompanies: false,
        companiesCount: 0,
        activeCompanyId: null,
        nextStep: 'PLAN_SELECTION',
      };
    }

    // Get user's companies
    const userCompanies = await this.companyUserRepository.getMembershipsByUser(userId);
    const hasCompanies = userCompanies.length > 0;

    // Determine next step
    let nextStep: OnboardingStatus['nextStep'];
    
    if (!user.planId) {
      nextStep = 'PLAN_SELECTION';
    } else if (!hasCompanies) {
      nextStep = 'COMPANY_SELECT';
    } else if (user.activeCompanyId) {
      nextStep = 'DASHBOARD';
    } else {
      nextStep = 'COMPANY_SELECT';
    }

    return {
      userId: user.id,
      email: user.email,
      name: user.name,
      hasPlan: !!user.planId,
      planId: user.planId || null,
      hasCompanies,
      companiesCount: userCompanies.length,
      activeCompanyId: user.activeCompanyId || null,
      nextStep,
    };
  }
}

