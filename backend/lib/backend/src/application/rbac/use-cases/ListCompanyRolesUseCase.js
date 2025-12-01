"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListCompanyRolesUseCase = void 0;
class ListCompanyRolesUseCase {
    constructor(companyRoleRepo, permissionChecker) {
        this.companyRoleRepo = companyRoleRepo;
        this.permissionChecker = permissionChecker;
    }
    async execute(request) {
        // View permissions usually required, or maybe just being a member?
        // Assuming 'system.roles.manage' or basic access. 
        // Let's assume anyone in the company can see roles for now, or enforce 'system.roles.manage' if it's for management.
        // The prompt says "Validate user has system.roles.manage OR isOwner to manage roles."
        // Listing might be needed for assigning too. Let's enforce manage for now as per "manage roles".
        await this.permissionChecker.assertOrThrow(request.actorId, request.companyId, 'system.roles.manage');
        return this.companyRoleRepo.getAll(request.companyId);
    }
}
exports.ListCompanyRolesUseCase = ListCompanyRolesUseCase;
//# sourceMappingURL=ListCompanyRolesUseCase.js.map