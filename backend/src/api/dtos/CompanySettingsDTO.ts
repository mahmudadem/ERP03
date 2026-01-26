
import { CompanySettings } from '../../domain/core/entities/CompanySettings';

export interface CompanySettingsDTO {
  companyId: string;
  strictApprovalMode: boolean;
  uiMode?: string;
  timezone?: string;
  dateFormat?: string;
  language?: string;
  baseCurrency?: string;
  fiscalYearStart?: string;
  fiscalYearEnd?: string;
}

export class CompanySettingsDTOMapper {
  static toDTO(settings: CompanySettings): CompanySettingsDTO {
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
