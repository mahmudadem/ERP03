import { PrismaClient } from '@prisma/client';
import { IPermissionRepository } from '../../../../repository/interfaces/rbac/IPermissionRepository';
import { Permission } from '../../../../domain/rbac/Permission';

export class PrismaPermissionRepository implements IPermissionRepository {
  constructor(private prisma: PrismaClient) {}

  private toDomain(data: any): Permission {
    return {
      id: data.id,
      category: data.module || '',
      labelEn: data.description || data.code || '',
      labelAr: data.description || data.code || '',
      labelTr: data.description || data.code || '',
      descriptionEn: data.description || undefined,
      descriptionAr: undefined,
      descriptionTr: undefined,
    };
  }

  async getAll(): Promise<Permission[]> {
    const data = await this.prisma.permission.findMany({
      orderBy: { code: 'asc' },
    });
    return data.map((d) => this.toDomain(d));
  }

  async getById(id: string): Promise<Permission | null> {
    const data = await this.prisma.permission.findUnique({
      where: { id },
    });
    if (!data) return null;
    return this.toDomain(data);
  }

  async create(permission: Permission): Promise<void> {
    await this.prisma.permission.create({
      data: {
        id: permission.id,
        code: permission.category,
        description: permission.descriptionEn || null,
      },
    });
  }

  async update(id: string, permission: Partial<Permission>): Promise<void> {
    const updateData: any = {};
    if (permission.category !== undefined) updateData.code = permission.category;
    if (permission.descriptionEn !== undefined) updateData.description = permission.descriptionEn;
    if (permission.labelEn !== undefined) updateData.description = permission.labelEn;
    await this.prisma.permission.update({
      where: { id },
      data: updateData,
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.permission.delete({
      where: { id },
    });
  }
}
