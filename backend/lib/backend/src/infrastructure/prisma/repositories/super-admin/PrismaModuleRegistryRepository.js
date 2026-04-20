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
    async create(module) {
        await this.prisma.moduleRegistry.create({
            data: {
                id: module.id,
                code: module.id,
                name: module.name,
                version: '1.0.0',
                description: module.description,
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
                updatedAt: new Date(),
            },
        });
    }
    async delete(id) {
        await this.prisma.moduleRegistry.delete({
            where: { id },
        });
    }
    toDomain(record) {
        var _a;
        return {
            id: record.id,
            name: record.name,
            description: (_a = record.description) !== null && _a !== void 0 ? _a : '',
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
        };
    }
}
exports.PrismaModuleRegistryRepository = PrismaModuleRegistryRepository;
//# sourceMappingURL=PrismaModuleRegistryRepository.js.map