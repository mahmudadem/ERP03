"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaPermissionRegistryRepository = void 0;
class PrismaPermissionRegistryRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getAll() {
        const records = await this.prisma.permissionRegistry.findMany({
            orderBy: { name: 'asc' },
        });
        return records.map((r) => this.toDomain(r));
    }
    async getById(id) {
        const record = await this.prisma.permissionRegistry.findUnique({
            where: { id },
        });
        if (!record)
            return null;
        return this.toDomain(record);
    }
    async create(permission) {
        await this.prisma.permissionRegistry.create({
            data: {
                id: permission.id,
                code: permission.id,
                name: permission.name,
                module: '',
                description: permission.description,
                createdAt: permission.createdAt,
                updatedAt: permission.updatedAt,
            },
        });
    }
    async update(id, permission) {
        const updateData = {};
        if (permission.name !== undefined)
            updateData.name = permission.name;
        if (permission.description !== undefined)
            updateData.description = permission.description;
        updateData.updatedAt = new Date();
        await this.prisma.permissionRegistry.update({
            where: { id },
            data: updateData,
        });
    }
    async delete(id) {
        await this.prisma.permissionRegistry.delete({
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
exports.PrismaPermissionRegistryRepository = PrismaPermissionRegistryRepository;
//# sourceMappingURL=PrismaPermissionRegistryRepository.js.map