import * as admin from 'firebase-admin';
import { ICompanyWizardTemplateRepository } from '../../../../repository/interfaces/company-wizard/ICompanyWizardTemplateRepository';
import { CompanyWizardTemplate, CompanyWizardStep } from '../../../../domain/company-wizard';
import { InfrastructureError } from '../../../errors/InfrastructureError';

export class FirestoreCompanyWizardTemplateRepository implements ICompanyWizardTemplateRepository {
  private collectionName = 'system_company_wizard_templates';

  constructor(private db: admin.firestore.Firestore) {}

  private mapStep(step: any): CompanyWizardStep {
    return {
      id: step.id,
      titleEn: step.titleEn,
      titleAr: step.titleAr,
      titleTr: step.titleTr,
      order: step.order,
      modelKey: step.modelKey ?? null,
      fields: Array.isArray(step.fields) ? step.fields.map((f: any) => ({
        id: f.id,
        labelEn: f.labelEn,
        labelAr: f.labelAr,
        labelTr: f.labelTr,
        type: f.type,
        required: !!f.required,
        optionsSource: f.optionsSource
      })) : []
    };
  }

  private mapDoc(doc: admin.firestore.DocumentSnapshot): CompanyWizardTemplate {
    const data = doc.data() || {};
    return {
      id: data.id || doc.id,
      name: data.name,
      models: data.models || [],
      steps: Array.isArray(data.steps) ? data.steps.map((s: any) => this.mapStep(s)) : [],
      isDefault: !!data.isDefault
    };
  }

  async getDefaultTemplateForModel(model: string): Promise<CompanyWizardTemplate | null> {
    try {
      const snapshot = await this.db.collection(this.collectionName)
        .where('models', 'array-contains', model)
        .where('isDefault', '==', true)
        .limit(1)
        .get();

      if (snapshot.empty) return null;
      return this.mapDoc(snapshot.docs[0]);
    } catch (error) {
      throw new InfrastructureError('Failed to load default company wizard template', error);
    }
  }

  async getById(id: string): Promise<CompanyWizardTemplate | null> {
    try {
      const doc = await this.db.collection(this.collectionName).doc(id).get();
      if (!doc.exists) return null;
      return this.mapDoc(doc);
    } catch (error) {
      throw new InfrastructureError('Failed to load company wizard template', error);
    }
  }

  async listAll(): Promise<CompanyWizardTemplate[]> {
    try {
      const snapshot = await this.db.collection(this.collectionName).get();
      return snapshot.docs.map((doc) => this.mapDoc(doc));
    } catch (error) {
      throw new InfrastructureError('Failed to list company wizard templates', error);
    }
  }
}
