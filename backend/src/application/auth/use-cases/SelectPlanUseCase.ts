/**
 * SelectPlanUseCase.ts
 * 
 * Purpose: Handles user's plan selection during onboarding.
 * Validates the plan exists and updates user record.
 */

import { IUserRepository } from '../../../repository/interfaces/core/IUserRepository';
import { IPlanRegistryRepository } from '../../../repository/interfaces/super-admin/IPlanRegistryRepository';
import { User } from '../../../domain/core/entities/User';
import { ApiError } from '../../../api/errors/ApiError';

export interface SelectPlanInput {
  userId: string;
  planId: string;
  email?: string;
  name?: string;
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
    let user = await this.userRepository.getUserById(input.userId);
    if (!user) {
      if (!input.email) {
        throw ApiError.notFound('User not found');
      }

      const existingByEmail = await this.userRepository.findByEmail(input.email);
      if (existingByEmail && existingByEmail.id !== input.userId) {
        throw ApiError.conflict('Authenticated user does not match existing account', 'USER_IDENTITY_MISMATCH');
      }

      user = new User(
        input.userId,
        input.email.trim().toLowerCase(),
        input.name?.trim() || input.email,
        'USER',
        new Date()
      );
      await this.userRepository.createUser(user);
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
