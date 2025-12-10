"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeleteRoleTemplateUseCase = void 0;
class DeleteRoleTemplateUseCase {
    constructor(roleTemplateRepo) {
        this.roleTemplateRepo = roleTemplateRepo;
    }
    async execute(id) {
        await this.roleTemplateRepo.delete(id);
    }
}
exports.DeleteRoleTemplateUseCase = DeleteRoleTemplateUseCase;
//# sourceMappingURL=DeleteRoleTemplateUseCase.js.map