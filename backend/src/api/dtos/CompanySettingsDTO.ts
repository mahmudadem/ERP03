
import { CompanySettings } from '../../domain/core/entities/CompanySettings';

export interface CompanySettingsDTO {
  companyId: string;
  strictApprovalMode: boolean;
}

export class CompanySettingsDTOMapper {
  static toDTO(settings: CompanySettings): CompanySettingsDTO {
    return {
      companyId: settings.companyId,
      strictApprovalMode: settings.strictApprovalMode
    };
  }
}
