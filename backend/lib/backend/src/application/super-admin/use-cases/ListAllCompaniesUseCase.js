"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListAllCompaniesUseCase = void 0;
class ListAllCompaniesUseCase {
    constructor(userRepo, companyRepo) {
        this.userRepo = userRepo;
        this.companyRepo = companyRepo;
    }
    async execute(actorId) {
        const actor = await this.userRepo.getUserById(actorId);
        if (!actor || !actor.isAdmin()) {
            throw new Error('Only SUPER_ADMIN can list all companies');
        }
        return await this.companyRepo.listAll();
    }
}
exports.ListAllCompaniesUseCase = ListAllCompaniesUseCase;
//# sourceMappingURL=ListAllCompaniesUseCase.js.map