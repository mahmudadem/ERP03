"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PromoteUserToSuperAdminUseCase = void 0;
class PromoteUserToSuperAdminUseCase {
    constructor(userRepo) {
        this.userRepo = userRepo;
    }
    async execute(userId, actorId) {
        const actor = await this.userRepo.getUserById(actorId);
        if (!actor || !actor.isAdmin()) {
            throw new Error('Only SUPER_ADMIN can promote users');
        }
        const targetUser = await this.userRepo.getUserById(userId);
        if (!targetUser) {
            throw new Error('User not found');
        }
        if (targetUser.globalRole === 'SUPER_ADMIN') {
            throw new Error('User is already a SUPER_ADMIN');
        }
        await this.userRepo.updateGlobalRole(userId, 'SUPER_ADMIN');
    }
}
exports.PromoteUserToSuperAdminUseCase = PromoteUserToSuperAdminUseCase;
//# sourceMappingURL=PromoteUserToSuperAdminUseCase.js.map