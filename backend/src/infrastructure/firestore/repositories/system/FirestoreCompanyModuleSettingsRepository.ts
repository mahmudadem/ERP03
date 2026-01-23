import * as admin from 'firebase-admin';
import { ICompanyModuleSettingsRepository, CompanyModuleSettings } from '../../../../repository/interfaces/system/ICompanyModuleSettingsRepository';
import { InfrastructureError } from '../../../errors/InfrastructureError';

export class FirestoreCompanyModuleSettingsRepository implements ICompanyModuleSettingsRepository {
  constructor(private db: admin.firestore.Firestore) {}

  private modularDoc(companyId: string, moduleId: string) {
    // MODULAR PATTERN: companies/{id}/{moduleId} (coll) -> Settings (doc)
    return this.db.collection('companies').doc(companyId).collection(moduleId).doc('Settings');
  }

  async getSettings(companyId: string, moduleId: string): Promise<CompanyModuleSettings | null> {
    try {
      // 1. Try modular structure first: accounting/Settings (doc)
      const doc = await this.modularDoc(companyId, moduleId).get();
      
      if (!doc.exists) return null;
      return doc.data() || null;
    } catch (error) {
      throw new InfrastructureError('Failed to get company module settings', error);
    }
  }

  async saveSettings(companyId: string, moduleId: string, settings: CompanyModuleSettings, userId: string): Promise<void> {
    try {
      const data = {
        ...settings,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: userId,
      };

      // Save to modular location only
      await this.modularDoc(companyId, moduleId).set(data);
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

  async findByCompanyId(companyId: string): Promise<any[]> {
    // This method is now problematic as settings are modularized per subcollection.
    // For now, we return empty or implement a more complex cross-query if needed.
    // Given the architecture, this should probably be refactored at the use-case level.
    return [];
  }

  async create(settings: any): Promise<void> {
    const { companyId, moduleId, ...rest } = settings;
    if (!companyId || !moduleId) throw new InfrastructureError('Invalid settings payload');
    
    const data = { ...rest, updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    
    // Write to modular location only
    await this.modularDoc(companyId, moduleId).set(data, { merge: true });
  }

  async update(companyId: string, moduleId: string, settings: any): Promise<void> {
    const data = { ...settings, updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    
    // Write to modular location only
    await this.modularDoc(companyId, moduleId).set(data, { merge: true });
  }
}
