"use strict";
/**
 * InviteCompanyUserUseCase
 * Invites a new user to join the company
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.InviteCompanyUserUseCase = void 0;
const ApiError_1 = require("../../../api/errors/ApiError");
class InviteCompanyUserUseCase {
    constructor(userRepository, companyUserRepository) {
        this.userRepository = userRepository;
        this.companyUserRepository = companyUserRepository;
    }
    async execute(input) {
        // Normalize email
        if (input.email) {
            input.email = input.email.trim().toLowerCase();
        }
        console.log(`[Invite] Processing invite for ${input.email} in company ${input.companyId}`);
        // Validate input
        this.validateInput(input);
        // Check if user already exists
        let user = await this.userRepository.findByEmail(input.email);
        let userId;
        if (!user) {
            console.warn(`[Invite] User not found. Refusing to create placeholder global user.`);
            throw ApiError_1.ApiError.notFound('User not found. Ask the user to sign up first, then add them again.');
        }
        console.log(`[Invite] Found existing user: ${user.id} (${user.email})`);
        // User exists, check if they're already a member of this company
        const existingMembership = await this.companyUserRepository.getByUserAndCompany(user.id, input.companyId);
        if (existingMembership) {
            console.warn(`[Invite] User already member of company`);
            throw ApiError_1.ApiError.badRequest('User is already a member of this company');
        }
        userId = user.id;
        console.log(`[Invite] Creating membership for userId: ${userId}`);
        // Create company user membership with pending status
        const companyUser = {
            userId,
            companyId: input.companyId,
            roleId: input.roleId,
            isOwner: false,
            createdAt: new Date()
        };
        await this.companyUserRepository.create(companyUser);
        console.log(`[Invite] Membership created successfully.`);
        // Keep the legacy response shape for the existing endpoint, but access is active immediately.
        const invitationId = this.generateInvitationId();
        const invitedAt = new Date();
        const expiresAt = new Date(invitedAt.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
        return {
            invitationId,
            email: input.email,
            roleId: input.roleId,
            status: 'active',
            invitedAt,
            expiresAt
        };
    }
    validateInput(input) {
        if (!input.email || typeof input.email !== 'string') {
            throw ApiError_1.ApiError.badRequest('Email is required');
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(input.email)) {
            throw ApiError_1.ApiError.badRequest('Invalid email format');
        }
        if (!input.roleId || typeof input.roleId !== 'string') {
            throw ApiError_1.ApiError.badRequest('Role ID is required');
        }
        if (!input.companyId || typeof input.companyId !== 'string') {
            throw ApiError_1.ApiError.badRequest('Company ID is required');
        }
    }
    generateInvitationId() {
        return `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}
exports.InviteCompanyUserUseCase = InviteCompanyUserUseCase;
//# sourceMappingURL=InviteCompanyUserUseCase.js.map