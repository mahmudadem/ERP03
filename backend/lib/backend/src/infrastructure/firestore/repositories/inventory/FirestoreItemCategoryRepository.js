"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirestoreItemCategoryRepository = void 0;
const InventoryMappers_1 = require("../../mappers/InventoryMappers");
const InventoryFirestorePaths_1 = require("./InventoryFirestorePaths");
class FirestoreItemCategoryRepository {
    constructor(db) {
        this.db = db;
    }
    collection(companyId) {
        return (0, InventoryFirestorePaths_1.getInventoryCollection)(this.db, companyId, 'categories');
    }
    async resolveRefById(id) {
        const snap = await this.db.collectionGroup('categories').where('id', '==', id).limit(1).get();
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
    async createCategory(category) {
        await this.collection(category.companyId).doc(category.id).set(InventoryMappers_1.ItemCategoryMapper.toPersistence(category));
    }
    async updateCategory(id, data) {
        const ref = await this.resolveRefById(id);
        if (!ref)
            return;
        await ref.update(data);
    }
    async getCategory(id) {
        const ref = await this.resolveRefById(id);
        if (!ref)
            return null;
        const doc = await ref.get();
        if (!doc.exists)
            return null;
        return InventoryMappers_1.ItemCategoryMapper.toDomain(doc.data());
    }
    async getCompanyCategories(companyId, opts) {
        let query = this.collection(companyId).orderBy('sortOrder', 'asc').orderBy('name', 'asc');
        if ((opts === null || opts === void 0 ? void 0 : opts.active) !== undefined) {
            query = query.where('active', '==', opts.active);
        }
        query = this.applyPaging(query, opts);
        const snap = await query.get();
        return snap.docs.map((doc) => InventoryMappers_1.ItemCategoryMapper.toDomain(doc.data()));
    }
    async getCategoriesByParent(companyId, parentId, opts) {
        let query = this.collection(companyId).orderBy('sortOrder', 'asc').orderBy('name', 'asc');
        if ((opts === null || opts === void 0 ? void 0 : opts.active) !== undefined) {
            query = query.where('active', '==', opts.active);
        }
        if (parentId) {
            query = query.where('parentId', '==', parentId);
            query = this.applyPaging(query, opts);
            const snap = await query.get();
            return snap.docs.map((doc) => InventoryMappers_1.ItemCategoryMapper.toDomain(doc.data()));
        }
        query = this.applyPaging(query, opts);
        const snap = await query.get();
        return snap.docs
            .map((doc) => InventoryMappers_1.ItemCategoryMapper.toDomain(doc.data()))
            .filter((category) => !category.parentId);
    }
    async deleteCategory(id) {
        const ref = await this.resolveRefById(id);
        if (!ref)
            return;
        await ref.delete();
    }
}
exports.FirestoreItemCategoryRepository = FirestoreItemCategoryRepository;
//# sourceMappingURL=FirestoreItemCategoryRepository.js.map