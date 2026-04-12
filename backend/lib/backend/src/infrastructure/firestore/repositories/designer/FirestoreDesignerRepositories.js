"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirestoreVoucherTypeDefinitionRepository = exports.FirestoreFormDefinitionRepository = void 0;
const BaseFirestoreRepository_1 = require("../BaseFirestoreRepository");
const DesignerMappers_1 = require("../../mappers/DesignerMappers");
const VoucherTypeDefinitionValidator_1 = require("../../../../domain/designer/validators/VoucherTypeDefinitionValidator");
class FirestoreFormDefinitionRepository extends BaseFirestoreRepository_1.BaseFirestoreRepository {
    constructor() {
        super(...arguments);
        this.collectionName = 'form_definitions';
        this.toDomain = DesignerMappers_1.FormDefinitionMapper.toDomain;
        this.toPersistence = DesignerMappers_1.FormDefinitionMapper.toPersistence;
    }
    async createFormDefinition(def) { return this.save(def); }
    async updateFormDefinition(id, data) { await this.db.collection(this.collectionName).doc(id).update(data); }
    async getFormDefinition(id) { return this.findById(id); }
    async getDefinitionsForModule(module) {
        const snap = await this.db.collection(this.collectionName).where('module', '==', module).get();
        return snap.docs.map(d => this.toDomain(d.data()));
    }
}
exports.FirestoreFormDefinitionRepository = FirestoreFormDefinitionRepository;
class FirestoreVoucherTypeDefinitionRepository extends BaseFirestoreRepository_1.BaseFirestoreRepository {
    constructor() {
        super(...arguments);
        this.collectionName = 'voucher_types'; // Not used directly for subcollections
        this.toDomain = DesignerMappers_1.VoucherTypeDefinitionMapper.toDomain;
        this.toPersistence = DesignerMappers_1.VoucherTypeDefinitionMapper.toPersistence;
    }
    /**
     * Get modular voucher types collection
     */
    getCollection(companyId, moduleName) {
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
    getSystemCollection() {
        return this.db.collection(FirestoreVoucherTypeDefinitionRepository.SYSTEM_METADATA_COLLECTION)
            .doc(FirestoreVoucherTypeDefinitionRepository.SYSTEM_COLLECTION_NAME)
            .collection('items');
    }
    async createVoucherType(def) {
        VoucherTypeDefinitionValidator_1.VoucherTypeDefinitionValidator.validate(def);
        const data = this.toPersistence(def);
        // System templates go to top-level collection, company templates go to subcollection
        if (def.companyId === FirestoreVoucherTypeDefinitionRepository.SYSTEM_COMPANY_ID) {
            await this.getSystemCollection().doc(def.id).set(data);
        }
        else {
            // Save to modular location only
            await this.getCollection(def.companyId, def.module).doc(def.id).set(data);
        }
    }
    async updateVoucherType(companyId, id, data) {
        if (data) {
            try {
                VoucherTypeDefinitionValidator_1.VoucherTypeDefinitionValidator.validate(data);
            }
            catch (error) {
                console.warn('Partial update detected, skipping full validation');
            }
        }
        if (companyId === FirestoreVoucherTypeDefinitionRepository.SYSTEM_COMPANY_ID) {
            await this.getSystemCollection().doc(id).update(data);
        }
        else {
            const moduleName = data.module || 'ACCOUNTING';
            await this.getCollection(companyId, moduleName).doc(id).update(data);
        }
    }
    async getVoucherType(companyId, id) {
        // Try across modules
        const modules = ['accounting', 'sales', 'purchase', 'purchases', 'inventory', 'sales_module'];
        for (const mod of modules) {
            const doc = await this.getCollection(companyId, mod).doc(id).get();
            if (doc.exists) {
                const definition = this.toDomain(doc.data());
                try {
                    VoucherTypeDefinitionValidator_1.VoucherTypeDefinitionValidator.validate(definition);
                    return definition;
                }
                catch (error) {
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
                    VoucherTypeDefinitionValidator_1.VoucherTypeDefinitionValidator.validate(systemDef);
                    return systemDef;
                }
                catch (error) {
                    console.error(`[VOUCHER_DEF_LOAD_ERROR] Failed to load system fallback definition`, { id, error: error.message });
                }
            }
        }
        return null;
    }
    async getVoucherTypesForModule(companyId, module) {
        if (companyId === FirestoreVoucherTypeDefinitionRepository.SYSTEM_COMPANY_ID) {
            const snap = await this.getSystemCollection().where('module', '==', module).get();
            return snap.docs.map(d => this.toDomain(d.data())).filter(def => {
                try {
                    VoucherTypeDefinitionValidator_1.VoucherTypeDefinitionValidator.validate(def);
                    return true;
                }
                catch (e) {
                    return false;
                }
            });
        }
        const snap = await this.getCollection(companyId, module).get();
        const definitions = snap.docs.map(d => this.toDomain(d.data()));
        const companyDefs = definitions.filter(def => {
            try {
                VoucherTypeDefinitionValidator_1.VoucherTypeDefinitionValidator.validate(def);
                if (def.module && def.module !== module)
                    return false;
                return true;
            }
            catch (error) {
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
    async getByCompanyId(companyId) {
        // This is less efficient in modular mode but used for lists
        const modules = ['accounting', 'sales', 'purchase', 'purchases', 'inventory', 'sales_module'];
        const allDefs = [];
        for (const mod of modules) {
            const snap = await this.getCollection(companyId, mod).get();
            const definitions = snap.docs.map(d => this.toDomain(d.data()));
            allDefs.push(...definitions.filter(def => {
                try {
                    VoucherTypeDefinitionValidator_1.VoucherTypeDefinitionValidator.validate(def);
                    return true;
                }
                catch (e) {
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
    async getByCode(companyId, code) {
        const modules = ['accounting', 'sales', 'purchase', 'purchases', 'inventory', 'sales_module'];
        for (const mod of modules) {
            const snap = await this.getCollection(companyId, mod).where('code', '==', code).limit(1).get();
            if (!snap.empty) {
                const definition = this.toDomain(snap.docs[0].data());
                try {
                    VoucherTypeDefinitionValidator_1.VoucherTypeDefinitionValidator.validate(definition);
                    return definition;
                }
                catch (error) {
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
                    VoucherTypeDefinitionValidator_1.VoucherTypeDefinitionValidator.validate(sysDef);
                    return sysDef;
                }
                catch (error) {
                    console.error(`[VOUCHER_DEF_LOAD_ERROR] Failed to load system fallback definition by code`, { code, error: error.message });
                }
            }
        }
        return null;
    }
    async updateLayout(companyId, code, layout) {
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
    async getSystemTemplates() {
        const snap = await this.getSystemCollection().get();
        const definitions = snap.docs.map(d => this.toDomain(d.data()));
        return definitions.filter(def => {
            try {
                VoucherTypeDefinitionValidator_1.VoucherTypeDefinitionValidator.validate(def);
                return true;
            }
            catch (error) {
                console.error(`[VOUCHER_DEF_LOAD_ERROR] Excluded invalid system template`, {
                    id: def.id,
                    name: def.name,
                    error: error.message
                });
                return false;
            }
        });
    }
    async deleteVoucherType(companyId, id) {
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
exports.FirestoreVoucherTypeDefinitionRepository = FirestoreVoucherTypeDefinitionRepository;
FirestoreVoucherTypeDefinitionRepository.SYSTEM_COMPANY_ID = 'SYSTEM';
FirestoreVoucherTypeDefinitionRepository.SYSTEM_COLLECTION_NAME = 'voucher_types';
FirestoreVoucherTypeDefinitionRepository.SYSTEM_METADATA_COLLECTION = 'system_metadata';
//# sourceMappingURL=FirestoreDesignerRepositories.js.map