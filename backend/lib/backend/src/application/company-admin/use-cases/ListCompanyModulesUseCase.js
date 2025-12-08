"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListCompanyModulesUseCase = void 0;
const ModuleRegistry_1 = require("../../platform/ModuleRegistry");
const ApiError_1 = require("../../../api/errors/ApiError");
class ListCompanyModulesUseCase {
    async execute(input) {
        // Validate companyId
        if (!input.companyId) {
            throw ApiError_1.ApiError.badRequest("Missing companyId");
        }
        // Load all modules from ModuleRegistry
        const modules = ModuleRegistry_1.ModuleRegistry.getInstance().getAllModules();
        // Return
        return modules.map(m => ({
            id: m.metadata.id,
            name: m.metadata.name,
            description: m.metadata.description || '',
            permissions: m.permissions || []
        }));
    }
}
exports.ListCompanyModulesUseCase = ListCompanyModulesUseCase;
//# sourceMappingURL=ListCompanyModulesUseCase.js.map