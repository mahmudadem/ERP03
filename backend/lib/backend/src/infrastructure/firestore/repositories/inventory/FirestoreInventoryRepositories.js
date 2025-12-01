"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirestoreStockMovementRepository = exports.FirestoreWarehouseRepository = exports.FirestoreItemRepository = void 0;
const BaseFirestoreRepository_1 = require("../BaseFirestoreRepository");
const InventoryMappers_1 = require("../../mappers/InventoryMappers");
class FirestoreItemRepository extends BaseFirestoreRepository_1.BaseFirestoreRepository {
    constructor() {
        super(...arguments);
        this.collectionName = 'items';
        this.toDomain = InventoryMappers_1.ItemMapper.toDomain;
        this.toPersistence = InventoryMappers_1.ItemMapper.toPersistence;
    }
    async createItem(item) { return this.save(item); }
    async updateItem(id, data) { await this.db.collection(this.collectionName).doc(id).update(data); }
    async setItemActive(id, active) { await this.db.collection(this.collectionName).doc(id).update({ active }); }
    async getItem(id) { return this.findById(id); }
    async getCompanyItems(companyId) {
        const snap = await this.db.collection(this.collectionName).where('companyId', '==', companyId).get();
        return snap.docs.map(d => this.toDomain(d.data()));
    }
}
exports.FirestoreItemRepository = FirestoreItemRepository;
class FirestoreWarehouseRepository extends BaseFirestoreRepository_1.BaseFirestoreRepository {
    constructor() {
        super(...arguments);
        this.collectionName = 'warehouses';
        this.toDomain = InventoryMappers_1.WarehouseMapper.toDomain;
        this.toPersistence = InventoryMappers_1.WarehouseMapper.toPersistence;
    }
    async createWarehouse(wh) { return this.save(wh); }
    async updateWarehouse(id, data) { await this.db.collection(this.collectionName).doc(id).update(data); }
    async getWarehouse(id) { return this.findById(id); }
    async getCompanyWarehouses(companyId) {
        const snap = await this.db.collection(this.collectionName).where('companyId', '==', companyId).get();
        return snap.docs.map(d => this.toDomain(d.data()));
    }
}
exports.FirestoreWarehouseRepository = FirestoreWarehouseRepository;
class FirestoreStockMovementRepository extends BaseFirestoreRepository_1.BaseFirestoreRepository {
    constructor() {
        super(...arguments);
        this.collectionName = 'stock_movements';
        this.toDomain = InventoryMappers_1.StockMovementMapper.toDomain;
        this.toPersistence = InventoryMappers_1.StockMovementMapper.toPersistence;
    }
    async recordMovement(mv) { return this.save(mv); }
    async getItemMovements(itemId) {
        const snap = await this.db.collection(this.collectionName).where('itemId', '==', itemId).get();
        return snap.docs.map(d => this.toDomain(d.data()));
    }
    async getWarehouseMovements(warehouseId) {
        const snap = await this.db.collection(this.collectionName).where('warehouseId', '==', warehouseId).get();
        return snap.docs.map(d => this.toDomain(d.data()));
    }
}
exports.FirestoreStockMovementRepository = FirestoreStockMovementRepository;
//# sourceMappingURL=FirestoreInventoryRepositories.js.map