"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaItemRepository = void 0;
const Item_1 = require("../../../../domain/inventory/entities/Item");
class PrismaItemRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async createItem(item) {
        var _a, _b, _c;
        await this.prisma.item.create({
            data: {
                id: item.id,
                companyId: item.companyId,
                code: item.code,
                name: item.name,
                description: item.description || null,
                barcode: item.barcode || null,
                type: item.type,
                categoryId: item.categoryId || null,
                brand: item.brand || null,
                tags: item.tags || [],
                baseUomId: item.baseUomId || null,
                baseUom: item.baseUom,
                purchaseUomId: item.purchaseUomId || null,
                purchaseUom: item.purchaseUom || null,
                salesUomId: item.salesUomId || null,
                salesUom: item.salesUom || null,
                costCurrency: item.costCurrency,
                costingMethod: item.costingMethod,
                trackInventory: item.trackInventory,
                revenueAccountId: item.revenueAccountId || null,
                cogsAccountId: item.cogsAccountId || null,
                inventoryAssetAccountId: item.inventoryAssetAccountId || null,
                defaultPurchaseTaxCodeId: item.defaultPurchaseTaxCodeId || null,
                defaultSalesTaxCodeId: item.defaultSalesTaxCodeId || null,
                minStockLevel: (_a = item.minStockLevel) !== null && _a !== void 0 ? _a : null,
                maxStockLevel: (_b = item.maxStockLevel) !== null && _b !== void 0 ? _b : null,
                reorderPoint: (_c = item.reorderPoint) !== null && _c !== void 0 ? _c : null,
                imageUrl: item.imageUrl || null,
                metadata: item.metadata || null,
                active: item.active,
                createdBy: item.createdBy,
            },
        });
    }
    async updateItem(id, data) {
        await this.prisma.item.update({
            where: { id },
            data: data,
        });
    }
    async setItemActive(id, active) {
        await this.prisma.item.update({
            where: { id },
            data: { active },
        });
    }
    async getItem(id) {
        const record = await this.prisma.item.findUnique({
            where: { id },
        });
        if (!record)
            return null;
        return this.toDomain(record);
    }
    async getCompanyItems(companyId, opts) {
        const where = { companyId };
        if ((opts === null || opts === void 0 ? void 0 : opts.active) !== undefined) {
            where.active = opts.active;
        }
        if ((opts === null || opts === void 0 ? void 0 : opts.type) !== undefined) {
            where.type = opts.type;
        }
        if ((opts === null || opts === void 0 ? void 0 : opts.categoryId) !== undefined) {
            where.categoryId = opts.categoryId;
        }
        if ((opts === null || opts === void 0 ? void 0 : opts.trackInventory) !== undefined) {
            where.trackInventory = opts.trackInventory;
        }
        const records = await this.prisma.item.findMany({
            where,
            orderBy: { createdAt: 'asc' },
            take: opts === null || opts === void 0 ? void 0 : opts.limit,
            skip: opts === null || opts === void 0 ? void 0 : opts.offset,
        });
        return records.map((r) => this.toDomain(r));
    }
    async getItemByCode(companyId, code) {
        const record = await this.prisma.item.findFirst({
            where: { companyId, code },
        });
        if (!record)
            return null;
        return this.toDomain(record);
    }
    async getItemsByCategory(companyId, categoryId, opts) {
        const where = { companyId, categoryId };
        if ((opts === null || opts === void 0 ? void 0 : opts.active) !== undefined) {
            where.active = opts.active;
        }
        if ((opts === null || opts === void 0 ? void 0 : opts.type) !== undefined) {
            where.type = opts.type;
        }
        if ((opts === null || opts === void 0 ? void 0 : opts.trackInventory) !== undefined) {
            where.trackInventory = opts.trackInventory;
        }
        const records = await this.prisma.item.findMany({
            where,
            orderBy: { createdAt: 'asc' },
            take: opts === null || opts === void 0 ? void 0 : opts.limit,
            skip: opts === null || opts === void 0 ? void 0 : opts.offset,
        });
        return records.map((r) => this.toDomain(r));
    }
    async searchItems(companyId, query, opts) {
        const where = {
            companyId,
            OR: [
                { code: { contains: query, mode: 'insensitive' } },
                { name: { contains: query, mode: 'insensitive' } },
                { description: { contains: query, mode: 'insensitive' } },
                { barcode: { contains: query, mode: 'insensitive' } },
                { brand: { contains: query, mode: 'insensitive' } },
            ],
        };
        if ((opts === null || opts === void 0 ? void 0 : opts.active) !== undefined) {
            where.active = opts.active;
        }
        if ((opts === null || opts === void 0 ? void 0 : opts.type) !== undefined) {
            where.type = opts.type;
        }
        if ((opts === null || opts === void 0 ? void 0 : opts.categoryId) !== undefined) {
            where.categoryId = opts.categoryId;
        }
        if ((opts === null || opts === void 0 ? void 0 : opts.trackInventory) !== undefined) {
            where.trackInventory = opts.trackInventory;
        }
        const records = await this.prisma.item.findMany({
            where,
            orderBy: { createdAt: 'asc' },
            take: opts === null || opts === void 0 ? void 0 : opts.limit,
            skip: opts === null || opts === void 0 ? void 0 : opts.offset,
        });
        return records.map((r) => this.toDomain(r));
    }
    async deleteItem(id) {
        await this.prisma.item.delete({
            where: { id },
        });
    }
    async hasMovements(companyId, itemId) {
        const count = await this.prisma.stockMovement.count({
            where: { companyId, itemId },
        });
        return count > 0;
    }
    toDomain(record) {
        return Item_1.Item.fromJSON({
            id: record.id,
            companyId: record.companyId,
            code: record.code,
            name: record.name,
            description: record.description,
            barcode: record.barcode,
            type: record.type,
            categoryId: record.categoryId,
            brand: record.brand,
            tags: record.tags,
            baseUomId: record.baseUomId,
            baseUom: record.baseUom,
            purchaseUomId: record.purchaseUomId,
            purchaseUom: record.purchaseUom,
            salesUomId: record.salesUomId,
            salesUom: record.salesUom,
            costCurrency: record.costCurrency,
            costingMethod: record.costingMethod,
            trackInventory: record.trackInventory,
            revenueAccountId: record.revenueAccountId,
            cogsAccountId: record.cogsAccountId,
            inventoryAssetAccountId: record.inventoryAssetAccountId,
            defaultPurchaseTaxCodeId: record.defaultPurchaseTaxCodeId,
            defaultSalesTaxCodeId: record.defaultSalesTaxCodeId,
            minStockLevel: record.minStockLevel,
            maxStockLevel: record.maxStockLevel,
            reorderPoint: record.reorderPoint,
            imageUrl: record.imageUrl,
            metadata: record.metadata,
            active: record.active,
            createdBy: record.createdBy,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
        });
    }
}
exports.PrismaItemRepository = PrismaItemRepository;
//# sourceMappingURL=PrismaItemRepository.js.map