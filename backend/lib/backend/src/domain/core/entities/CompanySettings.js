"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompanySettings = void 0;
class CompanySettings {
    constructor(companyId, strictApprovalMode, uiMode, timezone, dateFormat, language = 'en') {
        this.companyId = companyId;
        this.strictApprovalMode = strictApprovalMode;
        this.uiMode = uiMode;
        this.timezone = timezone;
        this.dateFormat = dateFormat;
        this.language = language;
    }
    // Factory method for default settings
    static default(companyId) {
        return new CompanySettings(companyId, true, 'windows', 'UTC', 'YYYY-MM-DD', 'en');
    }
}
exports.CompanySettings = CompanySettings;
//# sourceMappingURL=CompanySettings.js.map