"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirestoreTaxCodeRepository = void 0;
const SharedMappers_1 = require("../../mappers/SharedMappers");
const SharedFirestorePaths_1 = require("./SharedFirestorePaths");
class FirestoreTaxCodeRepository {
    constructor(db) {
        this.db = db;
    }
    collection(companyId) {
        return (0, SharedFirestorePaths_1.getSharedCollection)(this.db, companyId, 'tax_codes');
    }
    async resolveRefById(companyId, id) {
        const doc = await this.collection(companyId).doc(id).get();
        if (!doc.exists)
            return null;
        return doc.ref;
    }
    applyListOptions(query, opts) {
        let ref = query;
        if (opts === null || opts === void 0 ? void 0 : opts.offset)
            ref = ref.offset(opts.offset);
        if (opts === null || opts === void 0 ? void 0 : opts.limit)
            ref = ref.limit(opts.limit);
        return ref;
    }
    async create(taxCode) {
        await this.collection(taxCode.companyId).doc(taxCode.id).set(SharedMappers_1.TaxCodeMapper.toPersistence(taxCode));
    }
    async update(taxCode) {
        await this.collection(taxCode.companyId).doc(taxCode.id).set(SharedMappers_1.TaxCodeMapper.toPersistence(taxCode), { merge: true });
    }
    async getById(companyId, id) {
        const ref = await this.resolveRefById(companyId, id);
        if (!ref)
            return null;
        const doc = await ref.get();
        if (!doc.exists)
            return null;
        return SharedMappers_1.TaxCodeMapper.toDomain(doc.data());
    }
    async getByCode(companyId, code) {
        const snap = await this.collection(companyId).where('code', '==', code).limit(1).get();
        if (snap.empty)
            return null;
        return SharedMappers_1.TaxCodeMapper.toDomain(snap.docs[0].data());
    }
    async list(companyId, opts) {
        let query = this.collection(companyId);
        if (opts === null || opts === void 0 ? void 0 : opts.scope)
            query = query.where('scope', '==', opts.scope);
        if ((opts === null || opts === void 0 ? void 0 : opts.active) !== undefined)
            query = query.where('active', '==', opts.active);
        query = query.orderBy('code', 'asc');
        query = this.applyListOptions(query, opts);
        const snap = await query.get();
        return snap.docs.map((doc) => SharedMappers_1.TaxCodeMapper.toDomain(doc.data()));
    }
}
exports.FirestoreTaxCodeRepository = FirestoreTaxCodeRepository;
//# sourceMappingURL=FirestoreTaxCodeRepository.js.map