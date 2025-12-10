/**
 * SelectPlanUseCase.ts
 * 
 * Purpose: Handles user's plan selection during onboarding.
 * Validates the plan exists and updates user record.
 */

import { IUserRepository } from '../../../repository/interfaces/core/IUserRepository';
import { IPlanRegistryRepository } from '../../../repository/interfaces/super-admin/IPlanRegistryRepository';
import { ApiError } from '../../../api/errors/ApiError';

export interface SelectPlanInput {
  userId: string;
  planId: string;
}

export interface SelectPlanResult {
  success: boolean;
  planId: string;
  planName: string;
}

export class SelectPlanUseCase {
  constructor(
    private userRepository: IUserRepository,
    private planRepository: IPlanRegistryRepository
  ) {}

  async execute(input: SelectPlanInput): Promise<SelectPlanResult> {
    // Validate plan exists
    const plan = await this.planRepository.getById(input.planId);
    if (!plan) {
      throw ApiError.badRequest('Invalid plan selected');
    }

    if (plan.status !== 'active') {
      throw ApiError.badRequest('Selected plan is not available');
    }

    // Validate user exists
    const user = await this.userRepository.getUserById(input.userId);
    if (!user) {
      throw ApiError.notFound('User not found');
    }

    // Update user's plan
    await this.userRepository.updatePlan(input.userId, input.planId);

    return {
      success: true,
      planId: plan.id,
      planName: plan.name,
    };
  }
}
