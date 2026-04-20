import { PrismaClient } from '@prisma/client';
import { IPermissionRegistryRepository } from '../../../../repository/interfaces/super-admin/IPermissionRegistryRepository';
import { PermissionDefinition } from '../../../../domain/super-admin/PermissionDefinition';

export class PrismaPermissionRegistryRepository implements IPermissionRegistryRepository {
  constructor(private prisma: PrismaClient) {}

  async getAll(): Promise<PermissionDefinition[]> {
    const records = await this.prisma.permissionRegistry.findMany({
      orderBy: { name: 'asc' },
    });
    return records.map((r) => this.toDomain(r));
  }

  async getById(id: string): Promise<PermissionDefinition | null> {
    const record = await this.prisma.permissionRegistry.findUnique({
      where: { id },
    });
    if (!record) return null;
    return this.toDomain(record);
  }

  async create(permission: PermissionDefinition): Promise<void> {
    await this.prisma.permissionRegistry.create({
      data: {
        id: permission.id,
        code: permission.id,
        name: permission.name,
        module: '',
        description: permission.description,
        createdAt: permission.createdAt,
        updatedAt: permission.updatedAt,
      },
    });
  }

  async update(id: string, permission: Partial<PermissionDefinition>): Promise<void> {
    const updateData: any = {};
    if (permission.name !== undefined) updateData.name = permission.name;
    if (permission.description !== undefined) updateData.description = permission.description;
    updateData.updatedAt = new Date();

    await this.prisma.permissionRegistry.update({
      where: { id },
      data: updateData,
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.permissionRegistry.delete({
      where: { id },
    });
  }

  private toDomain(record: any): PermissionDefinition {
    return {
      id: record.id,
      name: record.name,
      description: record.description ?? '',
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}
