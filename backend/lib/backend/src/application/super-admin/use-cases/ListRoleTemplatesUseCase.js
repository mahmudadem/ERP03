"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListRoleTemplatesUseCase = void 0;
class ListRoleTemplatesUseCase {
    constructor(roleTemplateRepo) {
        this.roleTemplateRepo = roleTemplateRepo;
    }
    async execute() {
        return await this.roleTemplateRepo.getAll();
    }
}
exports.ListRoleTemplatesUseCase = ListRoleTemplatesUseCase;
//# sourceMappingURL=ListRoleTemplatesUseCase.js.map