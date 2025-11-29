import * as admin from 'firebase-admin';
import { ICompanyModuleSettingsRepository, CompanyModuleSettings } from '../../../../repository/interfaces/system/ICompanyModuleSettingsRepository';
import { InfrastructureError } from '../../../errors/InfrastructureError';

export class FirestoreCompanyModuleSettingsRepository implements ICompanyModuleSettingsRepository {
  constructor(private db: admin.firestore.Firestore) {}

  private collection(companyId: string) {
    return this.db.collection('companies').doc(companyId).collection('moduleSettings');
  }

  async getSettings(companyId: string, moduleId: string): Promise<CompanyModuleSettings | null> {
    try {
      const doc = await this.collection(companyId).doc(moduleId).get();
      if (!doc.exists) return null;
      return doc.data() || null;
    } catch (error) {
      throw new InfrastructureError('Failed to get company module settings', error);
    }
  }

  async saveSettings(companyId: string, moduleId: string, settings: CompanyModuleSettings, userId: string): Promise<void> {
    try {
      await this.collection(companyId).doc(moduleId).set({
        ...settings,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: userId,
      });
    } catch (error) {
      throw new InfrastructureError('Failed to save company module settings', error);
    }
  }

  async ensureModuleIsActivated(companyId: string, moduleId: string): Promise<void> {
    try {
      const moduleDoc = await this.db.collection('companies').doc(companyId).collection('modules').doc(moduleId).get();
      if (!moduleDoc.exists) {
        throw new Error('Module not activated for this company');
      }
    } catch (error) {
      throw new InfrastructureError('Failed to verify module activation', error);
    }
  }
}
