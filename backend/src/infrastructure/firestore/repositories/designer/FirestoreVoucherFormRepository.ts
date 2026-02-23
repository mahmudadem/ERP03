/**
 * FirestoreVoucherFormRepository.ts
 * 
 * Firestore implementation of IVoucherFormRepository
 * 
 * Storage: companies/{companyId}/voucherForms/{formId}
 */

import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { 
  IVoucherFormRepository, 
  VoucherFormDefinition 
} from '../../../../repository/interfaces/designer/IVoucherFormRepository';
import { InfrastructureError } from '../../../errors/InfrastructureError';

export class FirestoreVoucherFormRepository implements IVoucherFormRepository {
  constructor(private db: admin.firestore.Firestore) {}

  private getCollection(companyId: string) {
    // MODULAR PATTERN: companies/{id}/accounting (coll) -> Settings (doc) -> voucherForms (coll)
    return this.db
      .collection('companies')
      .doc(companyId)
      .collection('accounting')
      .doc('Settings')
      .collection('voucherForms');
  }

  private toDomain(data: any): VoucherFormDefinition {
    return {
      id: data.id,
      companyId: data.companyId,
      typeId: data.typeId,
      name: data.name,
      code: data.code,
      description: data.description || null,
      prefix: data.prefix || null,
      isDefault: data.isDefault ?? false,
      isSystemGenerated: data.isSystemGenerated ?? false,
      isLocked: data.isLocked ?? false,
      enabled: data.enabled ?? true,
      headerFields: data.headerFields || [],
      tableColumns: data.tableColumns || [],
      layout: data.layout || {},
      uiModeOverrides: data.uiModeOverrides || null,
      rules: data.rules || [],
      actions: data.actions || [],
      isMultiLine: data.isMultiLine ?? true,
      tableStyle: data.tableStyle || 'web',
      defaultCurrency: data.defaultCurrency || null,
      baseType: data.baseType || null,
      createdAt: data.createdAt?.toDate?.() || data.createdAt || new Date(),
      updatedAt: data.updatedAt?.toDate?.() || data.updatedAt || new Date(),
      createdBy: data.createdBy || null
    };
  }

  private toPersistence(form: VoucherFormDefinition): any {
    return {
      id: form.id,
      companyId: form.companyId,
      typeId: form.typeId,
      name: form.name,
      code: form.code,
      description: form.description || null,
      prefix: form.prefix || null,
      isDefault: form.isDefault,
      isSystemGenerated: form.isSystemGenerated,
      isLocked: form.isLocked,
      enabled: form.enabled,
      headerFields: form.headerFields,
      tableColumns: form.tableColumns,
      layout: form.layout || {},
      uiModeOverrides: form.uiModeOverrides || null,
      rules: form.rules || [],
      actions: form.actions || [],
      isMultiLine: form.isMultiLine ?? true,
      tableStyle: form.tableStyle || 'web',
      defaultCurrency: form.defaultCurrency || null,
      baseType: form.baseType || null,
      createdAt: form.createdAt || FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      createdBy: form.createdBy || null
    };
  }

  private static readonly SYSTEM_COMPANY_ID = 'SYSTEM';
  private static readonly SYSTEM_COLLECTION_NAME = 'voucher_types';
  private static readonly SYSTEM_METADATA_COLLECTION = 'system_metadata';

  private getSystemCollection() {
    return this.db.collection(FirestoreVoucherFormRepository.SYSTEM_METADATA_COLLECTION)
      .doc(FirestoreVoucherFormRepository.SYSTEM_COLLECTION_NAME)
      .collection('items');
  }

  async create(form: VoucherFormDefinition): Promise<VoucherFormDefinition> {
    try {
      const data = this.toPersistence(form);
      await this.getCollection(form.companyId).doc(form.id).set(data);
      return form;
    } catch (error) {
      throw new InfrastructureError('Error creating voucher form', error);
    }
  }

  async getById(companyId: string, formId: string): Promise<VoucherFormDefinition | null> {
    try {
      let doc = await this.getCollection(companyId).doc(formId).get();
      
      if (doc.exists) {
        return this.toDomain(doc.data());
      }

      // Fallback to SYSTEM templates if not found in company collection
      // Many system templates use their code/id interchangeably (e.g. fx_revaluation)
      const systemDoc = await this.getSystemCollection().doc(formId).get();
      if (systemDoc.exists) {
        const sysData = systemDoc.data()!;
        // Map VoucherTypeDefinition to VoucherFormDefinition
        return this.toDomain({
          ...sysData,
          typeId: sysData.code || sysData.id,
          isSystemGenerated: true
        });
      }

      return null;
    } catch (error) {
      throw new InfrastructureError('Error getting voucher form by ID', error);
    }
  }

  async getByTypeId(companyId: string, typeId: string): Promise<VoucherFormDefinition[]> {
    try {
      const snapshot = await this.getCollection(companyId)
        .where('typeId', '==', typeId)
        .get();
      
      const forms = snapshot.docs.map(doc => this.toDomain(doc.data()));

      // If no company forms found for this type, check system
      if (forms.length === 0) {
        const systemSnapshot = await this.getSystemCollection()
          .where('code', '==', typeId)
          .get();
        
        systemSnapshot.docs.forEach(doc => {
          const sysData = doc.data();
          forms.push(this.toDomain({
            ...sysData,
            typeId: sysData.code || sysData.id,
            isSystemGenerated: true
          }));
        });
      }

      return forms;
    } catch (error) {
      throw new InfrastructureError('Error getting voucher forms by type', error);
    }
  }

  async getDefaultForType(companyId: string, typeId: string): Promise<VoucherFormDefinition | null> {
    try {
      const snapshot = await this.getCollection(companyId)
        .where('typeId', '==', typeId)
        .where('isDefault', '==', true)
        .limit(1)
        .get();
      
      if (!snapshot.empty) return this.toDomain(snapshot.docs[0].data());

      // Fallback to system default
      const systemSnapshot = await this.getSystemCollection()
        .where('code', '==', typeId)
        .limit(1)
        .get();
      
      if (!systemSnapshot.empty) {
        const sysData = systemSnapshot.docs[0].data();
        return this.toDomain({
          ...sysData,
          typeId: sysData.code || sysData.id,
          isDefault: true,
          isSystemGenerated: true
        });
      }

      return null;
    } catch (error) {
      throw new InfrastructureError('Error getting default voucher form', error);
    }
  }

  async getAllByCompany(companyId: string): Promise<VoucherFormDefinition[]> {
    try {
      const snapshot = await this.getCollection(companyId).get();
      const companyForms = snapshot.docs.map(doc => this.toDomain(doc.data()));

      // Merge with system templates
      const systemSnapshot = await this.getSystemCollection().get();
      const companyCodes = new Set(companyForms.map(f => f.code));

      for (const doc of systemSnapshot.docs) {
        const sysData = doc.data();
        if (!companyCodes.has(sysData.code)) {
          companyForms.push(this.toDomain({
            ...sysData,
            typeId: sysData.code || sysData.id,
            isSystemGenerated: true
          }));
        }
      }

      return companyForms;
    } catch (error) {
      throw new InfrastructureError('Error getting all voucher forms', error);
    }
  }

  async update(companyId: string, formId: string, updates: Partial<VoucherFormDefinition>): Promise<void> {
    try {
      const ref = this.getCollection(companyId).doc(formId);
      const cleanUpdates: any = { ...updates };
      delete cleanUpdates.id;
      delete cleanUpdates.companyId;
      cleanUpdates.updatedAt = FieldValue.serverTimestamp();
      
      Object.keys(cleanUpdates).forEach(key => {
        if (cleanUpdates[key] === undefined) {
          delete cleanUpdates[key];
        }
      });
      
      await ref.set(cleanUpdates, { merge: true });
    } catch (error) {
      throw new InfrastructureError('Error updating voucher form', error);
    }
  }

  async delete(companyId: string, formId: string): Promise<void> {
    try {
      await this.getCollection(companyId).doc(formId).delete();
    } catch (error) {
      throw new InfrastructureError('Error deleting voucher form', error);
    }
  }
}
