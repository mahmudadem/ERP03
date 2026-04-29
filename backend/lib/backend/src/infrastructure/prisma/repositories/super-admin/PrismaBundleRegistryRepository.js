"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaBundleRegistryRepository = void 0;
class PrismaBundleRegistryRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getAll() {
        const records = await this.prisma.bundleRegistry.findMany({
            orderBy: { name: 'asc' },
        });
        return records.map((r) => this.toDomain(r));
    }
    async getById(id) {
        const record = await this.prisma.bundleRegistry.findUnique({
            where: { id },
        });
        if (!record)
            return null;
        return this.toDomain(record);
    }
    async getByCode(code) {
        const record = await this.prisma.bundleRegistry.findUnique({
            where: { code },
        });
        if (!record)
            return null;
        return this.toDomain(record);
    }
    async getReady() {
        const records = await this.prisma.bundleRegistry.findMany({
            where: { lifecycleStatus: 'ready' },
            orderBy: { name: 'asc' },
        });
        return records.map((r) => this.toDomain(r));
    }
    async create(bundle) {
        const bundleId = bundle.id;
        await this.prisma.bundleRegistry.create({
            data: {
                id: bundleId,
                code: bundle.code || bundle.id,
                name: bundle.name,
                description: bundle.description,
                modules: bundle.modules || bundle.modulesIncluded || [],
                lifecycleStatus: bundle.lifecycleStatus || 'draft',
                pricing: bundle.pricing || { businessDomains: bundle.businessDomains || [] },
                createdAt: bundle.createdAt,
                updatedAt: bundle.updatedAt,
            },
        });
        const moduleList = bundle.modulesIncluded || bundle.modules || [];
        const capabilityList = bundle.capabilities || [];
        for (const mod of moduleList) {
            await this.prisma.bundleItem.create({
                data: { id: `bi_${bundleId}_module_${mod}`, bundleId, itemType: 'module', itemKey: mod },
            });
        }
        for (const cap of capabilityList) {
            await this.prisma.bundleItem.create({
                data: { id: `bi_${bundleId}_capability_${cap}`, bundleId, itemType: 'capability', itemKey: cap },
            });
        }
    }
    async update(id, bundle) {
        var _a;
        const updateData = {};
        if (bundle.name !== undefined)
            updateData.name = bundle.name;
        if (bundle.description !== undefined)
            updateData.description = bundle.description;
        const modulesProvided = bundle.modulesIncluded !== undefined || bundle.modules !== undefined;
        const capabilitiesProvided = bundle.capabilities !== undefined;
        const moduleList = (_a = bundle.modulesIncluded) !== null && _a !== void 0 ? _a : bundle.modules;
        if (modulesProvided)
            updateData.modules = moduleList;
        if (bundle.lifecycleStatus !== undefined)
            updateData.lifecycleStatus = bundle.lifecycleStatus;
        if (bundle.pricing !== undefined)
            updateData.pricing = bundle.pricing;
        if (bundle.businessDomains !== undefined) {
            const existingBundle = await this.prisma.bundleRegistry.findUnique({
                where: { id },
                select: { pricing: true },
            });
            updateData.pricing = Object.assign(Object.assign({}, ((existingBundle === null || existingBundle === void 0 ? void 0 : existingBundle.pricing) || {})), { businessDomains: bundle.businessDomains });
        }
        updateData.updatedAt = new Date();
        const shouldSyncItems = modulesProvided || capabilitiesProvided;
        const existingItems = shouldSyncItems
            ? await this.prisma.bundleItem.findMany({ where: { bundleId: id } })
            : [];
        const normalizedModules = modulesProvided
            ? moduleList || []
            : existingItems.filter((item) => item.itemType === 'module').map((item) => item.itemKey);
        const normalizedCapabilities = capabilitiesProvided
            ? bundle.capabilities || []
            : existingItems.filter((item) => item.itemType === 'capability').map((item) => item.itemKey);
        await this.prisma.$transaction(async (tx) => {
            await tx.bundleRegistry.update({
                where: { id },
                data: updateData,
            });
            if (shouldSyncItems) {
                await tx.bundleItem.deleteMany({ where: { bundleId: id } });
                for (const mod of normalizedModules) {
                    await tx.bundleItem.create({
                        data: { id: `bi_${id}_module_${mod}`, bundleId: id, itemType: 'module', itemKey: mod },
                    });
                }
                for (const cap of normalizedCapabilities) {
                    await tx.bundleItem.create({
                        data: { id: `bi_${id}_capability_${cap}`, bundleId: id, itemType: 'capability', itemKey: cap },
                    });
                }
            }
        });
    }
    async delete(id) {
        await this.prisma.bundleItem.deleteMany({ where: { bundleId: id } });
        await this.prisma.bundleRegistry.delete({
            where: { id },
        });
    }
    async getByBundleId(bundleId) {
        const records = await this.prisma.bundleItem.findMany({
            where: { bundleId },
        });
        return records.map(r => ({
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
        return records.map(r => r.itemKey);
    }
    async getCapabilityKeysByBundleId(bundleId) {
        const records = await this.prisma.bundleItem.findMany({
            where: { bundleId, itemType: 'capability' },
        });
        return records.map(r => r.itemKey);
    }
    async addItem(bundleId, item) {
        await this.prisma.bundleItem.create({
            data: {
                id: item.id || `bi_${Date.now()}`,
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
    toDomain(record) {
        var _a, _b, _c, _d;
        const pricing = record.pricing;
        return {
            id: record.id,
            code: record.code,
            name: record.name,
            description: (_a = record.description) !== null && _a !== void 0 ? _a : '',
            businessDomains: (_b = pricing === null || pricing === void 0 ? void 0 : pricing.businessDomains) !== null && _b !== void 0 ? _b : [],
            modulesIncluded: (_c = record.modules) !== null && _c !== void 0 ? _c : [],
            lifecycleStatus: (_d = record.lifecycleStatus) !== null && _d !== void 0 ? _d : 'draft',
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
        };
    }
}
exports.PrismaBundleRegistryRepository = PrismaBundleRegistryRepository;
//# sourceMappingURL=PrismaBundleRegistryRepository.js.map