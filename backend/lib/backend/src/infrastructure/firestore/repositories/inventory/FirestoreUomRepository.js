"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirestoreUomRepository = void 0;
const InventoryMappers_1 = require("../../mappers/InventoryMappers");
const InventoryFirestorePaths_1 = require("./InventoryFirestorePaths");
class FirestoreUomRepository {
    constructor(db) {
        this.db = db;
    }
    collection(companyId) {
        return (0, InventoryFirestorePaths_1.getInventoryCollection)(this.db, companyId, 'uoms');
    }
    async resolveRefById(id) {
        const snap = await this.db.collectionGroup('uoms').where('id', '==', id).limit(1).get();
        if (snap.empty)
            return null;
        return snap.docs[0].ref;
    }
    applyListOptions(query, opts) {
        let ref = query;
        if (opts === null || opts === void 0 ? void 0 : opts.offset)
            ref = ref.offset(opts.offset);
        if (opts === null || opts === void 0 ? void 0 : opts.limit)
            ref = ref.limit(opts.limit);
        return ref;
    }
    async createUom(uom) {
        await this.collection(uom.companyId).doc(uom.id).set(InventoryMappers_1.UomMapper.toPersistence(uom));
    }
    async updateUom(id, data) {
        const ref = await this.resolveRefById(id);
        if (!ref)
            return;
        await ref.update(data);
    }
    async getUom(id) {
        const ref = await this.resolveRefById(id);
        if (!ref)
            return null;
        const snap = await ref.get();
        if (!snap.exists)
            return null;
        return InventoryMappers_1.UomMapper.toDomain(snap.data());
    }
    async getCompanyUoms(companyId, opts) {
        let query = this.collection(companyId);
        if ((opts === null || opts === void 0 ? void 0 : opts.active) !== undefined) {
            query = query.where('active', '==', opts.active);
        }
        query = query.orderBy('code', 'asc');
        query = this.applyListOptions(query, opts);
        const snap = await query.get();
        return snap.docs.map((doc) => InventoryMappers_1.UomMapper.toDomain(doc.data()));
    }
    async getUomByCode(companyId, code) {
        const normalizedCode = (code || '').trim().toUpperCase();
        if (!normalizedCode)
            return null;
        const exact = await this.collection(companyId).where('code', '==', normalizedCode).limit(1).get();
        if (!exact.empty)
            return InventoryMappers_1.UomMapper.toDomain(exact.docs[0].data());
        const all = await this.getCompanyUoms(companyId, { limit: 500 });
        return all.find((entry) => entry.code.toUpperCase() === normalizedCode) || null;
    }
}
exports.FirestoreUomRepository = FirestoreUomRepository;
//# sourceMappingURL=FirestoreUomRepository.js.map