"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaRoleRepository = void 0;
const Role_1 = require("../../../../domain/system/entities/Role");
class PrismaRoleRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    toDomain(data) {
        return new Role_1.Role(data.id, data.name, data.permissions || [], data.moduleBundles || [], [], []);
    }
    async createRole(companyId, role) {
        await this.prisma.role.create({
            data: {
                id: role.id,
                name: role.name,
                companyId,
                permissions: role.permissions,
                moduleBundles: (role.moduleBundles || []),
            },
        });
    }
    async updateRole(roleId, data) {
        const updateData = {};
        if (data.name !== undefined)
            updateData.name = data.name;
        if (data.permissions !== undefined)
            updateData.permissions = data.permissions;
        if (data.moduleBundles !== undefined)
            updateData.moduleBundles = data.moduleBundles;
        await this.prisma.role.update({
            where: { id: roleId },
            data: updateData,
        });
    }
    async getRole(roleId) {
        const data = await this.prisma.role.findUnique({
            where: { id: roleId },
        });
        if (!data)
            return null;
        return this.toDomain(data);
    }
    async getCompanyRoles(companyId) {
        const data = await this.prisma.role.findMany({
            where: { companyId },
            orderBy: { name: 'asc' },
        });
        return data.map((d) => this.toDomain(d));
    }
    async listSystemRoleTemplates() {
        const data = await this.prisma.systemRoleTemplate.findMany({
            orderBy: { name: 'asc' },
        });
        return data.map((d) => new Role_1.Role(d.id, d.name, d.permissions || [], [], [], []));
    }
}
exports.PrismaRoleRepository = PrismaRoleRepository;
//# sourceMappingURL=PrismaRoleRepository.js.map