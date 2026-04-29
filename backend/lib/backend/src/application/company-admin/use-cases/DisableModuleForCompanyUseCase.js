"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DisableModuleForCompanyUseCase = void 0;
const ApiError_1 = require("../../../api/errors/ApiError");
class DisableModuleForCompanyUseCase {
    constructor(companyRepository, companyModuleRepository) {
        this.companyRepository = companyRepository;
        this.companyModuleRepository = companyModuleRepository;
    }
    async execute(input) {
        const moduleName = String(input.moduleName || '').trim().toLowerCase();
        if (!input.companyId || !moduleName) {
            throw ApiError_1.ApiError.badRequest("Missing required fields");
        }
        const company = await this.companyRepository.findById(input.companyId);
        if (!company) {
            throw ApiError_1.ApiError.notFound("Company not found");
        }
        if (moduleName === 'core') {
            throw ApiError_1.ApiError.forbidden("Cannot disable core module");
        }
        const moduleState = await this.companyModuleRepository.get(input.companyId, moduleName);
        if (!moduleState || !moduleState.isEnabled) {
            throw ApiError_1.ApiError.badRequest("Module is not enabled for this company");
        }
        await this.companyModuleRepository.update(input.companyId, moduleName, {
            isEnabled: false,
            updatedAt: new Date(),
        });
        return { moduleName, status: 'disabled' };
    }
}
exports.DisableModuleForCompanyUseCase = DisableModuleForCompanyUseCase;
//# sourceMappingURL=DisableModuleForCompanyUseCase.js.map