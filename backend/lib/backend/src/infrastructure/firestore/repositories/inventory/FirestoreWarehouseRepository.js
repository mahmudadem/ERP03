"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirestoreWarehouseRepository = void 0;
const InventoryMappers_1 = require("../../mappers/InventoryMappers");
const InventoryFirestorePaths_1 = require("./InventoryFirestorePaths");
class FirestoreWarehouseRepository {
    constructor(db) {
        this.db = db;
    }
    collection(companyId) {
        return (0, InventoryFirestorePaths_1.getInventoryCollection)(this.db, companyId, 'warehouses');
    }
    async resolveRefById(id) {
        const snap = await this.db.collectionGroup('warehouses').where('id', '==', id).limit(1).get();
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
    async createWarehouse(warehouse) {
        await this.collection(warehouse.companyId).doc(warehouse.id).set(InventoryMappers_1.WarehouseMapper.toPersistence(warehouse));
    }
    async updateWarehouse(id, data) {
        const ref = await this.resolveRefById(id);
        if (!ref)
            return;
        await ref.update(data);
    }
    async getWarehouse(id) {
        const ref = await this.resolveRefById(id);
        if (!ref)
            return null;
        const doc = await ref.get();
        if (!doc.exists)
            return null;
        return InventoryMappers_1.WarehouseMapper.toDomain(doc.data());
    }
    async getCompanyWarehouses(companyId, opts) {
        let query = this.collection(companyId);
        if ((opts === null || opts === void 0 ? void 0 : opts.active) !== undefined) {
            query = query.where('active', '==', opts.active);
        }
        query = query.orderBy('code', 'asc');
        query = this.applyListOptions(query, opts);
        const snap = await query.get();
        return snap.docs.map((doc) => InventoryMappers_1.WarehouseMapper.toDomain(doc.data()));
    }
    async getWarehouseByCode(companyId, code) {
        const snap = await this.collection(companyId).where('code', '==', code).limit(1).get();
        if (snap.empty)
            return null;
        return InventoryMappers_1.WarehouseMapper.toDomain(snap.docs[0].data());
    }
}
exports.FirestoreWarehouseRepository = FirestoreWarehouseRepository;
//# sourceMappingURL=FirestoreWarehouseRepository.js.map