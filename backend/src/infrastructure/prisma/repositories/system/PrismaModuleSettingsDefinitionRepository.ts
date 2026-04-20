/**
 * PrismaModuleSettingsDefinitionRepository
 * Prisma (SQL) implementation of IModuleSettingsDefinitionRepository
 */

import { PrismaClient } from '@prisma/client';
import { IModuleSettingsDefinitionRepository } from '../../../../repository/interfaces/system/IModuleSettingsDefinitionRepository';

export class PrismaModuleSettingsDefinitionRepository implements IModuleSettingsDefinitionRepository {
  constructor(private prisma: PrismaClient) {}

  async listDefinitions(): Promise<any[]> {
    const records = await this.prisma.moduleSettingsDefinition.findMany();

    return records.map(r => ({
      moduleId: r.moduleId,
      fields: (r.settingsSchema as any)?.fields || [],
      createdBy: 'system',
      updatedAt: r.updatedAt,
      autoAttachToRoles: []
    }));
  }

  async getDefinition(moduleId: string): Promise<any | null> {
    const record = await this.prisma.moduleSettingsDefinition.findUnique({
      where: { moduleId }
    });

    if (!record) return null;

    return {
      moduleId: record.moduleId,
      fields: (record.settingsSchema as any)?.fields || [],
      createdBy: 'system',
      updatedAt: record.updatedAt,
      autoAttachToRoles: []
    };
  }

  async createDefinition(def: any): Promise<void> {
    await this.prisma.moduleSettingsDefinition.create({
      data: {
        moduleId: def.moduleId,
        settingsSchema: { fields: def.fields || [] }
      }
    });
  }

  async updateDefinition(moduleId: string, def: any): Promise<void> {
    const data: any = {};
    if (def.fields !== undefined) {
      data.settingsSchema = { fields: def.fields };
    }

    await this.prisma.moduleSettingsDefinition.update({
      where: { moduleId },
      data
    });
  }

  async deleteDefinition(moduleId: string): Promise<void> {
    await this.prisma.moduleSettingsDefinition.delete({
      where: { moduleId }
    });
  }
}
