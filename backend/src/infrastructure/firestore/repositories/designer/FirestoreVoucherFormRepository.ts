/**
 * FirestoreVoucherFormRepository.ts
 * 
 * Firestore implementation of IVoucherFormRepository
 * 
 * Modular Path: companies/{companyId}/{module}/Settings/voucherForms/{formId}
 */

import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { 
  IVoucherFormRepository, 
  VoucherFormDefinition 
} from '../../../../repository/interfaces/designer/IVoucherFormRepository';
import { InfrastructureError } from '../../../errors/InfrastructureError';
import { dedupeVoucherForms } from '../../../../domain/designer/services/VoucherFormDeduper';

export class FirestoreVoucherFormRepository implements IVoucherFormRepository {
  constructor(private db: admin.firestore.Firestore) {}

  private static readonly MODULES = ['accounting', 'sales', 'purchase', 'purchases', 'inventory', 'sales_module'];

  private getCollection(companyId: string, moduleName?: string) {
    const baseModule = (moduleName || 'ACCOUNTING').toLowerCase();
    
    // Standard modular pattern: companies/{id}/{module}/Settings/voucherForms
    return this.db
      .collection('companies')
      .doc(companyId)
      .collection(baseModule)
      .doc('Settings')
      .collection('voucherForms');
  }

  private toDomain(data: any): VoucherFormDefinition {
    return {
      id: data.id,
      companyId: data.companyId,
      module: data.module || 'ACCOUNTING',
      typeId: data.typeId,
      name: data.name,
      code: data.code,
      description: data.description || null,
      prefix: data.prefix || null,
      numberFormat: data.numberFormat || null,
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
      sidebarGroup: data.sidebarGroup || null,
      createdAt: data.createdAt?.toDate?.() || data.createdAt || new Date(),
      updatedAt: data.updatedAt?.toDate?.() || data.updatedAt || new Date(),
      createdBy: data.createdBy || null
    };
  }

  private toPersistence(form: VoucherFormDefinition): any {
    return {
      id: form.id,
      companyId: form.companyId,
      module: form.module || 'ACCOUNTING',
      typeId: form.typeId,
      name: form.name,
      code: form.code,
      description: form.description || null,
      prefix: form.prefix || null,
      numberFormat: form.numberFormat || null,
      isDefault: form.isDefault,
      isSystemGenerated: form.isSystemGenerated,
      isLocked: form.isLocked,
      enabled: form.enabled,
      headerFields: this.stripUndefinedDeep(form.headerFields || []),
      tableColumns: this.stripUndefinedDeep(form.tableColumns || []),
      layout: this.stripUndefinedDeep(form.layout || {}),
      uiModeOverrides: this.stripUndefinedDeep(form.uiModeOverrides || null),
      rules: this.stripUndefinedDeep(form.rules || []),
      actions: this.stripUndefinedDeep(form.actions || []),
      isMultiLine: form.isMultiLine ?? true,
      tableStyle: form.tableStyle || 'web',
      defaultCurrency: form.defaultCurrency || null,
      baseType: form.baseType || null,
      sidebarGroup: form.sidebarGroup || null,
      createdAt: form.createdAt || FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      createdBy: form.createdBy || null
    };
  }

  private stripUndefinedDeep<T>(value: T): T {
    if (Array.isArray(value)) {
      const cleaned = value
        .map((item) => this.stripUndefinedDeep(item))
        .filter((item) => item !== undefined);
      return cleaned as unknown as T;
    }

    if (value && typeof value === 'object') {
      const proto = Object.getPrototypeOf(value);
      if (proto === Object.prototype || proto === null) {
        const cleaned: Record<string, any> = {};
        for (const [key, raw] of Object.entries(value as Record<string, any>)) {
          if (raw === undefined) continue;
          cleaned[key] = this.stripUndefinedDeep(raw);
        }
        return cleaned as unknown as T;
      }
    }

    return value;
  }

  async create(form: VoucherFormDefinition): Promise<VoucherFormDefinition> {
    try {
      const data = this.toPersistence(form);
      await this.getCollection(form.companyId, form.module).doc(form.id).set(data);
      return form;
    } catch (error) {
      throw new InfrastructureError('Error creating voucher form', error);
    }
  }

  async getById(companyId: string, formId: string): Promise<VoucherFormDefinition | null> {
    try {
      for (const mod of FirestoreVoucherFormRepository.MODULES) {
        let doc = await this.getCollection(companyId, mod).doc(formId).get();
        if (doc.exists) {
          return this.toDomain({ ...doc.data(), id: doc.id });
        }
      }

      return null;
    } catch (error) {
      throw new InfrastructureError('Error getting voucher form by ID', error);
    }
  }

  async getByTypeId(companyId: string, typeId: string): Promise<VoucherFormDefinition[]> {
    try {
      const allForms: VoucherFormDefinition[] = [];
      
      for (const mod of FirestoreVoucherFormRepository.MODULES) {
        const snapshot = await this.getCollection(companyId, mod)
          .where('typeId', '==', typeId)
          .get();
        
        snapshot.docs.forEach(doc => {
          allForms.push(this.toDomain({ ...doc.data(), id: doc.id }));
        });
      }

      return allForms;
    } catch (error) {
      throw new InfrastructureError('Error getting voucher forms by type', error);
    }
  }

  async getDefaultForType(companyId: string, typeId: string): Promise<VoucherFormDefinition | null> {
    try {
      for (const mod of FirestoreVoucherFormRepository.MODULES) {
        const snapshot = await this.getCollection(companyId, mod)
          .where('typeId', '==', typeId)
          .where('isDefault', '==', true)
          .limit(1)
          .get();
        
        if (!snapshot.empty) return this.toDomain({ ...snapshot.docs[0].data(), id: snapshot.docs[0].id });
      }

      return null;
    } catch (error) {
      throw new InfrastructureError('Error getting default voucher form', error);
    }
  }

  async getAllByCompany(companyId: string): Promise<VoucherFormDefinition[]> {
    try {
      const companyForms: VoucherFormDefinition[] = [];
      
      for (const mod of FirestoreVoucherFormRepository.MODULES) {
        const snapshot = await this.getCollection(companyId, mod).get();
        snapshot.docs.forEach(doc => {
          companyForms.push(this.toDomain({ ...doc.data(), id: doc.id }));
        });
      }

      return dedupeVoucherForms(companyForms);
    } catch (error) {
      throw new InfrastructureError('Error getting all voucher forms', error);
    }
  }

  async update(companyId: string, formId: string, updates: Partial<VoucherFormDefinition>): Promise<void> {
    try {
      // Find where it is first
      let targetRef: admin.firestore.DocumentReference | null = null;
      
      for (const mod of FirestoreVoucherFormRepository.MODULES) {
        const ref = this.getCollection(companyId, mod).doc(formId);
        const doc = await ref.get();
        if (doc.exists) {
          targetRef = ref;
          break;
        }
      }

      if (!targetRef) {
          // If it doesn't exist, we fallback to default module or module specified in updates
          targetRef = this.getCollection(companyId, updates.module).doc(formId);
      }
      
      const cleanUpdates: any = { ...updates };
      delete cleanUpdates.id;
      delete cleanUpdates.companyId;
      cleanUpdates.updatedAt = FieldValue.serverTimestamp();
      
      Object.keys(cleanUpdates).forEach(key => {
        if (cleanUpdates[key] === undefined) {
          delete cleanUpdates[key];
        } else {
          cleanUpdates[key] = this.stripUndefinedDeep(cleanUpdates[key]);
        }
      });
      
      await targetRef.set(cleanUpdates, { merge: true });
    } catch (error) {
      throw new InfrastructureError('Error updating voucher form', error);
    }
  }

  async delete(companyId: string, formId: string): Promise<void> {
    try {
      for (const mod of FirestoreVoucherFormRepository.MODULES) {
        const ref = this.getCollection(companyId, mod).doc(formId);
        const doc = await ref.get();
        if (doc.exists) {
          await ref.delete();
          return;
        }
      }
    } catch (error) {
      throw new InfrastructureError('Error deleting voucher form', error);
    }
  }
}
