"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaSystemRoleTemplateRepository = void 0;
class PrismaSystemRoleTemplateRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    toDomain(data) {
        return {
            id: data.id,
            name: data.name,
            description: data.description || undefined,
            permissions: data.permissions || [],
            isCore: false,
        };
    }
    async getAll() {
        const data = await this.prisma.systemRoleTemplate.findMany({
            orderBy: { name: 'asc' },
        });
        return data.map((d) => this.toDomain(d));
    }
    async getById(id) {
        const data = await this.prisma.systemRoleTemplate.findUnique({
            where: { id },
        });
        if (!data)
            return null;
        return this.toDomain(data);
    }
    async create(template) {
        await this.prisma.systemRoleTemplate.create({
            data: {
                id: template.id,
                code: template.id,
                name: template.name,
                description: template.description || null,
                permissions: template.permissions,
            },
        });
    }
    async update(id, template) {
        const updateData = {};
        if (template.name !== undefined)
            updateData.name = template.name;
        if (template.description !== undefined)
            updateData.description = template.description;
        if (template.permissions !== undefined)
            updateData.permissions = template.permissions;
        await this.prisma.systemRoleTemplate.update({
            where: { id },
            data: updateData,
        });
    }
    async delete(id) {
        await this.prisma.systemRoleTemplate.delete({
            where: { id },
        });
    }
}
exports.PrismaSystemRoleTemplateRepository = PrismaSystemRoleTemplateRepository;
//# sourceMappingURL=PrismaSystemRoleTemplateRepository.js.map