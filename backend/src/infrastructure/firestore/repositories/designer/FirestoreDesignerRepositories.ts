import { BaseFirestoreRepository } from '../BaseFirestoreRepository';
import { IFormDefinitionRepository, IVoucherTypeDefinitionRepository } from '../../../../repository/interfaces/designer';
import { FormDefinition } from '../../../../domain/designer/entities/FormDefinition';
import { VoucherTypeDefinition } from '../../../../domain/designer/entities/VoucherTypeDefinition';
import { FormDefinitionMapper, VoucherTypeDefinitionMapper } from '../../mappers/DesignerMappers';
import { VoucherTypeDefinitionValidator } from '../../../../domain/designer/validators/VoucherTypeDefinitionValidator';

export class FirestoreFormDefinitionRepository extends BaseFirestoreRepository<FormDefinition> implements IFormDefinitionRepository {
  protected collectionName = 'form_definitions';
  protected toDomain = FormDefinitionMapper.toDomain;
  protected toPersistence = FormDefinitionMapper.toPersistence;

  async createFormDefinition(def: FormDefinition): Promise<void> { return this.save(def); }
  async updateFormDefinition(id: string, data: Partial<FormDefinition>): Promise<void> { await this.db.collection(this.collectionName).doc(id).update(data); }
  async getFormDefinition(id: string): Promise<FormDefinition | null> { return this.findById(id); }
  async getDefinitionsForModule(module: string): Promise<FormDefinition[]> {
    const snap = await this.db.collection(this.collectionName).where('module', '==', module).get();
    return snap.docs.map(d => this.toDomain(d.data()));
  }
}

export class FirestoreVoucherTypeDefinitionRepository extends BaseFirestoreRepository<VoucherTypeDefinition> implements IVoucherTypeDefinitionRepository {
  protected collectionName = 'voucher_types'; // Not used directly for subcollections
  protected toDomain = VoucherTypeDefinitionMapper.toDomain;
  protected toPersistence = VoucherTypeDefinitionMapper.toPersistence;

  private static readonly SYSTEM_COMPANY_ID = 'SYSTEM';
  private static readonly SYSTEM_COLLECTION_NAME = 'voucher_types';
  private static readonly SYSTEM_METADATA_COLLECTION = 'system_metadata';

  /**
   * Get modular voucher types collection
   */
  private getCollection(companyId: string, moduleName?: string) {
    const baseModule = (moduleName || 'ACCOUNTING').toLowerCase();
    // Standard modular pattern: companies/{id}/{module}/Settings/voucher_types
    return this.db
      .collection('companies')
      .doc(companyId)
      .collection(baseModule)
      .doc('Settings')
      .collection('voucher_types');
  }

  /**
   * Get top-level system voucher types collection
   */
  private getSystemCollection() {
    return this.db.collection(FirestoreVoucherTypeDefinitionRepository.SYSTEM_METADATA_COLLECTION)
      .doc(FirestoreVoucherTypeDefinitionRepository.SYSTEM_COLLECTION_NAME)
      .collection('items');
  }

  async createVoucherType(def: VoucherTypeDefinition): Promise<void> {
    VoucherTypeDefinitionValidator.validate(def);
    
    const data = this.toPersistence(def);
    
    // System templates go to top-level collection, company templates go to subcollection
    if (def.companyId === FirestoreVoucherTypeDefinitionRepository.SYSTEM_COMPANY_ID) {
      await this.getSystemCollection().doc(def.id).set(data);
    } else {
      // Save to modular location only
      await this.getCollection(def.companyId, def.module).doc(def.id).set(data);
    }
  }

  async updateVoucherType(companyId: string, id: string, data: Partial<VoucherTypeDefinition>): Promise<void> {
    if (data as VoucherTypeDefinition) {
      try {
        VoucherTypeDefinitionValidator.validate(data as VoucherTypeDefinition);
      } catch (error) {
        console.warn('Partial update detected, skipping full validation');
      }
    }
    
    if (companyId === FirestoreVoucherTypeDefinitionRepository.SYSTEM_COMPANY_ID) {
      await this.getSystemCollection().doc(id).update(data);
    } else {
      const moduleName = data.module || 'ACCOUNTING';
      await this.getCollection(companyId, moduleName).doc(id).update(data);
    }
  }

  async getVoucherType(companyId: string, id: string): Promise<VoucherTypeDefinition | null> {
    // Try across modules
    const modules = ['accounting', 'sales', 'purchase', 'purchases', 'inventory', 'sales_module'];
    for (const mod of modules) {
      const doc = await this.getCollection(companyId, mod).doc(id).get();
      if (doc.exists) {
        const definition = this.toDomain(doc.data());
        try {
          VoucherTypeDefinitionValidator.validate(definition);
          return definition;
        } catch (error: any) {
          console.error(`[VOUCHER_DEF_LOAD_ERROR] Failed to load company voucher definition`, { id, companyId, error: error.message });
        }
      }
    }
    
    // Fallback to SYSTEM
    if (companyId !== FirestoreVoucherTypeDefinitionRepository.SYSTEM_COMPANY_ID) {
      const systemDoc = await this.getSystemCollection().doc(id).get();
      if (systemDoc.exists) {
        const systemDef = this.toDomain(systemDoc.data());
        try {
          VoucherTypeDefinitionValidator.validate(systemDef);
          return systemDef;
        } catch (error: any) {
          console.error(`[VOUCHER_DEF_LOAD_ERROR] Failed to load system fallback definition`, { id, error: error.message });
        }
      }
    }
    
    return null;
  }

  async getVoucherTypesForModule(companyId: string, module: string): Promise<VoucherTypeDefinition[]> {
    if (companyId === FirestoreVoucherTypeDefinitionRepository.SYSTEM_COMPANY_ID) {
        const snap = await this.getSystemCollection().where('module', '==', module).get();
        return snap.docs.map(d => this.toDomain(d.data())).filter(def => {
             try { VoucherTypeDefinitionValidator.validate(def); return true; } catch (e) { return false; }
        });
    }

    const snap = await this.getCollection(companyId, module).get();
    
    const definitions = snap.docs.map(d => this.toDomain(d.data()));
    
    const companyDefs = definitions.filter(def => {
      try {
        VoucherTypeDefinitionValidator.validate(def);
        if (def.module && def.module !== module) return false;
        return true;
      } catch (error: any) {
        console.error(`[VOUCHER_DEF_LOAD_ERROR] Excluded invalid definition from list`, {
          id: def.id,
          name: def.name,
          companyId,
          module,
          error: error.message
        });
        return false;
      }
    });

    // Merge with System templates if not already present
    const systemTemplates = await this.getSystemTemplates();
    const companyCodes = new Set(companyDefs.map(d => d.code));
    
    for (const sysDef of systemTemplates) {
      if (sysDef.module === module && !companyCodes.has(sysDef.code)) {
        companyDefs.push(sysDef);
      }
    }

    return companyDefs;
  }

  async getByCompanyId(companyId: string): Promise<VoucherTypeDefinition[]> {
    // This is less efficient in modular mode but used for lists
    const modules = ['accounting', 'sales', 'purchase', 'purchases', 'inventory', 'sales_module'];
    const allDefs: VoucherTypeDefinition[] = [];
    
    for (const mod of modules) {
      const snap = await this.getCollection(companyId, mod).get();
      const definitions = snap.docs.map(d => this.toDomain(d.data()));
      allDefs.push(...definitions.filter(def => {
        try {
          VoucherTypeDefinitionValidator.validate(def);
          return true;
        } catch (e) {
          return false;
        }
      }));
    }

    if (companyId !== FirestoreVoucherTypeDefinitionRepository.SYSTEM_COMPANY_ID) {
      const systemTemplates = await this.getSystemTemplates();
      const companyCodes = new Set(allDefs.map(d => d.code));
      for (const sysDef of systemTemplates) {
        if (!companyCodes.has(sysDef.code)) {
          allDefs.push(sysDef);
        }
      }
    }

    return allDefs;
  }

  async getByCode(companyId: string, code: string): Promise<VoucherTypeDefinition | null> {
    const modules = ['accounting', 'sales', 'purchase', 'purchases', 'inventory', 'sales_module'];
    for (const mod of modules) {
      const snap = await this.getCollection(companyId, mod).where('code', '==', code).limit(1).get();

      if (!snap.empty) {
        const definition = this.toDomain(snap.docs[0].data());
        try {
          VoucherTypeDefinitionValidator.validate(definition);
          return definition;
        } catch (error: any) {
          console.error(`[VOUCHER_DEF_LOAD_ERROR] Failed to load company voucher definition by code`, { code, companyId, error: error.message });
        }
      }
    }
    
    // Fallback to SYSTEM
    if (companyId !== FirestoreVoucherTypeDefinitionRepository.SYSTEM_COMPANY_ID) {
      const systemSnap = await this.getSystemCollection().where('code', '==', code).limit(1).get();
      if (!systemSnap.empty) {
        const sysDef = this.toDomain(systemSnap.docs[0].data());
        try {
          VoucherTypeDefinitionValidator.validate(sysDef);
          return sysDef;
        } catch (error: any) {
          console.error(`[VOUCHER_DEF_LOAD_ERROR] Failed to load system fallback definition by code`, { code, error: error.message });
        }
      }
    }

    return null;
  }

  async updateLayout(companyId: string, code: string, layout: any): Promise<void> {
    const modules = ['accounting', 'sales', 'purchase', 'purchases', 'inventory', 'sales_module'];
    for (const mod of modules) {
      const snap = companyId === FirestoreVoucherTypeDefinitionRepository.SYSTEM_COMPANY_ID
        ? await this.getSystemCollection().where('code', '==', code).limit(1).get()
        : await this.getCollection(companyId, mod).where('code', '==', code).limit(1).get();

      if (!snap.empty) {
        await snap.docs[0].ref.update({ layout });
        return;
      }
    }
  }

  async getSystemTemplates(): Promise<VoucherTypeDefinition[]> {
    const snap = await this.getSystemCollection().get();
    const definitions = snap.docs.map(d => this.toDomain(d.data()));
    
    return definitions.filter(def => {
      try {
        VoucherTypeDefinitionValidator.validate(def);
        return true;
      } catch (error: any) {
        console.error(`[VOUCHER_DEF_LOAD_ERROR] Excluded invalid system template`, {
          id: def.id,
          name: def.name,
          error: error.message
        });
        return false;
      }
    });
  }

  async deleteVoucherType(companyId: string, id: string): Promise<void> {
    const modules = ['accounting', 'sales', 'purchase', 'purchases', 'inventory', 'sales_module'];
    for (const mod of modules) {
      const doc = await this.getCollection(companyId, mod).doc(id).get();
      if (doc.exists) {
        await doc.ref.delete();
        return;
      }
    }
    
    if (companyId === FirestoreVoucherTypeDefinitionRepository.SYSTEM_COMPANY_ID) {
      await this.getSystemCollection().doc(id).delete();
    }
  }
}
