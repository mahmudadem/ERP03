"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListCompanyModulesUseCase = void 0;
const ModuleAvailabilityService_1 = require("../../platform/ModuleAvailabilityService");
const ApiError_1 = require("../../../api/errors/ApiError");
class ListCompanyModulesUseCase {
    constructor(companyRepository, companyModuleRepository) {
        this.companyRepository = companyRepository;
        this.companyModuleRepository = companyModuleRepository;
    }
    async execute(input) {
        if (!input.companyId) {
            throw ApiError_1.ApiError.badRequest('Missing companyId');
        }
        const company = await this.companyRepository.findById(input.companyId);
        if (!company) {
            throw ApiError_1.ApiError.notFound('Company not found');
        }
        const companyModuleStates = await this.companyModuleRepository.listByCompany(input.companyId);
        const enabledModuleIds = companyModuleStates.length > 0
            ? companyModuleStates
                .filter((moduleState) => moduleState.isEnabled)
                .map((moduleState) => moduleState.moduleCode)
            : Array.isArray(company === null || company === void 0 ? void 0 : company.modules)
                ? company.modules
                : [];
        const service = ModuleAvailabilityService_1.ModuleAvailabilityService.getInstance();
        const availableInfos = await service.getCompanyAdminAvailableModules(input.companyId, enabledModuleIds);
        return availableInfos.map((info) => {
            var _a, _b, _c, _d, _e, _f;
            return ({
                id: info.moduleId,
                name: ((_a = info.manifest) === null || _a === void 0 ? void 0 : _a.name) || ((_b = info.dbRecord) === null || _b === void 0 ? void 0 : _b.name) || info.moduleId,
                description: ((_c = info.manifest) === null || _c === void 0 ? void 0 : _c.description) || ((_d = info.dbRecord) === null || _d === void 0 ? void 0 : _d.description) || '',
                version: ((_e = info.manifest) === null || _e === void 0 ? void 0 : _e.version) || ((_f = info.dbRecord) === null || _f === void 0 ? void 0 : _f.version) || '1.0.0',
                state: info.state,
                isAvailable: info.state === ModuleAvailabilityService_1.ModuleAvailabilityState.AVAILABLE,
                isEnabled: enabledModuleIds.map((m) => String(m || '').trim().toLowerCase()).includes(info.moduleId),
                enabled: enabledModuleIds.map((m) => String(m || '').trim().toLowerCase()).includes(info.moduleId),
                blockedReason: info.reason,
            });
        });
    }
}
exports.ListCompanyModulesUseCase = ListCompanyModulesUseCase;
//# sourceMappingURL=ListCompanyModulesUseCase.js.map