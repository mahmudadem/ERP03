"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateRoleTemplateUseCase = void 0;
class CreateRoleTemplateUseCase {
    constructor(roleTemplateRepo) {
        this.roleTemplateRepo = roleTemplateRepo;
    }
    async execute(input) {
        const roleTemplate = Object.assign(Object.assign({}, input), { permissions: input.permissions || [], createdAt: new Date(), updatedAt: new Date() });
        await this.roleTemplateRepo.create(roleTemplate);
    }
}
exports.CreateRoleTemplateUseCase = CreateRoleTemplateUseCase;
//# sourceMappingURL=CreateRoleTemplateUseCase.js.map