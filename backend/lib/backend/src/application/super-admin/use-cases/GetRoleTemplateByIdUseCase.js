"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetRoleTemplateByIdUseCase = void 0;
class GetRoleTemplateByIdUseCase {
    constructor(roleTemplateRepo) {
        this.roleTemplateRepo = roleTemplateRepo;
    }
    async execute(id) {
        return await this.roleTemplateRepo.getById(id);
    }
}
exports.GetRoleTemplateByIdUseCase = GetRoleTemplateByIdUseCase;
//# sourceMappingURL=GetRoleTemplateByIdUseCase.js.map