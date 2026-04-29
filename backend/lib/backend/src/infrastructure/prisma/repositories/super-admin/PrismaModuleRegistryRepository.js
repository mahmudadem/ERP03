"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaModuleRegistryRepository = void 0;
class PrismaModuleRegistryRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getAll() {
        const records = await this.prisma.moduleRegistry.findMany({
            orderBy: { name: 'asc' },
        });
        return records.map((r) => this.toDomain(r));
    }
    async getById(id) {
        const record = await this.prisma.moduleRegistry.findUnique({
            where: { id },
        });
        if (!record)
            return null;
        return this.toDomain(record);
    }
    async getByCode(code) {
        const record = await this.prisma.moduleRegistry.findUnique({
            where: { code },
        });
        if (!record)
            return null;
        return this.toDomain(record);
    }
    async create(module) {
        await this.prisma.moduleRegistry.create({
            data: {
                id: module.id,
                code: module.code,
                name: module.name,
                version: module.version,
                description: module.description,
                lifecycleStatus: module.lifecycleStatus,
                runtimeStatus: module.runtimeStatus,
                implementationStatus: module.implementationStatus,
                implementationError: module.implementationError,
                implementationCheckedAt: module.implementationCheckedAt,
                releaseNotes: module.releaseNotes,
                dependencies: module.dependencies,
                businessDomainId: module.businessDomainId,
                createdAt: module.createdAt,
                updatedAt: module.updatedAt,
            },
        });
    }
    async update(id, module) {
        await this.prisma.moduleRegistry.update({
            where: { id },
            data: {
                name: module.name,
                description: module.description,
                version: module.version,
                lifecycleStatus: module.lifecycleStatus,
                runtimeStatus: module.runtimeStatus,
                implementationStatus: module.implementationStatus,
                implementationError: module.implementationError,
                implementationCheckedAt: module.implementationCheckedAt,
                releaseNotes: module.releaseNotes,
                dependencies: module.dependencies,
                businessDomainId: module.businessDomainId,
                updatedAt: new Date(),
            },
        });
    }
    async updateImplementationCheck(id, status, error, checkedAt) {
        await this.prisma.moduleRegistry.update({
            where: { id },
            data: {
                implementationStatus: status,
                implementationError: error,
                implementationCheckedAt: checkedAt,
                updatedAt: new Date(),
            },
        });
    }
    async updateLifecycleStatus(id, status) {
        await this.prisma.moduleRegistry.update({
            where: { id },
            data: {
                lifecycleStatus: status,
                updatedAt: new Date(),
            },
        });
    }
    async updateRuntimeStatus(id, status) {
        await this.prisma.moduleRegistry.update({
            where: { id },
            data: {
                runtimeStatus: status,
                updatedAt: new Date(),
            },
        });
    }
    async delete(id) {
        await this.prisma.moduleRegistry.delete({
            where: { id },
        });
    }
    async getByLifecycleStatus(status) {
        const records = await this.prisma.moduleRegistry.findMany({
            where: { lifecycleStatus: status },
            orderBy: { name: 'asc' },
        });
        return records.map((r) => this.toDomain(r));
    }
    toDomain(record) {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        return {
            id: record.id,
            code: (_a = record.code) !== null && _a !== void 0 ? _a : record.id,
            name: record.name,
            description: (_b = record.description) !== null && _b !== void 0 ? _b : '',
            version: (_c = record.version) !== null && _c !== void 0 ? _c : '1.0.0',
            lifecycleStatus: record.lifecycleStatus,
            runtimeStatus: record.runtimeStatus,
            implementationStatus: record.implementationStatus,
            implementationError: (_d = record.implementationError) !== null && _d !== void 0 ? _d : undefined,
            implementationCheckedAt: (_e = record.implementationCheckedAt) !== null && _e !== void 0 ? _e : undefined,
            releaseNotes: (_f = record.releaseNotes) !== null && _f !== void 0 ? _f : undefined,
            dependencies: (_g = record.dependencies) !== null && _g !== void 0 ? _g : [],
            businessDomainId: (_h = record.businessDomainId) !== null && _h !== void 0 ? _h : undefined,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
        };
    }
}
exports.PrismaModuleRegistryRepository = PrismaModuleRegistryRepository;
//# sourceMappingURL=PrismaModuleRegistryRepository.js.map