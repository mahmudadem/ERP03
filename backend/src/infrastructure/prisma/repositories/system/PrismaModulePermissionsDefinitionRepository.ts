/**
 * PrismaModulePermissionsDefinitionRepository
 * Prisma (SQL) implementation of IModulePermissionsDefinitionRepository
 */

import { PrismaClient } from '@prisma/client';
import { IModulePermissionsDefinitionRepository } from '../../../../repository/interfaces/system/IModulePermissionsDefinitionRepository';

export class PrismaModulePermissionsDefinitionRepository implements IModulePermissionsDefinitionRepository {
  constructor(private prisma: PrismaClient) {}

  async list(): Promise<any[]> {
    const records = await this.prisma.modulePermissionsDefinition.findMany();

    return records.map(r => ({
      moduleId: r.moduleId,
      permissions: (r.permissions || []).map((p: any) => typeof p === 'string' ? { id: p, label: p } : p),
      autoAttachToRoles: [],
      createdAt: r.createdAt,
      updatedAt: r.updatedAt
    }));
  }

  async getByModuleId(moduleId: string): Promise<any | null> {
    const record = await this.prisma.modulePermissionsDefinition.findUnique({
      where: { moduleId }
    });

    if (!record) return null;

    return {
      moduleId: record.moduleId,
      permissions: (record.permissions || []).map((p: any) => typeof p === 'string' ? { id: p, label: p } : p),
      autoAttachToRoles: [],
      createdAt: record.createdAt,
      updatedAt: record.updatedAt
    };
  }

  async create(def: any): Promise<void> {
    const permissions = (def.permissions || []).map((p: any) => typeof p === 'string' ? p : p.id || p.label);

    await this.prisma.modulePermissionsDefinition.create({
      data: {
        moduleId: def.moduleId,
        permissions: permissions as any
      }
    });
  }

  async update(moduleId: string, partial: any): Promise<void> {
    const data: any = {};
    if (partial.permissions !== undefined) {
      data.permissions = (partial.permissions || []).map((p: any) => typeof p === 'string' ? p : p.id || p.label);
    }

    await this.prisma.modulePermissionsDefinition.update({
      where: { moduleId },
      data
    });
  }

  async delete(moduleId: string): Promise<void> {
    await this.prisma.modulePermissionsDefinition.delete({
      where: { moduleId }
    });
  }
}
