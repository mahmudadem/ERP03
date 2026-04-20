"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaItemCategoryRepository = void 0;
const ItemCategory_1 = require("../../../../domain/inventory/entities/ItemCategory");
class PrismaItemCategoryRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async createCategory(category) {
        await this.prisma.itemCategory.create({
            data: Object.assign(Object.assign(Object.assign(Object.assign({ id: category.id, companyId: category.companyId, code: category.id, name: category.name, parentId: category.parentId || null, description: null }, category.sortOrder !== undefined && { sortOrder: category.sortOrder }), category.defaultRevenueAccountId !== undefined && { defaultRevenueAccountId: category.defaultRevenueAccountId }), category.defaultCogsAccountId !== undefined && { defaultCogsAccountId: category.defaultCogsAccountId }), category.defaultInventoryAssetAccountId !== undefined && { defaultInventoryAssetAccountId: category.defaultInventoryAssetAccountId }),
        });
    }
    async updateCategory(id, data) {
        await this.prisma.itemCategory.update({
            where: { id },
            data: data,
        });
    }
    async getCategory(id) {
        const record = await this.prisma.itemCategory.findUnique({
            where: { id },
        });
        if (!record)
            return null;
        return this.toDomain(record);
    }
    async getCompanyCategories(companyId, opts) {
        const where = { companyId };
        if ((opts === null || opts === void 0 ? void 0 : opts.active) !== undefined) {
            where.active = opts.active;
        }
        const records = await this.prisma.itemCategory.findMany({
            where,
            orderBy: { createdAt: 'asc' },
            take: opts === null || opts === void 0 ? void 0 : opts.limit,
            skip: opts === null || opts === void 0 ? void 0 : opts.offset,
        });
        return records.map((r) => this.toDomain(r));
    }
    async getCategoriesByParent(companyId, parentId, opts) {
        const where = { companyId };
        if (parentId !== undefined) {
            where.parentId = parentId;
        }
        else {
            where.parentId = null;
        }
        if ((opts === null || opts === void 0 ? void 0 : opts.active) !== undefined) {
            where.active = opts.active;
        }
        const records = await this.prisma.itemCategory.findMany({
            where,
            orderBy: { createdAt: 'asc' },
            take: opts === null || opts === void 0 ? void 0 : opts.limit,
            skip: opts === null || opts === void 0 ? void 0 : opts.offset,
        });
        return records.map((r) => this.toDomain(r));
    }
    async deleteCategory(id) {
        await this.prisma.itemCategory.delete({
            where: { id },
        });
    }
    toDomain(record) {
        var _a, _b, _c, _d, _e, _f;
        return new ItemCategory_1.ItemCategory({
            id: record.id,
            companyId: record.companyId,
            name: record.name,
            parentId: (_a = record.parentId) !== null && _a !== void 0 ? _a : undefined,
            sortOrder: (_b = record.sortOrder) !== null && _b !== void 0 ? _b : 0,
            active: (_c = record.active) !== null && _c !== void 0 ? _c : true,
            defaultRevenueAccountId: (_d = record.defaultRevenueAccountId) !== null && _d !== void 0 ? _d : undefined,
            defaultCogsAccountId: (_e = record.defaultCogsAccountId) !== null && _e !== void 0 ? _e : undefined,
            defaultInventoryAssetAccountId: (_f = record.defaultInventoryAssetAccountId) !== null && _f !== void 0 ? _f : undefined,
        });
    }
}
exports.PrismaItemCategoryRepository = PrismaItemCategoryRepository;
//# sourceMappingURL=PrismaItemCategoryRepository.js.map