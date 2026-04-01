"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirestoreUomConversionRepository = void 0;
const InventoryMappers_1 = require("../../mappers/InventoryMappers");
const InventoryFirestorePaths_1 = require("./InventoryFirestorePaths");
class FirestoreUomConversionRepository {
    constructor(db) {
        this.db = db;
    }
    collection(companyId) {
        return (0, InventoryFirestorePaths_1.getInventoryCollection)(this.db, companyId, 'uom_conversions');
    }
    async resolveRefById(id) {
        const snap = await this.db.collectionGroup('uom_conversions').where('id', '==', id).limit(1).get();
        if (snap.empty)
            return null;
        return snap.docs[0].ref;
    }
    applyPaging(query, opts) {
        let ref = query;
        if (opts === null || opts === void 0 ? void 0 : opts.offset)
            ref = ref.offset(opts.offset);
        if (opts === null || opts === void 0 ? void 0 : opts.limit)
            ref = ref.limit(opts.limit);
        return ref;
    }
    async createConversion(conversion) {
        await this.collection(conversion.companyId).doc(conversion.id).set(InventoryMappers_1.UomConversionMapper.toPersistence(conversion));
    }
    async updateConversion(id, data) {
        const ref = await this.resolveRefById(id);
        if (!ref)
            return;
        await ref.update(data);
    }
    async getConversion(id) {
        const ref = await this.resolveRefById(id);
        if (!ref)
            return null;
        const doc = await ref.get();
        if (!doc.exists)
            return null;
        return InventoryMappers_1.UomConversionMapper.toDomain(doc.data());
    }
    async getConversionsForItem(companyId, itemId, opts) {
        let query = this.collection(companyId).where('itemId', '==', itemId).orderBy('fromUom', 'asc');
        if ((opts === null || opts === void 0 ? void 0 : opts.active) !== undefined) {
            query = query.where('active', '==', opts.active);
        }
        query = this.applyPaging(query, opts);
        const snap = await query.get();
        return snap.docs.map((doc) => InventoryMappers_1.UomConversionMapper.toDomain(doc.data()));
    }
    async getCompanyConversions(companyId, opts) {
        let query = this.collection(companyId).orderBy('itemId', 'asc').orderBy('fromUom', 'asc');
        if ((opts === null || opts === void 0 ? void 0 : opts.active) !== undefined) {
            query = query.where('active', '==', opts.active);
        }
        query = this.applyPaging(query, opts);
        const snap = await query.get();
        return snap.docs.map((doc) => InventoryMappers_1.UomConversionMapper.toDomain(doc.data()));
    }
    async deleteConversion(id) {
        const ref = await this.resolveRefById(id);
        if (!ref)
            return;
        await ref.delete();
    }
}
exports.FirestoreUomConversionRepository = FirestoreUomConversionRepository;
//# sourceMappingURL=FirestoreUomConversionRepository.js.map