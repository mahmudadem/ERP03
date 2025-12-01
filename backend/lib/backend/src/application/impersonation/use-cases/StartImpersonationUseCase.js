"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StartImpersonationUseCase = void 0;
class StartImpersonationUseCase {
    constructor(userRepo, impersonationRepo) {
        this.userRepo = userRepo;
        this.impersonationRepo = impersonationRepo;
    }
    async execute(superAdminId, targetCompanyId) {
        const superAdmin = await this.userRepo.getUserById(superAdminId);
        if (!superAdmin || !superAdmin.isAdmin()) {
            throw new Error('Only SUPER_ADMIN can start impersonation');
        }
        // End any existing active session
        const existingSession = await this.impersonationRepo.getActiveSessionBySuperAdmin(superAdminId);
        if (existingSession) {
            await this.impersonationRepo.endSession(existingSession.id);
        }
        const session = await this.impersonationRepo.startSession(superAdminId, targetCompanyId);
        return session.id;
    }
}
exports.StartImpersonationUseCase = StartImpersonationUseCase;
//# sourceMappingURL=StartImpersonationUseCase.js.map