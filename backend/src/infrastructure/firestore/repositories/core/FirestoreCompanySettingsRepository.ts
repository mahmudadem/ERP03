import { ICompanySettingsRepository } from '../../../../repository/interfaces/core/ICompanySettingsRepository';
import { CompanySettings } from '../../../../domain/core/entities/CompanySettings';
import { InfrastructureError } from '../../../errors/InfrastructureError';
import { SettingsResolver } from '../../../../application/common/services/SettingsResolver';

export class FirestoreCompanySettingsRepository implements ICompanySettingsRepository {
  constructor(private settingsResolver: SettingsResolver) {}

  private getSettingsRef(companyId: string) {
    return this.settingsResolver.getCompanySettingsRef(companyId);
  }

  protected toDomain(data: any): CompanySettings {
    return new CompanySettings(
      data.companyId,
      data.strictApprovalMode ?? true,
      data.uiMode,
      data.timezone,
      data.dateFormat,
      data.language || 'en',
      data.baseCurrency,
      data.fiscalYearStart,
      data.fiscalYearEnd
    );
  }

  protected toPersistence(entity: CompanySettings): any {
    return {
      companyId: entity.companyId,
      strictApprovalMode: entity.strictApprovalMode,
      uiMode: entity.uiMode,
      timezone: entity.timezone,
      dateFormat: entity.dateFormat,
      language: entity.language,
      baseCurrency: entity.baseCurrency,
      fiscalYearStart: entity.fiscalYearStart,
      fiscalYearEnd: entity.fiscalYearEnd
    };
  }

  async getSettings(companyId: string): Promise<CompanySettings> {
    try {
      const doc = await this.getSettingsRef(companyId).get();
      
      if (!doc.exists) {
        // Return default settings without a hardcoded currency if possible, or handle it in the domain
        return CompanySettings.default(companyId);
      }
      return this.toDomain(doc.data());
    } catch (error) {
      throw new InfrastructureError('Failed to get company settings', error);
    }
  }

  async updateSettings(companyId: string, settings: Partial<CompanySettings>): Promise<void> {
    try {
      const updateData = Object.entries(settings).reduce((acc: any, [key, value]) => {
        if (value !== undefined) acc[key] = value;
        return acc;
      }, {});

      if (Object.keys(updateData).length === 0) return;

      // Save strictly to modular location
      await this.getSettingsRef(companyId).set(updateData, { merge: true });
      
    } catch (error) {
      throw new InfrastructureError('Failed to update company settings', error);
    }
  }
}
