"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetSystemOverviewUseCase = void 0;
class GetSystemOverviewUseCase {
    constructor(userRepo) {
        this.userRepo = userRepo;
    }
    async execute(actorId) {
        const actor = await this.userRepo.getUserById(actorId);
        if (!actor || !actor.isAdmin()) {
            throw new Error('Only SUPER_ADMIN can view system overview');
        }
        // This would require aggregation across multiple repositories
        // For now, return placeholder data
        return {
            totalUsers: 0,
            totalCompanies: 0,
            totalVouchers: 0,
            totalInventoryItems: 0,
            totalEmployees: 0
        };
    }
}
exports.GetSystemOverviewUseCase = GetSystemOverviewUseCase;
//# sourceMappingURL=GetSystemOverviewUseCase.js.map