"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompanyCapabilityEntity = void 0;
class CompanyCapabilityEntity {
    constructor(companyId, capabilityId, isEnabled, config = {}, enabledAt, disabledAt, createdAt = new Date(), updatedAt) {
        this.companyId = companyId;
        this.capabilityId = capabilityId;
        this.isEnabled = isEnabled;
        this.config = config;
        this.enabledAt = enabledAt;
        this.disabledAt = disabledAt;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }
    static create(companyId, capabilityId) {
        return new CompanyCapabilityEntity(companyId, capabilityId, false, {}, undefined, undefined, new Date());
    }
    enable() {
        this.isEnabled = true;
        this.enabledAt = new Date();
        this.updatedAt = new Date();
    }
    disable() {
        this.isEnabled = false;
        this.disabledAt = new Date();
        this.updatedAt = new Date();
    }
}
exports.CompanyCapabilityEntity = CompanyCapabilityEntity;
//# sourceMappingURL=CompanyCapability.js.map