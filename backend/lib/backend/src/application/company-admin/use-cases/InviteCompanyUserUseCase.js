"use strict";
/**
 * InviteCompanyUserUseCase
 * Invites a new user to join the company
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.InviteCompanyUserUseCase = void 0;
const User_1 = require("../../../domain/core/entities/User");
const ApiError_1 = require("../../../api/errors/ApiError");
class InviteCompanyUserUseCase {
    constructor(userRepository, companyUserRepository) {
        this.userRepository = userRepository;
        this.companyUserRepository = companyUserRepository;
    }
    async execute(input) {
        // Validate input
        this.validateInput(input);
        // Check if user already exists
        let user = await this.userRepository.findByEmail(input.email);
        let userId;
        if (user) {
            // User exists, check if they're already a member of this company
            const existingMembership = await this.companyUserRepository.getByUserAndCompany(user.id, input.companyId);
            if (existingMembership) {
                throw ApiError_1.ApiError.badRequest('User is already a member of this company');
            }
            userId = user.id;
        }
        else {
            // User doesn't exist, create a pending user record
            const newUserId = this.generateUserId();
            const fullName = [input.firstName, input.lastName].filter(Boolean).join(' ') || input.email;
            user = new User_1.User(newUserId, input.email, fullName, 'USER', new Date());
            await this.userRepository.createUser(user);
            userId = newUserId;
        }
        // Create company user membership with pending status
        const companyUser = {
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
    generateUserId() {
        return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    generateInvitationId() {
        return `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}
exports.InviteCompanyUserUseCase = InviteCompanyUserUseCase;
//# sourceMappingURL=InviteCompanyUserUseCase.js.map