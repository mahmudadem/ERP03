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
        this.collectionName = 'voucher_type_definitions';
        this.toDomain = DesignerMappers_1.VoucherTypeDefinitionMapper.toDomain;
        this.toPersistence = DesignerMappers_1.VoucherTypeDefinitionMapper.toPersistence;
    }
    async createVoucherType(def) { return this.save(def); }
    async updateVoucherType(id, data) { await this.db.collection(this.collectionName).doc(id).update(data); }
    async getVoucherType(id) { return this.findById(id); }
    async getVoucherTypesForModule(module) {
        const snap = await this.db.collection(this.collectionName).where('module', '==', module).get();
        return snap.docs.map(d => this.toDomain(d.data()));
    }
    async getByCompanyId(companyId) {
        const snap = await this.db.collection(this.collectionName).where('companyId', '==', companyId).get();
        return snap.docs.map(d => this.toDomain(d.data()));
    }
    async getByCode(companyId, code) {
        const snap = await this.db.collection(this.collectionName)
            .where('companyId', '==', companyId)
            .where('code', '==', code)
            .limit(1)
            .get();
        if (snap.empty)
            return null;
        return this.toDomain(snap.docs[0].data());
    }
    async updateLayout(companyId, code, layout) {
        const snap = await this.db.collection(this.collectionName)
            .where('companyId', '==', companyId)
            .where('code', '==', code)
            .limit(1)
            .get();
        if (!snap.empty) {
            await snap.docs[0].ref.update({ layout });
        }
    }
}
exports.FirestoreVoucherTypeDefinitionRepository = FirestoreVoucherTypeDefinitionRepository;
//# sourceMappingURL=FirestoreDesignerRepositories.js.map