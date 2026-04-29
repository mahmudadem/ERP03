"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DisableCapabilityForCompanyUseCase = void 0;
const ApiError_1 = require("../../../api/errors/ApiError");
class DisableCapabilityForCompanyUseCase {
    constructor(companyRepository, capabilityRepository) {
        this.companyRepository = companyRepository;
        this.capabilityRepository = capabilityRepository;
    }
    async execute(input) {
        const capabilityCode = String(input.capabilityCode || '').trim().toLowerCase();
        if (!input.companyId || !capabilityCode) {
            throw ApiError_1.ApiError.badRequest('Missing required fields');
        }
        const company = await this.companyRepository.findById(input.companyId);
        if (!company) {
            throw ApiError_1.ApiError.notFound('Company not found');
        }
        const capabilityState = await this.capabilityRepository.getByCompanyAndCapability(input.companyId, capabilityCode);
        if (!capabilityState || !capabilityState.isEnabled) {
            throw ApiError_1.ApiError.badRequest('Capability is not enabled for this company');
        }
        await this.capabilityRepository.setEnabled(input.companyId, capabilityCode, false);
        return { capabilityCode, status: 'disabled' };
    }
}
exports.DisableCapabilityForCompanyUseCase = DisableCapabilityForCompanyUseCase;
//# sourceMappingURL=DisableCapabilityForCompanyUseCase.js.map