import { PrismaClient } from '@prisma/client';
import { IRoleRepository } from '../../../../repository/interfaces/system/IRoleRepository';
import { Role } from '../../../../domain/system/entities/Role';

export class PrismaRoleRepository implements IRoleRepository {
  constructor(private prisma: PrismaClient) {}

  private toDomain(data: any): Role {
    return new Role(
      data.id,
      data.name,
      (data.permissions as string[]) || [],
      (data.moduleBundles as string[]) || [],
      [],
      []
    );
  }

  async createRole(companyId: string, role: Role): Promise<void> {
    await this.prisma.role.create({
      data: {
        id: role.id,
        name: role.name,
        companyId,
        permissions: role.permissions as any,
        moduleBundles: (role.moduleBundles || []) as any,
      },
    });
  }

  async updateRole(roleId: string, data: Partial<Role>): Promise<void> {
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.permissions !== undefined) updateData.permissions = data.permissions as any;
    if (data.moduleBundles !== undefined) updateData.moduleBundles = data.moduleBundles as any;
    await this.prisma.role.update({
      where: { id: roleId },
      data: updateData,
    });
  }

  async getRole(roleId: string): Promise<Role | null> {
    const data = await this.prisma.role.findUnique({
      where: { id: roleId },
    });
    if (!data) return null;
    return this.toDomain(data);
  }

  async getCompanyRoles(companyId: string): Promise<Role[]> {
    const data = await this.prisma.role.findMany({
      where: { companyId },
      orderBy: { name: 'asc' },
    });
    return data.map((d) => this.toDomain(d));
  }

  async listSystemRoleTemplates(): Promise<Role[]> {
    const data = await this.prisma.systemRoleTemplate.findMany({
      orderBy: { name: 'asc' },
    });
    return data.map((d) => new Role(
      d.id,
      d.name,
      (d.permissions as string[]) || [],
      [],
      [],
      []
    ));
  }
}
