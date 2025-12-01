"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompanySettings = void 0;
class CompanySettings {
    constructor(companyId, strictApprovalMode) {
        this.companyId = companyId;
        this.strictApprovalMode = strictApprovalMode;
    }
    // Factory method for default settings
    static default(companyId) {
        return new CompanySettings(companyId, true);
    }
}
exports.CompanySettings = CompanySettings;
//# sourceMappingURL=CompanySettings.js.map