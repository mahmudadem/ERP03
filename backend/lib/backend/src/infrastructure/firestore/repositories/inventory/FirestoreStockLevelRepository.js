"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirestoreStockLevelRepository = void 0;
const StockLevel_1 = require("../../../../domain/inventory/entities/StockLevel");
const InventoryMappers_1 = require("../../mappers/InventoryMappers");
const InventoryFirestorePaths_1 = require("./InventoryFirestorePaths");
class FirestoreStockLevelRepository {
    constructor(db) {
        this.db = db;
    }
    collection(companyId) {
        return (0, InventoryFirestorePaths_1.getInventoryCollection)(this.db, companyId, 'stock_levels');
    }
    applyPaging(query, opts) {
        let ref = query;
        if (opts === null || opts === void 0 ? void 0 : opts.offset)
            ref = ref.offset(opts.offset);
        if (opts === null || opts === void 0 ? void 0 : opts.limit)
            ref = ref.limit(opts.limit);
        return ref;
    }
    async getLevel(companyId, itemId, warehouseId) {
        const id = StockLevel_1.StockLevel.compositeId(itemId, warehouseId);
        const doc = await this.collection(companyId).doc(id).get();
        if (!doc.exists)
            return null;
        return InventoryMappers_1.StockLevelMapper.toDomain(doc.data());
    }
    async getLevelsByItem(companyId, itemId, opts) {
        let query = this.collection(companyId)
            .where('itemId', '==', itemId)
            .orderBy('warehouseId', 'asc');
        query = this.applyPaging(query, opts);
        const snap = await query.get();
        return snap.docs.map((doc) => InventoryMappers_1.StockLevelMapper.toDomain(doc.data()));
    }
    async getLevelsByWarehouse(companyId, warehouseId, opts) {
        let query = this.collection(companyId)
            .where('warehouseId', '==', warehouseId)
            .orderBy('itemId', 'asc');
        query = this.applyPaging(query, opts);
        const snap = await query.get();
        return snap.docs.map((doc) => InventoryMappers_1.StockLevelMapper.toDomain(doc.data()));
    }
    async getAllLevels(companyId, opts) {
        let query = this.collection(companyId).orderBy('itemId', 'asc');
        query = this.applyPaging(query, opts);
        const snap = await query.get();
        return snap.docs.map((doc) => InventoryMappers_1.StockLevelMapper.toDomain(doc.data()));
    }
    async upsertLevel(level) {
        await this.collection(level.companyId).doc(level.id).set(InventoryMappers_1.StockLevelMapper.toPersistence(level));
    }
    async getLevelInTransaction(transaction, companyId, itemId, warehouseId) {
        const txn = transaction;
        const id = StockLevel_1.StockLevel.compositeId(itemId, warehouseId);
        const ref = this.collection(companyId).doc(id);
        const doc = await txn.get(ref);
        if (!doc.exists)
            return null;
        return InventoryMappers_1.StockLevelMapper.toDomain(doc.data());
    }
    async upsertLevelInTransaction(transaction, level) {
        const txn = transaction;
        const ref = this.collection(level.companyId).doc(level.id);
        txn.set(ref, InventoryMappers_1.StockLevelMapper.toPersistence(level));
    }
}
exports.FirestoreStockLevelRepository = FirestoreStockLevelRepository;
//# sourceMappingURL=FirestoreStockLevelRepository.js.map