"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListAllCompaniesUseCase = void 0;
class ListAllCompaniesUseCase {
    constructor(userRepo, _companyRepo) {
        this.userRepo = userRepo;
        this._companyRepo = _companyRepo;
        void this._companyRepo;
    }
    async execute(actorId) {
        const actor = await this.userRepo.getUserById(actorId);
        if (!actor || !actor.isAdmin()) {
            throw new Error('Only SUPER_ADMIN can list all companies');
        }
        // This would require adding a listAll method to ICompanyRepository
        // For now, we'll throw an error indicating implementation needed
        throw new Error('ListAllCompanies requires ICompanyRepository.listAll() implementation');
    }
}
exports.ListAllCompaniesUseCase = ListAllCompaniesUseCase;
//# sourceMappingURL=ListAllCompaniesUseCase.js.map