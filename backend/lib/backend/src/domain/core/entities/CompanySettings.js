"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompanySettings = void 0;
class CompanySettings {
    constructor(companyId, strictApprovalMode, uiMode, timezone, dateFormat) {
        this.companyId = companyId;
        this.strictApprovalMode = strictApprovalMode;
        this.uiMode = uiMode;
        this.timezone = timezone;
        this.dateFormat = dateFormat;
    }
    // Factory method for default settings
    static default(companyId) {
        return new CompanySettings(companyId, true);
    }
}
exports.CompanySettings = CompanySettings;
//# sourceMappingURL=CompanySettings.js.map