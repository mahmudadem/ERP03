"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateRoleTemplateUseCase = void 0;
class UpdateRoleTemplateUseCase {
    constructor(roleTemplateRepo) {
        this.roleTemplateRepo = roleTemplateRepo;
    }
    async execute(data) {
        await this.roleTemplateRepo.update(data.id, Object.assign(Object.assign({}, data), { updatedAt: new Date() }));
    }
}
exports.UpdateRoleTemplateUseCase = UpdateRoleTemplateUseCase;
//# sourceMappingURL=UpdateRoleTemplateUseCase.js.map