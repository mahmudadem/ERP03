"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirestoreVoucherTypeDefinitionRepository = exports.FirestoreFormDefinitionRepository = void 0;
const BaseFirestoreRepository_1 = require("../BaseFirestoreRepository");
const DesignerMappers_1 = require("../../mappers/DesignerMappers");
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
        return this.db.collection('companies').doc(companyId).collection('voucher_types');
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
        const data = this.toPersistence(def);
        // System templates go to top-level collection, company templates go to subcollection
        if (def.companyId === FirestoreVoucherTypeDefinitionRepository.SYSTEM_COMPANY_ID) {
            await this.getSystemCollection().doc(def.id).set(data);
        }
        else {
            await this.getCollection(def.companyId).doc(def.id).set(data);
        }
    }
    async updateVoucherType(companyId, id, data) {
        if (companyId === FirestoreVoucherTypeDefinitionRepository.SYSTEM_COMPANY_ID) {
            await this.getSystemCollection().doc(id).update(data);
        }
        else {
            await this.getCollection(companyId).doc(id).update(data);
        }
    }
    async getVoucherType(companyId, id) {
        const doc = companyId === FirestoreVoucherTypeDefinitionRepository.SYSTEM_COMPANY_ID
            ? await this.getSystemCollection().doc(id).get()
            : await this.getCollection(companyId).doc(id).get();
        if (!doc.exists)
            return null;
        return this.toDomain(doc.data());
    }
    async getVoucherTypesForModule(companyId, module) {
        const snap = companyId === FirestoreVoucherTypeDefinitionRepository.SYSTEM_COMPANY_ID
            ? await this.getSystemCollection().where('module', '==', module).get()
            : await this.getCollection(companyId).where('module', '==', module).get();
        return snap.docs.map(d => this.toDomain(d.data()));
    }
    async getByCompanyId(companyId) {
        const snap = companyId === FirestoreVoucherTypeDefinitionRepository.SYSTEM_COMPANY_ID
            ? await this.getSystemCollection().get()
            : await this.getCollection(companyId).get();
        return snap.docs.map(d => this.toDomain(d.data()));
    }
    async getByCode(companyId, code) {
        const snap = companyId === FirestoreVoucherTypeDefinitionRepository.SYSTEM_COMPANY_ID
            ? await this.getSystemCollection().where('code', '==', code).limit(1).get()
            : await this.getCollection(companyId).where('code', '==', code).limit(1).get();
        if (snap.empty)
            return null;
        return this.toDomain(snap.docs[0].data());
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
        return snap.docs.map(d => this.toDomain(d.data()));
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