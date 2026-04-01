"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirestoreStockAdjustmentRepository = void 0;
const InventoryMappers_1 = require("../../mappers/InventoryMappers");
const InventoryFirestorePaths_1 = require("./InventoryFirestorePaths");
class FirestoreStockAdjustmentRepository {
    constructor(db) {
        this.db = db;
    }
    collection(companyId) {
        return (0, InventoryFirestorePaths_1.getInventoryCollection)(this.db, companyId, 'stock_adjustments');
    }
    async resolveRefById(id) {
        const snap = await this.db.collectionGroup('stock_adjustments').where('id', '==', id).limit(1).get();
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
    async createAdjustment(adjustment) {
        await this.collection(adjustment.companyId).doc(adjustment.id).set(InventoryMappers_1.StockAdjustmentMapper.toPersistence(adjustment));
    }
    async updateAdjustment(id, data) {
        const ref = await this.resolveRefById(id);
        if (!ref)
            return;
        await ref.update(data);
    }
    async getAdjustment(id) {
        const ref = await this.resolveRefById(id);
        if (!ref)
            return null;
        const doc = await ref.get();
        if (!doc.exists)
            return null;
        return InventoryMappers_1.StockAdjustmentMapper.toDomain(doc.data());
    }
    async getCompanyAdjustments(companyId, opts) {
        let query = this.collection(companyId).orderBy('date', 'desc');
        query = this.applyPaging(query, opts);
        const snap = await query.get();
        return snap.docs.map((doc) => InventoryMappers_1.StockAdjustmentMapper.toDomain(doc.data()));
    }
    async getByStatus(companyId, status, opts) {
        let query = this.collection(companyId)
            .where('status', '==', status)
            .orderBy('date', 'desc');
        query = this.applyPaging(query, opts);
        const snap = await query.get();
        return snap.docs.map((doc) => InventoryMappers_1.StockAdjustmentMapper.toDomain(doc.data()));
    }
    async deleteAdjustment(id) {
        const ref = await this.resolveRefById(id);
        if (!ref)
            return;
        await ref.delete();
    }
}
exports.FirestoreStockAdjustmentRepository = FirestoreStockAdjustmentRepository;
//# sourceMappingURL=FirestoreStockAdjustmentRepository.js.map