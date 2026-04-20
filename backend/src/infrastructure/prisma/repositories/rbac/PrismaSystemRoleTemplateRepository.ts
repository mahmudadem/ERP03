import { PrismaClient } from '@prisma/client';
import { ISystemRoleTemplateRepository } from '../../../../repository/interfaces/rbac/ISystemRoleTemplateRepository';
import { SystemRoleTemplate } from '../../../../domain/rbac/SystemRoleTemplate';

export class PrismaSystemRoleTemplateRepository implements ISystemRoleTemplateRepository {
  constructor(private prisma: PrismaClient) {}

  private toDomain(data: any): SystemRoleTemplate {
    return {
      id: data.id,
      name: data.name,
      description: data.description || undefined,
      permissions: (data.permissions as string[]) || [],
      isCore: false,
    };
  }

  async getAll(): Promise<SystemRoleTemplate[]> {
    const data = await this.prisma.systemRoleTemplate.findMany({
      orderBy: { name: 'asc' },
    });
    return data.map((d) => this.toDomain(d));
  }

  async getById(id: string): Promise<SystemRoleTemplate | null> {
    const data = await this.prisma.systemRoleTemplate.findUnique({
      where: { id },
    });
    if (!data) return null;
    return this.toDomain(data);
  }

  async create(template: SystemRoleTemplate): Promise<void> {
    await this.prisma.systemRoleTemplate.create({
      data: {
        id: template.id,
        code: template.id,
        name: template.name,
        description: template.description || null,
        permissions: template.permissions as any,
      },
    });
  }

  async update(id: string, template: Partial<SystemRoleTemplate>): Promise<void> {
    const updateData: any = {};
    if (template.name !== undefined) updateData.name = template.name;
    if (template.description !== undefined) updateData.description = template.description;
    if (template.permissions !== undefined) updateData.permissions = template.permissions as any;
    await this.prisma.systemRoleTemplate.update({
      where: { id },
      data: updateData,
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.systemRoleTemplate.delete({
      where: { id },
    });
  }
}
