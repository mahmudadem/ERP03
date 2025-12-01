"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DemoteSuperAdminUseCase = void 0;
class DemoteSuperAdminUseCase {
    constructor(userRepo) {
        this.userRepo = userRepo;
    }
    async execute(userId, actorId) {
        const actor = await this.userRepo.getUserById(actorId);
        if (!actor || !actor.isAdmin()) {
            throw new Error('Only SUPER_ADMIN can demote users');
        }
        if (userId === actorId) {
            throw new Error('Cannot demote yourself');
        }
        const targetUser = await this.userRepo.getUserById(userId);
        if (!targetUser) {
            throw new Error('User not found');
        }
        if (targetUser.globalRole === 'USER') {
            throw new Error('User is already a regular USER');
        }
        await this.userRepo.updateGlobalRole(userId, 'USER');
    }
}
exports.DemoteSuperAdminUseCase = DemoteSuperAdminUseCase;
//# sourceMappingURL=DemoteSuperAdminUseCase.js.map