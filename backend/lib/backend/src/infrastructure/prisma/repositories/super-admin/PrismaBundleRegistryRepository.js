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
    async create(bundle) {
        await this.prisma.bundleRegistry.create({
            data: {
                id: bundle.id,
                code: bundle.id,
                name: bundle.name,
                description: bundle.description,
                modules: bundle.modulesIncluded,
                pricing: { businessDomains: bundle.businessDomains },
                createdAt: bundle.createdAt,
                updatedAt: bundle.updatedAt,
            },
        });
    }
    async update(id, bundle) {
        const updateData = {};
        if (bundle.name !== undefined)
            updateData.name = bundle.name;
        if (bundle.description !== undefined)
            updateData.description = bundle.description;
        if (bundle.modulesIncluded !== undefined)
            updateData.modules = bundle.modulesIncluded;
        if (bundle.businessDomains !== undefined) {
            updateData.pricing = { businessDomains: bundle.businessDomains };
        }
        updateData.updatedAt = new Date();
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
    toDomain(record) {
        var _a, _b, _c;
        const pricing = record.pricing;
        return {
            id: record.id,
            name: record.name,
            description: (_a = record.description) !== null && _a !== void 0 ? _a : '',
            businessDomains: (_b = pricing === null || pricing === void 0 ? void 0 : pricing.businessDomains) !== null && _b !== void 0 ? _b : [],
            modulesIncluded: (_c = record.modules) !== null && _c !== void 0 ? _c : [],
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
        };
    }
}
exports.PrismaBundleRegistryRepository = PrismaBundleRegistryRepository;
//# sourceMappingURL=PrismaBundleRegistryRepository.js.map