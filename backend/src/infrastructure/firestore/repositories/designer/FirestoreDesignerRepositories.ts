
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
   * Get company-specific voucher types collection
   */
  private getCollection(companyId: string) {
    // MODULAR PATTERN: companies/{id}/accounting (coll) -> Settings (doc) -> voucher_types (coll)
    return this.db
      .collection('companies')
      .doc(companyId)
      .collection('accounting')
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
    // ... (keep existing implementation)
    VoucherTypeDefinitionValidator.validate(def);
    
    const data = this.toPersistence(def);
    
    // System templates go to top-level collection, company templates go to subcollection
    if (def.companyId === FirestoreVoucherTypeDefinitionRepository.SYSTEM_COMPANY_ID) {
      await this.getSystemCollection().doc(def.id).set(data);
    } else {
      // Save to modular location only
      await this.getCollection(def.companyId).doc(def.id).set(data);
    }
  }

  async updateVoucherType(companyId: string, id: string, data: Partial<VoucherTypeDefinition>): Promise<void> {
    // STEP 3 ENFORCEMENT: For full updates, validate if data is complete definition
    if (data as VoucherTypeDefinition) {
      try {
        VoucherTypeDefinitionValidator.validate(data as VoucherTypeDefinition);
      } catch (error) {
        // If it's a partial update, skip validation (updating single field like layout)
        console.warn('Partial update detected, skipping full validation');
      }
    }
    
    if (companyId === FirestoreVoucherTypeDefinitionRepository.SYSTEM_COMPANY_ID) {
      await this.getSystemCollection().doc(id).update(data);
    } else {
      await this.getCollection(companyId).doc(id).update(data);
    }
  }

  async getVoucherType(companyId: string, id: string): Promise<VoucherTypeDefinition | null> {
    const doc = await this.getCollection(companyId).doc(id).get();
    
    if (doc.exists) {
      const definition = this.toDomain(doc.data());
      try {
        VoucherTypeDefinitionValidator.validate(definition);
        return definition;
      } catch (error: any) {
        console.error(`[VOUCHER_DEF_LOAD_ERROR] Failed to load company voucher definition`, { id, companyId, error: error.message });
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
    // ... (keep existing implementation for now, or consider merging system templates here too)
    // For System, we must filter because they are all in one list
    if (companyId === FirestoreVoucherTypeDefinitionRepository.SYSTEM_COMPANY_ID) {
        const snap = await this.getSystemCollection().where('module', '==', module).get();
        return snap.docs.map(d => this.toDomain(d.data())).filter(def => {
             try { VoucherTypeDefinitionValidator.validate(def); return true; } catch (e) { return false; }
        });
    }

    // For Company, the collection companies/{id}/accounting/... is IMPLICITLY accounting.
    // We skip the .where('module') check because migrated data might miss the 'module' field.
    const snap = await this.getCollection(companyId).get();
    
    const definitions = snap.docs.map(d => this.toDomain(d.data()));
    
    // STEP 3 ENFORCEMENT: Filter out invalid definitions AND (optimally) filter by module if present,
    // but if module is missing, we assume it belongs (since it's in the accounting folder).
    const companyDefs = definitions.filter(def => {
      try {
        VoucherTypeDefinitionValidator.validate(def);
        // Loose check: If def.module exists, it must match. If missing, assume match.
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
    const snap = companyId === FirestoreVoucherTypeDefinitionRepository.SYSTEM_COMPANY_ID
      ? await this.getSystemCollection().get()
      : await this.getCollection(companyId).get();
    
    const definitions = snap.docs.map(d => this.toDomain(d.data()));
    
    // STEP 3 ENFORCEMENT: Filter out invalid definitions
    const companyDefs = definitions.filter(def => {
      try {
        VoucherTypeDefinitionValidator.validate(def);
        return true;
      } catch (error: any) {
        console.error(`[VOUCHER_DEF_LOAD_ERROR] Excluded invalid definition from company list`, {
          id: def.id,
          name: def.name,
          companyId,
          error: error.message
        });
        return false;
      }
    });

    if (companyId !== FirestoreVoucherTypeDefinitionRepository.SYSTEM_COMPANY_ID) {
      const systemTemplates = await this.getSystemTemplates();
      const companyCodes = new Set(companyDefs.map(d => d.code));
      for (const sysDef of systemTemplates) {
        if (!companyCodes.has(sysDef.code)) {
          companyDefs.push(sysDef);
        }
      }
    }

    return companyDefs;
  }

  async getByCode(companyId: string, code: string): Promise<VoucherTypeDefinition | null> {
    const snap = await this.getCollection(companyId).where('code', '==', code).limit(1).get();

    if (!snap.empty) {
      const definition = this.toDomain(snap.docs[0].data());
      try {
        VoucherTypeDefinitionValidator.validate(definition);
        return definition;
      } catch (error: any) {
        console.error(`[VOUCHER_DEF_LOAD_ERROR] Failed to load company voucher definition by code`, { code, companyId, error: error.message });
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
    const snap = companyId === FirestoreVoucherTypeDefinitionRepository.SYSTEM_COMPANY_ID
      ? await this.getSystemCollection().where('code', '==', code).limit(1).get()
      : await this.getCollection(companyId).where('code', '==', code).limit(1).get();

    if (!snap.empty) {
      await snap.docs[0].ref.update({ layout });
    }
  }

  async getSystemTemplates(): Promise<VoucherTypeDefinition[]> {
    const snap = await this.getSystemCollection().get();
    const definitions = snap.docs.map(d => this.toDomain(d.data()));
    
    // STEP 3 ENFORCEMENT: Filter out invalid system templates
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
    if (companyId === FirestoreVoucherTypeDefinitionRepository.SYSTEM_COMPANY_ID) {
      await this.getSystemCollection().doc(id).delete();
    } else {
      await this.getCollection(companyId).doc(id).delete();
    }
  }
}
