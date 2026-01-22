import * as admin from 'firebase-admin';
import { ICompanyModuleSettingsRepository, CompanyModuleSettings } from '../../../../repository/interfaces/system/ICompanyModuleSettingsRepository';
import { InfrastructureError } from '../../../errors/InfrastructureError';

export class FirestoreCompanyModuleSettingsRepository implements ICompanyModuleSettingsRepository {
  constructor(private db: admin.firestore.Firestore) {}

  private collection(companyId: string) {
    // NEW PATTERN: companies/{id}/Settings/{module}
    return this.db.collection('companies').doc(companyId).collection('Settings');
  }

  private oldCollection(companyId: string) {
    // OLD PATTERN (deprecated): companies/{id}/settings/{module}
    return this.db.collection('companies').doc(companyId).collection('settings');
  }

  async getSettings(companyId: string, moduleId: string): Promise<CompanyModuleSettings | null> {
    try {
      // Try new structure first
      let doc = await this.collection(companyId).doc(moduleId).get();
      
      if (!doc.exists) {
        // Fallback to old structure for backward compatibility
        console.warn(`[Settings] Module "${moduleId}" not found in new Settings/ path, falling back to old settings/ path`);
        doc = await this.oldCollection(companyId).doc(moduleId).get();
      }
      
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

  async findByCompanyId(companyId: string): Promise<any[]> {
    const snap = await this.collection(companyId).get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  async create(settings: any): Promise<void> {
    const { companyId, moduleId, ...rest } = settings;
    if (!companyId || !moduleId) throw new InfrastructureError('Invalid settings payload');
    await this.collection(companyId).doc(moduleId).set(rest, { merge: true });
  }

  async update(companyId: string, moduleId: string, settings: any): Promise<void> {
    await this.collection(companyId).doc(moduleId).set(settings, { merge: true });
  }
}
