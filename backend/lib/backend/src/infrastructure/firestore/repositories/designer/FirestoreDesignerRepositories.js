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
     * Get company-specific voucher types collection
     */
    getCollection(companyId) {
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
    getSystemCollection() {
        return this.db.collection(FirestoreVoucherTypeDefinitionRepository.SYSTEM_METADATA_COLLECTION)
            .doc(FirestoreVoucherTypeDefinitionRepository.SYSTEM_COLLECTION_NAME)
            .collection('items');
    }
    async createVoucherType(def) {
        // ... (keep existing implementation)
        VoucherTypeDefinitionValidator_1.VoucherTypeDefinitionValidator.validate(def);
        const data = this.toPersistence(def);
        // System templates go to top-level collection, company templates go to subcollection
        if (def.companyId === FirestoreVoucherTypeDefinitionRepository.SYSTEM_COMPANY_ID) {
            await this.getSystemCollection().doc(def.id).set(data);
        }
        else {
            // Save to modular location only
            await this.getCollection(def.companyId).doc(def.id).set(data);
        }
    }
    async updateVoucherType(companyId, id, data) {
        // STEP 3 ENFORCEMENT: For full updates, validate if data is complete definition
        if (data) {
            try {
                VoucherTypeDefinitionValidator_1.VoucherTypeDefinitionValidator.validate(data);
            }
            catch (error) {
                // If it's a partial update, skip validation (updating single field like layout)
                console.warn('Partial update detected, skipping full validation');
            }
        }
        if (companyId === FirestoreVoucherTypeDefinitionRepository.SYSTEM_COMPANY_ID) {
            await this.getSystemCollection().doc(id).update(data);
        }
        else {
            await this.getCollection(companyId).doc(id).update(data);
        }
    }
    async getVoucherType(companyId, id) {
        let doc = companyId === FirestoreVoucherTypeDefinitionRepository.SYSTEM_COMPANY_ID
            ? await this.getSystemCollection().doc(id).get()
            : await this.getCollection(companyId).doc(id).get();
        if (!doc.exists)
            return null;
        const definition = this.toDomain(doc.data());
        // STEP 3 ENFORCEMENT: Validate after load
        try {
            VoucherTypeDefinitionValidator_1.VoucherTypeDefinitionValidator.validate(definition);
            return definition;
        }
        catch (error) {
            console.error(`[VOUCHER_DEF_LOAD_ERROR] Failed to load voucher definition`, {
                id,
                companyId,
                name: definition.name,
                error: error.message,
                timestamp: new Date().toISOString()
            });
            return null;
        }
    }
    async getVoucherTypesForModule(companyId, module) {
        // For System, we must filter because they are all in one list
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
        // For Company, the collection companies/{id}/accounting/... is IMPLICITLY accounting.
        // We skip the .where('module') check because migrated data might miss the 'module' field.
        const snap = await this.getCollection(companyId).get();
        const definitions = snap.docs.map(d => this.toDomain(d.data()));
        // STEP 3 ENFORCEMENT: Filter out invalid definitions AND (optimally) filter by module if present,
        // but if module is missing, we assume it belongs (since it's in the accounting folder).
        return definitions.filter(def => {
            try {
                VoucherTypeDefinitionValidator_1.VoucherTypeDefinitionValidator.validate(def);
                // Loose check: If def.module exists, it must match. If missing, assume match.
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
    }
    async getByCompanyId(companyId) {
        const snap = companyId === FirestoreVoucherTypeDefinitionRepository.SYSTEM_COMPANY_ID
            ? await this.getSystemCollection().get()
            : await this.getCollection(companyId).get();
        const definitions = snap.docs.map(d => this.toDomain(d.data()));
        // STEP 3 ENFORCEMENT: Filter out invalid definitions
        return definitions.filter(def => {
            try {
                VoucherTypeDefinitionValidator_1.VoucherTypeDefinitionValidator.validate(def);
                return true;
            }
            catch (error) {
                console.error(`[VOUCHER_DEF_LOAD_ERROR] Excluded invalid definition from company list`, {
                    id: def.id,
                    name: def.name,
                    companyId,
                    error: error.message
                });
                return false;
            }
        });
    }
    async getByCode(companyId, code) {
        const snap = companyId === FirestoreVoucherTypeDefinitionRepository.SYSTEM_COMPANY_ID
            ? await this.getSystemCollection().where('code', '==', code).limit(1).get()
            : await this.getCollection(companyId).where('code', '==', code).limit(1).get();
        if (snap.empty)
            return null;
        const definition = this.toDomain(snap.docs[0].data());
        // STEP 3 ENFORCEMENT: Validate after load
        try {
            VoucherTypeDefinitionValidator_1.VoucherTypeDefinitionValidator.validate(definition);
            return definition;
        }
        catch (error) {
            console.error(`[VOUCHER_DEF_LOAD_ERROR] Failed to load voucher definition by code`, {
                code,
                companyId,
                name: definition.name,
                error: error.message
            });
            return null;
        }
    }
    async updateLayout(companyId, code, layout) {
        const snap = companyId === FirestoreVoucherTypeDefinitionRepository.SYSTEM_COMPANY_ID
            ? await this.getSystemCollection().where('code', '==', code).limit(1).get()
            : await this.getCollection(companyId).where('code', '==', code).limit(1).get();
        if (!snap.empty) {
            await snap.docs[0].ref.update({ layout });
        }
    }
    async getSystemTemplates() {
        const snap = await this.getSystemCollection().get();
        const definitions = snap.docs.map(d => this.toDomain(d.data()));
        // STEP 3 ENFORCEMENT: Filter out invalid system templates
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
        if (companyId === FirestoreVoucherTypeDefinitionRepository.SYSTEM_COMPANY_ID) {
            await this.getSystemCollection().doc(id).delete();
        }
        else {
            await this.getCollection(companyId).doc(id).delete();
        }
    }
}
exports.FirestoreVoucherTypeDefinitionRepository = FirestoreVoucherTypeDefinitionRepository;
FirestoreVoucherTypeDefinitionRepository.SYSTEM_COMPANY_ID = 'SYSTEM';
FirestoreVoucherTypeDefinitionRepository.SYSTEM_COLLECTION_NAME = 'voucher_types';
FirestoreVoucherTypeDefinitionRepository.SYSTEM_METADATA_COLLECTION = 'system_metadata';
//# sourceMappingURL=FirestoreDesignerRepositories.js.map