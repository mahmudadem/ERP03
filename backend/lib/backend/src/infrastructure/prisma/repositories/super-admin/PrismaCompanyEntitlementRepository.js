"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaBundleRegistryRepository = exports.PrismaBundleItemRepository = exports.PrismaCompanyEntitlementRepository = void 0;
class PrismaCompanyEntitlementRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getByCompanyId(companyId) {
        const records = await this.prisma.companyEntitlement.findMany({
            where: { companyId },
            include: { items: true },
        });
        return records.map((r) => this.toEntitlementDomain(r));
    }
    async getActiveByCompanyId(companyId) {
        const now = new Date();
        const records = await this.prisma.companyEntitlement.findMany({
            where: {
                companyId,
                isActive: true,
                OR: [
                    { validUntil: null },
                    { validUntil: { gte: now } },
                ],
            },
            include: { items: true },
        });
        return records.map((r) => this.toEntitlementDomain(r));
    }
    async getEntitlementById(id) {
        const record = await this.prisma.companyEntitlement.findUnique({
            where: { id },
            include: { items: true },
        });
        if (!record)
            return null;
        return this.toEntitlementDomain(record);
    }
    async createEntitlement(entitlement) {
        await this.prisma.companyEntitlement.create({
            data: {
                id: entitlement.id,
                companyId: entitlement.companyId,
                sourceType: entitlement.sourceType,
                sourceId: entitlement.sourceId,
                validFrom: entitlement.validFrom,
                validUntil: entitlement.validUntil,
                isActive: entitlement.isActive,
                items: {
                    create: entitlement.items.map((item) => ({
                        id: item.id,
                        itemType: item.itemType,
                        itemKey: item.itemKey,
                    })),
                },
            },
        });
    }
    async updateEntitlement(id, updates) {
        await this.prisma.companyEntitlement.update({
            where: { id },
            data: {
                sourceType: updates.sourceType,
                sourceId: updates.sourceId,
                validFrom: updates.validFrom,
                validUntil: updates.validUntil,
                isActive: updates.isActive,
                updatedAt: new Date(),
            },
        });
    }
    async deactivateEntitlement(id) {
        await this.prisma.companyEntitlement.update({
            where: { id },
            data: {
                isActive: false,
                updatedAt: new Date(),
            },
        });
    }
    async addItem(entitlementId, item) {
        await this.prisma.companyEntitlementItem.create({
            data: {
                id: item.id,
                entitlementId,
                itemType: item.itemType,
                itemKey: item.itemKey,
            },
        });
    }
    async removeItem(entitlementId, itemKey) {
        await this.prisma.companyEntitlementItem.deleteMany({
            where: { entitlementId, itemKey },
        });
    }
    async getItemsByEntitlementId(entitlementId) {
        const records = await this.prisma.companyEntitlementItem.findMany({
            where: { entitlementId },
        });
        return records.map((r) => ({
            id: r.id,
            entitlementId: r.entitlementId,
            itemType: r.itemType,
            itemKey: r.itemKey,
            createdAt: r.createdAt,
        }));
    }
    async getEffectiveModules(companyId) {
        const entitlements = await this.getActiveByCompanyId(companyId);
        const modules = new Set();
        for (const entitlement of entitlements) {
            for (const item of entitlement.items) {
                if (item.itemType === 'module') {
                    modules.add(item.itemKey);
                }
            }
        }
        return Array.from(modules);
    }
    async getEffectiveCapabilities(companyId) {
        const entitlements = await this.getActiveByCompanyId(companyId);
        const capabilities = new Set();
        for (const entitlement of entitlements) {
            for (const item of entitlement.items) {
                if (item.itemType === 'capability') {
                    capabilities.add(item.itemKey);
                }
            }
        }
        return Array.from(capabilities);
    }
    async hasModule(companyId, moduleId) {
        const modules = await this.getEffectiveModules(companyId);
        return modules.includes(moduleId.toLowerCase());
    }
    async hasCapability(companyId, capabilityId) {
        const capabilities = await this.getEffectiveCapabilities(companyId);
        return capabilities.includes(capabilityId.toLowerCase());
    }
    toEntitlementDomain(record) {
        var _a;
        return {
            id: record.id,
            companyId: record.companyId,
            sourceType: record.sourceType,
            sourceId: record.sourceId,
            validFrom: record.validFrom,
            validUntil: (_a = record.validUntil) !== null && _a !== void 0 ? _a : undefined,
            isActive: record.isActive,
            items: record.items.map((item) => ({
                id: item.id,
                entitlementId: item.entitlementId,
                itemType: item.itemType,
                itemKey: item.itemKey,
                createdAt: item.createdAt,
            })),
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
        };
    }
}
exports.PrismaCompanyEntitlementRepository = PrismaCompanyEntitlementRepository;
class PrismaBundleItemRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getByBundleId(bundleId) {
        const records = await this.prisma.bundleItem.findMany({
            where: { bundleId },
        });
        return records.map((r) => ({
            id: r.id,
            bundleId: r.bundleId,
            itemType: r.itemType,
            itemKey: r.itemKey,
            createdAt: r.createdAt,
        }));
    }
    async getModuleKeysByBundleId(bundleId) {
        const records = await this.prisma.bundleItem.findMany({
            where: { bundleId, itemType: 'module' },
        });
        return records.map((r) => r.itemKey);
    }
    async getCapabilityKeysByBundleId(bundleId) {
        const records = await this.prisma.bundleItem.findMany({
            where: { bundleId, itemType: 'capability' },
        });
        return records.map((r) => r.itemKey);
    }
    async addItem(bundleId, item) {
        await this.prisma.bundleItem.create({
            data: {
                bundleId,
                itemType: item.itemType,
                itemKey: item.itemKey,
            },
        });
    }
    async removeItem(bundleId, itemKey) {
        await this.prisma.bundleItem.deleteMany({
            where: { bundleId, itemKey },
        });
    }
    async clearItems(bundleId) {
        await this.prisma.bundleItem.deleteMany({
            where: { bundleId },
        });
    }
}
exports.PrismaBundleItemRepository = PrismaBundleItemRepository;
class PrismaBundleRegistryRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getAll() {
        const records = await this.prisma.bundleRegistry.findMany({
            include: { bundleItems: true },
            orderBy: { name: 'asc' },
        });
        return records.map((r) => this.toBundleDomain(r));
    }
    async getById(id) {
        const record = await this.prisma.bundleRegistry.findUnique({
            where: { id },
            include: { bundleItems: true },
        });
        if (!record)
            return null;
        return this.toBundleDomain(record);
    }
    async getByCode(code) {
        const record = await this.prisma.bundleRegistry.findUnique({
            where: { code },
            include: { bundleItems: true },
        });
        if (!record)
            return null;
        return this.toBundleDomain(record);
    }
    async create(bundle) {
        await this.prisma.bundleRegistry.create({
            data: {
                id: bundle.id,
                code: bundle.code,
                name: bundle.name,
                description: bundle.description,
                lifecycleStatus: bundle.lifecycleStatus,
                modules: bundle.items.filter((i) => i.itemType === 'module').map((i) => i.itemKey),
            },
        });
    }
    async update(id, bundle) {
        const updateData = { updatedAt: new Date() };
        if (bundle.name)
            updateData.name = bundle.name;
        if (bundle.description)
            updateData.description = bundle.description;
        if (bundle.lifecycleStatus)
            updateData.lifecycleStatus = bundle.lifecycleStatus;
        await this.prisma.bundleRegistry.update({
            where: { id },
            data: updateData,
        });
    }
    async delete(id) {
        await this.prisma.bundleRegistry.delete({
            where: { id },
        });
    }
    async getReady() {
        const records = await this.prisma.bundleRegistry.findMany({
            where: { lifecycleStatus: 'ready' },
            include: { bundleItems: true },
            orderBy: { name: 'asc' },
        });
        return records.map((r) => this.toBundleDomain(r));
    }
    async getByBundleId(bundleId) {
        const records = await this.prisma.bundleItem.findMany({
            where: { bundleId },
        });
        return records.map((r) => ({
            id: r.id,
            bundleId: r.bundleId,
            itemType: r.itemType,
            itemKey: r.itemKey,
            createdAt: r.createdAt,
        }));
    }
    async getModuleKeysByBundleId(bundleId) {
        const records = await this.prisma.bundleItem.findMany({
            where: { bundleId, itemType: 'module' },
        });
        return records.map((r) => r.itemKey);
    }
    async getCapabilityKeysByBundleId(bundleId) {
        const records = await this.prisma.bundleItem.findMany({
            where: { bundleId, itemType: 'capability' },
        });
        return records.map((r) => r.itemKey);
    }
    async addItem(bundleId, item) {
        await this.prisma.bundleItem.create({
            data: {
                bundleId,
                itemType: item.itemType,
                itemKey: item.itemKey,
            },
        });
    }
    async removeItem(bundleId, itemKey) {
        await this.prisma.bundleItem.deleteMany({
            where: { bundleId, itemKey },
        });
    }
    async clearItems(bundleId) {
        await this.prisma.bundleItem.deleteMany({
            where: { bundleId },
        });
    }
    toBundleDomain(record) {
        var _a;
        return {
            id: record.id,
            code: record.code,
            name: record.name,
            description: (_a = record.description) !== null && _a !== void 0 ? _a : undefined,
            lifecycleStatus: record.lifecycleStatus,
            items: (record.bundleItems || []).map((item) => ({
                id: item.id,
                bundleId: item.bundleId,
                itemType: item.itemType,
                itemKey: item.itemKey,
                createdAt: item.createdAt,
            })),
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
        };
    }
}
exports.PrismaBundleRegistryRepository = PrismaBundleRegistryRepository;
//# sourceMappingURL=PrismaCompanyEntitlementRepository.js.map