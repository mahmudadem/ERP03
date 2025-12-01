"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StopImpersonationUseCase = void 0;
class StopImpersonationUseCase {
    constructor(userRepo, impersonationRepo) {
        this.userRepo = userRepo;
        this.impersonationRepo = impersonationRepo;
    }
    async execute(superAdminId) {
        const superAdmin = await this.userRepo.getUserById(superAdminId);
        if (!superAdmin || !superAdmin.isAdmin()) {
            throw new Error('Only SUPER_ADMIN can stop impersonation');
        }
        const activeSession = await this.impersonationRepo.getActiveSessionBySuperAdmin(superAdminId);
        if (!activeSession) {
            throw new Error('No active impersonation session found');
        }
        await this.impersonationRepo.endSession(activeSession.id);
    }
}
exports.StopImpersonationUseCase = StopImpersonationUseCase;
//# sourceMappingURL=StopImpersonationUseCase.js.map