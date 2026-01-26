"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompanySettingsDTOMapper = void 0;
class CompanySettingsDTOMapper {
    static toDTO(settings) {
        return {
            companyId: settings.companyId,
            strictApprovalMode: settings.strictApprovalMode,
            uiMode: settings.uiMode,
            timezone: settings.timezone,
            dateFormat: settings.dateFormat,
            language: settings.language,
            baseCurrency: settings.baseCurrency,
            fiscalYearStart: settings.fiscalYearStart,
            fiscalYearEnd: settings.fiscalYearEnd
        };
    }
}
exports.CompanySettingsDTOMapper = CompanySettingsDTOMapper;
//# sourceMappingURL=CompanySettingsDTO.js.map