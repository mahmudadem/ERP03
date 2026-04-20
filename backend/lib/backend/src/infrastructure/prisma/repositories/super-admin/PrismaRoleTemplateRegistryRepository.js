"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaRoleTemplateRegistryRepository = void 0;
class PrismaRoleTemplateRegistryRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getAll() {
        const records = await this.prisma.roleTemplateRegistry.findMany({
            orderBy: { name: 'asc' },
        });
        return records.map((r) => this.toDomain(r));
    }
    async getById(id) {
        const record = await this.prisma.roleTemplateRegistry.findUnique({
            where: { id },
        });
        if (!record)
            return null;
        return this.toDomain(record);
    }
    async create(roleTemplate) {
        await this.prisma.roleTemplateRegistry.create({
            data: {
                id: roleTemplate.id,
                code: roleTemplate.id,
                name: roleTemplate.name,
                description: roleTemplate.description,
                permissions: roleTemplate.permissions,
                createdAt: roleTemplate.createdAt,
                updatedAt: roleTemplate.updatedAt,
            },
        });
    }
    async update(id, roleTemplate) {
        const updateData = {};
        if (roleTemplate.name !== undefined)
            updateData.name = roleTemplate.name;
        if (roleTemplate.description !== undefined)
            updateData.description = roleTemplate.description;
        if (roleTemplate.permissions !== undefined)
            updateData.permissions = roleTemplate.permissions;
        updateData.updatedAt = new Date();
        await this.prisma.roleTemplateRegistry.update({
            where: { id },
            data: updateData,
        });
    }
    async delete(id) {
        await this.prisma.roleTemplateRegistry.delete({
            where: { id },
        });
    }
    toDomain(record) {
        var _a, _b;
        return {
            id: record.id,
            name: record.name,
            description: (_a = record.description) !== null && _a !== void 0 ? _a : '',
            permissions: (_b = record.permissions) !== null && _b !== void 0 ? _b : [],
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
        };
    }
}
exports.PrismaRoleTemplateRegistryRepository = PrismaRoleTemplateRegistryRepository;
//# sourceMappingURL=PrismaRoleTemplateRegistryRepository.js.map