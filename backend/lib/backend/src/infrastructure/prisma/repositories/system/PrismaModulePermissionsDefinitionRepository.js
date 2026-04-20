"use strict";
/**
 * PrismaModulePermissionsDefinitionRepository
 * Prisma (SQL) implementation of IModulePermissionsDefinitionRepository
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaModulePermissionsDefinitionRepository = void 0;
class PrismaModulePermissionsDefinitionRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async list() {
        const records = await this.prisma.modulePermissionsDefinition.findMany();
        return records.map(r => ({
            moduleId: r.moduleId,
            permissions: (r.permissions || []).map((p) => typeof p === 'string' ? { id: p, label: p } : p),
            autoAttachToRoles: [],
            createdAt: r.createdAt,
            updatedAt: r.updatedAt
        }));
    }
    async getByModuleId(moduleId) {
        const record = await this.prisma.modulePermissionsDefinition.findUnique({
            where: { moduleId }
        });
        if (!record)
            return null;
        return {
            moduleId: record.moduleId,
            permissions: (record.permissions || []).map((p) => typeof p === 'string' ? { id: p, label: p } : p),
            autoAttachToRoles: [],
            createdAt: record.createdAt,
            updatedAt: record.updatedAt
        };
    }
    async create(def) {
        const permissions = (def.permissions || []).map((p) => typeof p === 'string' ? p : p.id || p.label);
        await this.prisma.modulePermissionsDefinition.create({
            data: {
                moduleId: def.moduleId,
                permissions: permissions
            }
        });
    }
    async update(moduleId, partial) {
        const data = {};
        if (partial.permissions !== undefined) {
            data.permissions = (partial.permissions || []).map((p) => typeof p === 'string' ? p : p.id || p.label);
        }
        await this.prisma.modulePermissionsDefinition.update({
            where: { moduleId },
            data
        });
    }
    async delete(moduleId) {
        await this.prisma.modulePermissionsDefinition.delete({
            where: { moduleId }
        });
    }
}
exports.PrismaModulePermissionsDefinitionRepository = PrismaModulePermissionsDefinitionRepository;
//# sourceMappingURL=PrismaModulePermissionsDefinitionRepository.js.map