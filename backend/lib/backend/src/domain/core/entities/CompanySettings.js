"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompanySettings = void 0;
class CompanySettings {
    constructor(companyId, strictApprovalMode, uiMode, timezone, dateFormat, language = 'en', baseCurrency, fiscalYearStart, // Month-Day string (e.g. "01-01")
    fiscalYearEnd // Month-Day string (e.g. "12-31")
    ) {
        this.companyId = companyId;
        this.strictApprovalMode = strictApprovalMode;
        this.uiMode = uiMode;
        this.timezone = timezone;
        this.dateFormat = dateFormat;
        this.language = language;
        this.baseCurrency = baseCurrency;
        this.fiscalYearStart = fiscalYearStart;
        this.fiscalYearEnd = fiscalYearEnd;
    }
    // Factory method for default settings
    static default(companyId) {
        return new CompanySettings(companyId, false, 'windows', 'UTC', 'YYYY-MM-DD', 'en', undefined, '01-01', '12-31');
    }
}
exports.CompanySettings = CompanySettings;
//# sourceMappingURL=CompanySettings.js.map