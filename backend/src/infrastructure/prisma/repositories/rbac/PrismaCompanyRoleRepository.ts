import { Prisma, PrismaClient } from '@prisma/client';
import { ICompanyRoleRepository } from '../../../../repository/interfaces/rbac/ICompanyRoleRepository';
import { CompanyRole } from '../../../../domain/rbac/CompanyRole';

export class PrismaCompanyRoleRepository implements ICompanyRoleRepository {
  constructor(private prisma: PrismaClient) {}

  private toDomain(data: any): CompanyRole {
    return {
      id: data.id,
      companyId: data.companyId,
      name: data.name,
      description: undefined,
      permissions: (data.permissions as string[]) || [],
      moduleBundles: (data.moduleBundles as string[]) || [],
      explicitPermissions: (data.explicitPermissions as string[]) || [],
      resolvedPermissions: (data.resolvedPermissions as string[]) || [],
      sourceTemplateId: undefined,
      isDefaultForNewUsers: undefined,
      isSystem: undefined,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  }

  async getAll(companyId: string): Promise<CompanyRole[]> {
    const data = await this.prisma.companyRole.findMany({
      where: { companyId },
      orderBy: { name: 'asc' },
    });
    return data.map((d) => this.toDomain(d));
  }

  async getById(companyId: string, roleId: string): Promise<CompanyRole | null> {
    const data = await this.prisma.companyRole.findFirst({
      where: { id: roleId, companyId },
    });
    if (!data) return null;
    return this.toDomain(data);
  }

  async create(role: CompanyRole): Promise<void> {
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

  async update(companyId: string, roleId: string, role: Partial<CompanyRole>): Promise<void> {
    const updateData: Prisma.CompanyRoleUpdateManyMutationInput = {};
    if (role.name !== undefined) updateData.name = role.name;
    if (role.permissions !== undefined) updateData.permissions = role.permissions;
    if (role.moduleBundles !== undefined) updateData.moduleBundles = role.moduleBundles;
    if (role.explicitPermissions !== undefined) updateData.explicitPermissions = role.explicitPermissions;
    if (role.resolvedPermissions !== undefined) updateData.resolvedPermissions = role.resolvedPermissions;
    await this.prisma.companyRole.updateMany({
      where: { id: roleId, companyId },
      data: updateData,
    });
  }

  async delete(companyId: string, roleId: string): Promise<void> {
    await this.prisma.companyRole.deleteMany({
      where: { id: roleId, companyId },
    });
  }
}
