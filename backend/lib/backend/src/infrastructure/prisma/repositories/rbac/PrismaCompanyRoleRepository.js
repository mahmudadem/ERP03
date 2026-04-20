"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaCompanyRoleRepository = void 0;
class PrismaCompanyRoleRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    toDomain(data) {
        return {
            id: data.id,
            companyId: data.companyId,
            name: data.name,
            description: undefined,
            permissions: data.permissions || [],
            moduleBundles: data.moduleBundles || [],
            explicitPermissions: data.explicitPermissions || [],
            resolvedPermissions: data.resolvedPermissions || [],
            sourceTemplateId: undefined,
            isDefaultForNewUsers: undefined,
            isSystem: undefined,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
        };
    }
    async getAll(companyId) {
        const data = await this.prisma.companyRole.findMany({
            where: { companyId },
            orderBy: { name: 'asc' },
        });
        return data.map((d) => this.toDomain(d));
    }
    async getById(companyId, roleId) {
        const data = await this.prisma.companyRole.findFirst({
            where: { id: roleId, companyId },
        });
        if (!data)
            return null;
        return this.toDomain(data);
    }
    async create(role) {
        await this.prisma.companyRole.create({
            data: {
                id: role.id,
                companyId: role.companyId,
                name: role.name,
                permissions: role.permissions,
                moduleBundles: (role.moduleBundles || []),
                explicitPermissions: (role.explicitPermissions || []),
                resolvedPermissions: (role.resolvedPermissions || []),
            },
        });
    }
    async update(companyId, roleId, role) {
        const updateData = {};
        if (role.name !== undefined)
            updateData.name = role.name;
        if (role.permissions !== undefined)
            updateData.permissions = role.permissions;
        if (role.moduleBundles !== undefined)
            updateData.moduleBundles = role.moduleBundles;
        if (role.explicitPermissions !== undefined)
            updateData.explicitPermissions = role.explicitPermissions;
        if (role.resolvedPermissions !== undefined)
            updateData.resolvedPermissions = role.resolvedPermissions;
        await this.prisma.companyRole.updateMany({
            where: { id: roleId, companyId },
            data: updateData,
        });
    }
    async delete(companyId, roleId) {
        await this.prisma.companyRole.deleteMany({
            where: { id: roleId, companyId },
        });
    }
}
exports.PrismaCompanyRoleRepository = PrismaCompanyRoleRepository;
//# sourceMappingURL=PrismaCompanyRoleRepository.js.map