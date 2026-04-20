"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaPermissionRepository = void 0;
const Permission_1 = require("../../../../domain/system/entities/Permission");
class PrismaPermissionRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    toDomain(data) {
        return new Permission_1.Permission(data.id, data.code, data.description || '');
    }
    async getPermissionsByRole(roleId) {
        const role = await this.prisma.role.findUnique({
            where: { id: roleId },
        });
        if (!role)
            return [];
        const permissionCodes = role.permissions || [];
        if (permissionCodes.length === 0)
            return [];
        const data = await this.prisma.permission.findMany({
            where: {
                code: { in: permissionCodes },
            },
            orderBy: { code: 'asc' },
        });
        return data.map((d) => this.toDomain(d));
    }
    async assignPermissions(roleId, permissions) {
        await this.prisma.role.update({
            where: { id: roleId },
            data: { permissions: permissions },
        });
    }
}
exports.PrismaPermissionRepository = PrismaPermissionRepository;
//# sourceMappingURL=PrismaPermissionRepository.js.map