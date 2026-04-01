"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirestoreStockMovementRepository = void 0;
const InventoryMappers_1 = require("../../mappers/InventoryMappers");
const InventoryFirestorePaths_1 = require("./InventoryFirestorePaths");
class FirestoreStockMovementRepository {
    constructor(db) {
        this.db = db;
    }
    collection(companyId) {
        return (0, InventoryFirestorePaths_1.getInventoryCollection)(this.db, companyId, 'stock_movements');
    }
    asTransaction(transaction) {
        if (!transaction)
            return undefined;
        return transaction;
    }
    async resolveRefById(id) {
        const snap = await this.db.collectionGroup('stock_movements').where('id', '==', id).limit(1).get();
        if (snap.empty)
            return null;
        return snap.docs[0].ref;
    }
    applyMovementFilters(query, movementType, direction) {
        let ref = query;
        if (movementType)
            ref = ref.where('movementType', '==', movementType);
        if (direction)
            ref = ref.where('direction', '==', direction);
        return ref;
    }
    applyPaging(query, opts) {
        let ref = query;
        if (opts === null || opts === void 0 ? void 0 : opts.offset)
            ref = ref.offset(opts.offset);
        if (opts === null || opts === void 0 ? void 0 : opts.limit)
            ref = ref.limit(opts.limit);
        return ref;
    }
    async recordMovement(movement, transaction) {
        const ref = this.collection(movement.companyId).doc(movement.id);
        const data = InventoryMappers_1.StockMovementMapper.toPersistence(movement);
        const txn = this.asTransaction(transaction);
        if (txn) {
            txn.set(ref, data);
            return;
        }
        await ref.set(data);
    }
    async getItemMovements(companyId, itemId, opts) {
        let query = this.collection(companyId)
            .where('itemId', '==', itemId)
            .orderBy('postingSeq', 'desc');
        query = this.applyMovementFilters(query, opts === null || opts === void 0 ? void 0 : opts.movementType, opts === null || opts === void 0 ? void 0 : opts.direction);
        query = this.applyPaging(query, opts);
        const snap = await query.get();
        return snap.docs.map((doc) => InventoryMappers_1.StockMovementMapper.toDomain(doc.data()));
    }
    async getWarehouseMovements(companyId, warehouseId, opts) {
        let query = this.collection(companyId)
            .where('warehouseId', '==', warehouseId)
            .orderBy('postingSeq', 'desc');
        query = this.applyMovementFilters(query, opts === null || opts === void 0 ? void 0 : opts.movementType, opts === null || opts === void 0 ? void 0 : opts.direction);
        query = this.applyPaging(query, opts);
        const snap = await query.get();
        return snap.docs.map((doc) => InventoryMappers_1.StockMovementMapper.toDomain(doc.data()));
    }
    async getMovementsByReference(companyId, referenceType, referenceId) {
        const snap = await this.collection(companyId)
            .where('referenceType', '==', referenceType)
            .where('referenceId', '==', referenceId)
            .orderBy('postingSeq', 'desc')
            .get();
        return snap.docs.map((doc) => InventoryMappers_1.StockMovementMapper.toDomain(doc.data()));
    }
    async getMovementByReference(companyId, referenceType, referenceId, referenceLineId) {
        let query = this.collection(companyId)
            .where('referenceType', '==', referenceType)
            .where('referenceId', '==', referenceId);
        if (referenceLineId !== undefined && referenceLineId !== null && referenceLineId !== '') {
            query = query.where('referenceLineId', '==', referenceLineId);
        }
        const snap = await query.orderBy('postingSeq', 'desc').limit(1).get();
        if (snap.empty)
            return null;
        return InventoryMappers_1.StockMovementMapper.toDomain(snap.docs[0].data());
    }
    async getMovementsByDateRange(companyId, from, to, opts) {
        let query = this.collection(companyId)
            .where('date', '>=', from)
            .where('date', '<=', to)
            .orderBy('date', 'desc')
            .orderBy('postingSeq', 'desc');
        query = this.applyMovementFilters(query, opts === null || opts === void 0 ? void 0 : opts.movementType, opts === null || opts === void 0 ? void 0 : opts.direction);
        query = this.applyPaging(query, opts);
        const snap = await query.get();
        return snap.docs.map((doc) => InventoryMappers_1.StockMovementMapper.toDomain(doc.data()));
    }
    async getUnsettledMovements(companyId) {
        const snap = await this.collection(companyId)
            .where('costSettled', '==', false)
            .orderBy('postingSeq', 'desc')
            .get();
        return snap.docs.map((doc) => InventoryMappers_1.StockMovementMapper.toDomain(doc.data()));
    }
    async getMovement(id) {
        const ref = await this.resolveRefById(id);
        if (!ref)
            return null;
        const doc = await ref.get();
        if (!doc.exists)
            return null;
        return InventoryMappers_1.StockMovementMapper.toDomain(doc.data());
    }
}
exports.FirestoreStockMovementRepository = FirestoreStockMovementRepository;
//# sourceMappingURL=FirestoreStockMovementRepository.js.map