"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EntitlementServiceAdapter = void 0;
class EntitlementServiceAdapter {
    constructor(companyRepository) {
        this.companyRepository = companyRepository;
    }
    async companyHasModule(companyId, moduleId) {
        const company = await this.companyRepository.findById(companyId);
        if (!company)
            return false;
        const modules = Array.isArray(company.modules) ? company.modules : [];
        return modules
            .map((m) => String(m || '').trim().toLowerCase())
            .filter(Boolean)
            .includes(moduleId.toLowerCase());
    }
    async companyHasCapability(companyId, capabilityId) {
        const moduleId = capabilityId.split('.')[0];
        return this.companyHasModule(companyId, moduleId);
    }
    async getEntitledModules(companyId) {
        const company = await this.companyRepository.findById(companyId);
        if (!company)
            return [];
        const modules = Array.isArray(company.modules) ? company.modules : [];
        return modules
            .map((m) => String(m || '').trim().toLowerCase())
            .filter(Boolean);
    }
    async getEntitledCapabilities(companyId) {
        return [];
    }
    async grantModule(companyId, moduleId, sourceType, sourceId) {
        throw new Error('grantModule not supported in adapter mode');
    }
    async revokeModule(companyId, moduleId) {
        throw new Error('revokeModule not supported in adapter mode');
    }
}
exports.EntitlementServiceAdapter = EntitlementServiceAdapter;
//# sourceMappingURL=EntitlementServiceAdapter.js.map