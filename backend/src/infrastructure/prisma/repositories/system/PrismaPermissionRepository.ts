import { PrismaClient } from '@prisma/client';
import { IPermissionRepository } from '../../../../repository/interfaces/system/IPermissionRepository';
import { Permission } from '../../../../domain/system/entities/Permission';

export class PrismaPermissionRepository implements IPermissionRepository {
  constructor(private prisma: PrismaClient) {}

  private toDomain(data: any): Permission {
    return new Permission(
      data.id,
      data.code,
      data.description || ''
    );
  }

  async getPermissionsByRole(roleId: string): Promise<Permission[]> {
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
    });
    if (!role) return [];
    const permissionCodes = (role.permissions as string[]) || [];
    if (permissionCodes.length === 0) return [];
    const data = await this.prisma.permission.findMany({
      where: {
        code: { in: permissionCodes },
      },
      orderBy: { code: 'asc' },
    });
    return data.map((d) => this.toDomain(d));
  }

  async assignPermissions(roleId: string, permissions: string[]): Promise<void> {
    await this.prisma.role.update({
      where: { id: roleId },
      data: { permissions: permissions as any },
    });
  }
}
