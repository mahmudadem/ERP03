"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirestoreItemRepository = void 0;
const InventoryMappers_1 = require("../../mappers/InventoryMappers");
const InventoryFirestorePaths_1 = require("./InventoryFirestorePaths");
class FirestoreItemRepository {
    constructor(db) {
        this.db = db;
    }
    collection(companyId) {
        return (0, InventoryFirestorePaths_1.getInventoryCollection)(this.db, companyId, 'items');
    }
    async resolveRefById(id) {
        const snap = await this.db.collectionGroup('items').where('id', '==', id).limit(1).get();
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
    async createItem(item) {
        await this.collection(item.companyId).doc(item.id).set(InventoryMappers_1.ItemMapper.toPersistence(item));
    }
    async updateItem(id, data) {
        const ref = await this.resolveRefById(id);
        if (!ref)
            return;
        await ref.update(data);
    }
    async setItemActive(id, active) {
        const ref = await this.resolveRefById(id);
        if (!ref)
            return;
        await ref.update({ active, updatedAt: new Date() });
    }
    async getItem(id) {
        const ref = await this.resolveRefById(id);
        if (!ref)
            return null;
        const doc = await ref.get();
        if (!doc.exists)
            return null;
        return InventoryMappers_1.ItemMapper.toDomain(doc.data());
    }
    async getCompanyItems(companyId, opts) {
        let query = this.collection(companyId);
        if (opts === null || opts === void 0 ? void 0 : opts.type)
            query = query.where('type', '==', opts.type);
        if (opts === null || opts === void 0 ? void 0 : opts.categoryId)
            query = query.where('categoryId', '==', opts.categoryId);
        if ((opts === null || opts === void 0 ? void 0 : opts.active) !== undefined)
            query = query.where('active', '==', opts.active);
        query = query.orderBy('code', 'asc');
        query = this.applyListOptions(query, opts);
        const snap = await query.get();
        return snap.docs.map((doc) => InventoryMappers_1.ItemMapper.toDomain(doc.data()));
    }
    async getItemByCode(companyId, code) {
        const snap = await this.collection(companyId).where('code', '==', code).limit(1).get();
        if (snap.empty)
            return null;
        return InventoryMappers_1.ItemMapper.toDomain(snap.docs[0].data());
    }
    async getItemsByCategory(companyId, categoryId, opts) {
        let query = this.collection(companyId)
            .where('categoryId', '==', categoryId)
            .orderBy('code', 'asc');
        query = this.applyListOptions(query, opts);
        const snap = await query.get();
        return snap.docs.map((doc) => InventoryMappers_1.ItemMapper.toDomain(doc.data()));
    }
    async searchItems(companyId, query, opts) {
        var _a, _b;
        const normalized = (query || '').trim().toLowerCase();
        if (!normalized) {
            return this.getCompanyItems(companyId, opts);
        }
        const list = await this.getCompanyItems(companyId, Object.assign(Object.assign({}, opts), { limit: (_a = opts === null || opts === void 0 ? void 0 : opts.limit) !== null && _a !== void 0 ? _a : 100, offset: (_b = opts === null || opts === void 0 ? void 0 : opts.offset) !== null && _b !== void 0 ? _b : 0 }));
        return list.filter((item) => item.code.toLowerCase().includes(normalized) ||
            item.name.toLowerCase().includes(normalized) ||
            (item.barcode || '').toLowerCase().includes(normalized));
    }
    async deleteItem(id) {
        const ref = await this.resolveRefById(id);
        if (!ref)
            return;
        await ref.delete();
    }
    async hasMovements(companyId, itemId) {
        const snap = await (0, InventoryFirestorePaths_1.getInventoryCollection)(this.db, companyId, 'stock_movements')
            .where('itemId', '==', itemId)
            .limit(1)
            .get();
        return !snap.empty;
    }
}
exports.FirestoreItemRepository = FirestoreItemRepository;
//# sourceMappingURL=FirestoreItemRepository.js.map