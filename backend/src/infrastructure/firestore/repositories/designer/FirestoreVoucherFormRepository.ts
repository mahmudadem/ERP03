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
      sidebarGroup: form.sidebarGroup || null,
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

  private toSystemDomain(data: any): VoucherFormDefinition {
    return this.toDomain({
      ...data,
      typeId: data.code || data.id,
      isSystemGenerated: true
    });
  }

  private mergeMissingSystemForms(
    companyForms: VoucherFormDefinition[],
    systemForms: VoucherFormDefinition[]
  ): VoucherFormDefinition[] {
    const normalize = (value: unknown) => String(value || '').trim().toLowerCase();
    const seenKeys = new Set<string>();

    companyForms.forEach((form) => {
      [form.id, form.code, form.typeId].forEach((value) => {
        const key = normalize(value);
        if (key) seenKeys.add(key);
      });
    });

    const merged = [...companyForms];

    for (const form of systemForms) {
      const candidateKeys = [form.id, form.code, form.typeId]
        .map((value) => normalize(value))
        .filter(Boolean);

      if (candidateKeys.some((key) => seenKeys.has(key))) {
        continue;
      }

      merged.push(form);
      candidateKeys.forEach((key) => seenKeys.add(key));
    }

    return merged;
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

      // Fallback to SYSTEM templates if not found in company collection
      const systemDoc = await this.getSystemCollection().doc(formId).get();
      if (systemDoc.exists) {
        return this.toSystemDomain({ ...systemDoc.data(), id: systemDoc.id });
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

      // If no company forms found for this type, check system
      if (allForms.length === 0) {
        const systemSnapshot = await this.getSystemCollection()
          .where('code', '==', typeId)
          .get();
        
        systemSnapshot.docs.forEach(doc => {
          allForms.push(this.toSystemDomain({ ...doc.data(), id: doc.id }));
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

      // Fallback to system default
      const systemSnapshot = await this.getSystemCollection()
        .where('code', '==', typeId)
        .limit(1)
        .get();
      
      if (!systemSnapshot.empty) {
        return this.toDomain({
          ...systemSnapshot.docs[0].data(),
          id: systemSnapshot.docs[0].id,
          typeId: systemSnapshot.docs[0].data().code || systemSnapshot.docs[0].id,
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
      const companyForms: VoucherFormDefinition[] = [];
      
      for (const mod of FirestoreVoucherFormRepository.MODULES) {
        const snapshot = await this.getCollection(companyId, mod).get();
        snapshot.docs.forEach(doc => {
          companyForms.push(this.toDomain({ ...doc.data(), id: doc.id }));
        });
      }

      const systemSnapshot = await this.getSystemCollection().get();
      const systemForms = systemSnapshot.docs.map(doc => this.toSystemDomain({ ...doc.data(), id: doc.id }));

      return this.mergeMissingSystemForms(companyForms, systemForms);
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
