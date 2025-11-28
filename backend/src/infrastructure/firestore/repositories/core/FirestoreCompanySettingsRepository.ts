
import { BaseFirestoreRepository } from '../BaseFirestoreRepository';
import { ICompanySettingsRepository } from '../../../../repository/interfaces/core/ICompanySettingsRepository';
import { CompanySettings } from '../../../../domain/core/entities/CompanySettings';
import { InfrastructureError } from '../../../errors/InfrastructureError';

export class FirestoreCompanySettingsRepository extends BaseFirestoreRepository<CompanySettings> implements ICompanySettingsRepository {
  protected collectionName = 'company_settings';

  protected toDomain(data: any): CompanySettings {
    return new CompanySettings(
      data.companyId,
      data.strictApprovalMode ?? true
    );
  }

  protected toPersistence(entity: CompanySettings): any {
    return {
      companyId: entity.companyId,
      strictApprovalMode: entity.strictApprovalMode
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
      await this.db.collection(this.collectionName).doc(companyId).set(settings, { merge: true });
    } catch (error) {
      throw new InfrastructureError('Failed to update company settings', error);
    }
  }
}
