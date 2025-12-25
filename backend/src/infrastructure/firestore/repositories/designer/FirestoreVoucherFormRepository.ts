/**
 * FirestoreVoucherFormRepository.ts
 * 
 * Firestore implementation of IVoucherFormRepository
 * 
 * Storage: companies/{companyId}/voucherForms/{formId}
 */

import * as admin from 'firebase-admin';
import { 
  IVoucherFormRepository, 
  VoucherFormDefinition 
} from '../../../../repository/interfaces/designer/IVoucherFormRepository';
import { InfrastructureError } from '../../../errors/InfrastructureError';

export class FirestoreVoucherFormRepository implements IVoucherFormRepository {
  constructor(private db: admin.firestore.Firestore) {}

  private getCollection(companyId: string) {
    return this.db.collection('companies').doc(companyId).collection('voucherForms');
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
      defaultCurrency: form.defaultCurrency || null,
      baseType: form.baseType || null,
      createdAt: form.createdAt || admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: form.createdBy || null
    };
  }

  async create(form: VoucherFormDefinition): Promise<VoucherFormDefinition> {
    try {
      const ref = this.getCollection(form.companyId).doc(form.id);
      const data = this.toPersistence(form);
      await ref.set(data);
      return form;
    } catch (error) {
      throw new InfrastructureError('Error creating voucher form', error);
    }
  }

  async getById(companyId: string, formId: string): Promise<VoucherFormDefinition | null> {
    try {
      const doc = await this.getCollection(companyId).doc(formId).get();
      if (!doc.exists) return null;
      return this.toDomain(doc.data());
    } catch (error) {
      throw new InfrastructureError('Error getting voucher form by ID', error);
    }
  }

  async getByTypeId(companyId: string, typeId: string): Promise<VoucherFormDefinition[]> {
    try {
      const snapshot = await this.getCollection(companyId)
        .where('typeId', '==', typeId)
        .get();
      return snapshot.docs.map(doc => this.toDomain(doc.data()));
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
      if (snapshot.empty) return null;
      return this.toDomain(snapshot.docs[0].data());
    } catch (error) {
      throw new InfrastructureError('Error getting default voucher form', error);
    }
  }

  async getAllByCompany(companyId: string): Promise<VoucherFormDefinition[]> {
    try {
      const snapshot = await this.getCollection(companyId).get();
      return snapshot.docs.map(doc => this.toDomain(doc.data()));
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
      cleanUpdates.updatedAt = admin.firestore.FieldValue.serverTimestamp();
      
      // Remove undefined values
      Object.keys(cleanUpdates).forEach(key => {
        if (cleanUpdates[key] === undefined) {
          delete cleanUpdates[key];
        }
      });
      
      // Use set with merge to create if doesn't exist, update if it does
      await ref.set(cleanUpdates, { merge: true });
    } catch (error: any) {
      console.error('❌ Firestore update error details:', {
        formId,
        companyId,
        updates,
        error: error.message,
        code: error.code,
        details: error.details
      });
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
