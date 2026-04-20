import { PrismaClient } from '@prisma/client';
import { IRoleTemplateRegistryRepository } from '../../../../repository/interfaces/super-admin/IRoleTemplateRegistryRepository';
import { RoleTemplateDefinition } from '../../../../domain/super-admin/RoleTemplateDefinition';

export class PrismaRoleTemplateRegistryRepository implements IRoleTemplateRegistryRepository {
  constructor(private prisma: PrismaClient) {}

  async getAll(): Promise<RoleTemplateDefinition[]> {
    const records = await this.prisma.roleTemplateRegistry.findMany({
      orderBy: { name: 'asc' },
    });
    return records.map((r) => this.toDomain(r));
  }

  async getById(id: string): Promise<RoleTemplateDefinition | null> {
    const record = await this.prisma.roleTemplateRegistry.findUnique({
      where: { id },
    });
    if (!record) return null;
    return this.toDomain(record);
  }

  async create(roleTemplate: RoleTemplateDefinition): Promise<void> {
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

  async update(id: string, roleTemplate: Partial<RoleTemplateDefinition>): Promise<void> {
    const updateData: any = {};
    if (roleTemplate.name !== undefined) updateData.name = roleTemplate.name;
    if (roleTemplate.description !== undefined) updateData.description = roleTemplate.description;
    if (roleTemplate.permissions !== undefined) updateData.permissions = roleTemplate.permissions;
    updateData.updatedAt = new Date();

    await this.prisma.roleTemplateRegistry.update({
      where: { id },
      data: updateData,
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.roleTemplateRegistry.delete({
      where: { id },
    });
  }

  private toDomain(record: any): RoleTemplateDefinition {
    return {
      id: record.id,
      name: record.name,
      description: record.description ?? '',
      permissions: record.permissions ?? [],
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}
