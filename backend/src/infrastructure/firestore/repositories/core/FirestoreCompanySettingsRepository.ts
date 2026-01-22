
import { BaseFirestoreRepository } from '../BaseFirestoreRepository';
import { ICompanySettingsRepository } from '../../../../repository/interfaces/core/ICompanySettingsRepository';
import { CompanySettings } from '../../../../domain/core/entities/CompanySettings';
import { InfrastructureError } from '../../../errors/InfrastructureError';

export class FirestoreCompanySettingsRepository extends BaseFirestoreRepository<CompanySettings> implements ICompanySettingsRepository {
  // NEW PATTERN: companies/{id}/Settings/company
  protected collectionName = 'company_settings'; // Keep for backward compat only

  private getNewSettingsRef(companyId: string) {
    return this.db.collection('companies').doc(companyId).collection('Settings').doc('company');
  }

  private getOldSettingsRef(companyId: string) {
    return this.db.collection('company_settings').doc(companyId);
  }

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
      // Try new structure first
      let doc = await this.getNewSettingsRef(companyId).get();
      
      if (!doc.exists) {
        // Fallback to old structure
        console.warn(`[CompanySettings] Settings not found in Settings/company, falling back to company_settings collection`);
        doc = await this.getOldSettingsRef(companyId).get();
      }
      
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

      // Save to NEW location: companies/{id}/Settings/company
      await this.getNewSettingsRef(companyId).set(updateData, { merge: true });
      
      // DUAL-WRITE during migration: also save to old location for backward compatibility
      // TODO: Remove this after migration is complete
      await this.getOldSettingsRef(companyId).set(updateData, { merge: true });
      
      console.log(`[CompanySettings] Saved to Settings/company (and old location for compat)`);
    } catch (error) {
      throw new InfrastructureError('Failed to update company settings', error);
    }
  }
}
