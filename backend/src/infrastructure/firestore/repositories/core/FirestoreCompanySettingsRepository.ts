
import { BaseFirestoreRepository } from '../BaseFirestoreRepository';
import { ICompanySettingsRepository } from '../../../../repository/interfaces/core/ICompanySettingsRepository';
import { CompanySettings } from '../../../../domain/core/entities/CompanySettings';
import { InfrastructureError } from '../../../errors/InfrastructureError';

export class FirestoreCompanySettingsRepository extends BaseFirestoreRepository<CompanySettings> implements ICompanySettingsRepository {
  protected collectionName = 'company_settings';

  protected toDomain(data: any): CompanySettings {
    return new CompanySettings(
      data.companyId,
      data.strictApprovalMode ?? true,
      data.uiMode,
      data.timezone,
      data.dateFormat,
      data.language || 'en'
    );
  }

  protected toPersistence(entity: CompanySettings): any {
    return {
      companyId: entity.companyId,
      strictApprovalMode: entity.strictApprovalMode,
      uiMode: entity.uiMode,
      timezone: entity.timezone,
      dateFormat: entity.dateFormat,
      language: entity.language
    };
  }

  async getSettings(companyId: string): Promise<CompanySettings> {
    try {
      const doc = await this.db.collection(this.collectionName).doc(companyId).get();
      if (!doc.exists) {
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

      await this.db.collection(this.collectionName).doc(companyId).set(updateData, { merge: true });
    } catch (error) {
      throw new InfrastructureError('Failed to update company settings', error);
    }
  }
}
