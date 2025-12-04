/**
 * InviteCompanyUserUseCase
 * Invites a new user to join the company
 */

import { IUserRepository } from '../../../repository/interfaces/core/IUserRepository';
import { ICompanyUserRepository } from '../../../repository/interfaces/rbac/ICompanyUserRepository';
import { User } from '../../../domain/core/entities/User';
import { CompanyUser } from '../../../domain/rbac/CompanyUser';
import { ApiError } from '../../../api/errors/ApiError';

interface InviteCompanyUserInput {
  companyId: string;
  email: string;
  roleId: string;
  firstName?: string;
  lastName?: string;
}

interface InvitationResult {
  invitationId: string;
  email: string;
  roleId: string;
  status: string;
  invitedAt: Date;
  expiresAt: Date;
}

export class InviteCompanyUserUseCase {
  constructor(
    private userRepository: IUserRepository,
    private companyUserRepository: ICompanyUserRepository
  ) {}

  async execute(input: InviteCompanyUserInput): Promise<InvitationResult> {
    // Validate input
    this.validateInput(input);

    // Check if user already exists
    let user = await this.userRepository.findByEmail(input.email);
    let userId: string;

    if (user) {
      // User exists, check if they're already a member of this company
      const existingMembership = await this.companyUserRepository.getByUserAndCompany(
        user.id,
        input.companyId
      );

      if (existingMembership) {
        throw ApiError.badRequest('User is already a member of this company');
      }

      userId = user.id;
    } else {
      // User doesn't exist, create a pending user record
      const newUserId = this.generateUserId();
      const fullName = [input.firstName, input.lastName].filter(Boolean).join(' ') || input.email;

      user = new User(
        newUserId,
        input.email,
        fullName,
        'USER',
        new Date()
      );

      await this.userRepository.createUser(user);
      userId = newUserId;
    }

    // Create company user membership with pending status
    const companyUser: CompanyUser = {
      userId,
      companyId: input.companyId,
      roleId: input.roleId,
      isOwner: false,
      createdAt: new Date()
    };

    await this.companyUserRepository.create(companyUser);

    // Generate invitation details
    const invitationId = this.generateInvitationId();
    const invitedAt = new Date();
    const expiresAt = new Date(invitedAt.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

    return {
      invitationId,
      email: input.email,
      roleId: input.roleId,
      status: 'pending',
      invitedAt,
      expiresAt
    };
  }

  private validateInput(input: InviteCompanyUserInput): void {
    if (!input.email || typeof input.email !== 'string') {
      throw ApiError.badRequest('Email is required');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(input.email)) {
      throw ApiError.badRequest('Invalid email format');
    }

    if (!input.roleId || typeof input.roleId !== 'string') {
      throw ApiError.badRequest('Role ID is required');
    }

    if (!input.companyId || typeof input.companyId !== 'string') {
      throw ApiError.badRequest('Company ID is required');
    }
  }

  private generateUserId(): string {
    return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateInvitationId(): string {
    return `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
