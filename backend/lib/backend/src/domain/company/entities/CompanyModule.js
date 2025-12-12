"use strict";
/**
 * CompanyModule - Domain Entity
 * Represents an installed module for a specific company with initialization state
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompanyModuleEntity = void 0;
class CompanyModuleEntity {
    constructor(companyId, moduleCode, installedAt, initialized, initializationStatus, config = {}, updatedAt) {
        this.companyId = companyId;
        this.moduleCode = moduleCode;
        this.installedAt = installedAt;
        this.initialized = initialized;
        this.initializationStatus = initializationStatus;
        this.config = config;
        this.updatedAt = updatedAt;
    }
    static create(companyId, moduleCode) {
        return new CompanyModuleEntity(companyId, moduleCode, new Date(), false, 'pending', {});
    }
    markInitialized(config = {}) {
        this.initialized = true;
        this.initializationStatus = 'complete';
        this.config = Object.assign(Object.assign({}, this.config), config);
        this.updatedAt = new Date();
    }
    startInitialization() {
        this.initializationStatus = 'in_progress';
        this.updatedAt = new Date();
    }
}
exports.CompanyModuleEntity = CompanyModuleEntity;
//# sourceMappingURL=CompanyModule.js.map