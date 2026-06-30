import { Prisma, PrismaClient } from '@prisma/client';
import { IVoucherTypeDefinitionRepository } from '../../../../repository/interfaces/designer/IVoucherTypeDefinitionRepository';
import { VoucherTypeDefinition, TableColumn } from '../../../../domain/designer/entities/VoucherTypeDefinition';
import { FieldDefinition } from '../../../../domain/designer/entities/FieldDefinition';
import { PostingRole } from '../../../../domain/designer/entities/PostingRole';

export class PrismaVoucherTypeDefinitionRepository implements IVoucherTypeDefinitionRepository {
  constructor(private prisma: PrismaClient) {}

  async createVoucherType(def: VoucherTypeDefinition): Promise<void> {
    await this.prisma.voucherTypeDefinition.create({
      data: {
        id: def.id,
        companyId: def.companyId,
        name: def.name,
        code: def.code,
        module: def.module,
        headerFields: def.headerFields as unknown as Prisma.InputJsonValue,
        tableColumns: def.tableColumns as unknown as Prisma.InputJsonValue,
        layout: def.layout,
        schemaVersion: def.schemaVersion,
        requiredPostingRoles: (def.requiredPostingRoles || []) as string[],
        workflow: def.workflow,
        uiModeOverrides: def.uiModeOverrides,
        isMultiLine: def.isMultiLine ?? true,
        rules: def.rules,
        actions: def.actions,
        defaultCurrency: def.defaultCurrency ?? 'USD',
      },
    });
  }

  async updateVoucherType(companyId: string, id: string, data: Partial<VoucherTypeDefinition>): Promise<void> {
    await this.prisma.voucherTypeDefinition.update({
      where: { id, companyId },
      data: {
        name: data.name,
        code: data.code,
        module: data.module,
        headerFields: data.headerFields as unknown as Prisma.InputJsonValue,
        tableColumns: data.tableColumns as unknown as Prisma.InputJsonValue,
        layout: data.layout,
        schemaVersion: data.schemaVersion,
        requiredPostingRoles: data.requiredPostingRoles,
        workflow: data.workflow,
        uiModeOverrides: data.uiModeOverrides,
        isMultiLine: data.isMultiLine,
        rules: data.rules,
        actions: data.actions,
        defaultCurrency: data.defaultCurrency,
      },
    });
  }

  async getVoucherType(companyId: string, id: string): Promise<VoucherTypeDefinition | null> {
    const record = await this.prisma.voucherTypeDefinition.findFirst({
      where: { id, companyId },
    });
    if (!record) return null;
    return this.toDomain(record);
  }

  async getVoucherTypesForModule(companyId: string, module: string): Promise<VoucherTypeDefinition[]> {
    const records = await this.prisma.voucherTypeDefinition.findMany({
      where: { companyId, module },
      orderBy: { name: 'asc' },
    });
    return records.map((r) => this.toDomain(r));
  }

  async getByCompanyId(companyId: string): Promise<VoucherTypeDefinition[]> {
    const records = await this.prisma.voucherTypeDefinition.findMany({
      where: { companyId },
      orderBy: { name: 'asc' },
    });
    return records.map((r) => this.toDomain(r));
  }

  async getByCode(companyId: string, code: string): Promise<VoucherTypeDefinition | null> {
    const record = await this.prisma.voucherTypeDefinition.findFirst({
      where: { companyId, code },
    });
    if (!record) return null;
    return this.toDomain(record);
  }

  async updateLayout(companyId: string, code: string, layout: any): Promise<void> {
    await this.prisma.voucherTypeDefinition.updateMany({
      where: { companyId, code },
      data: { layout: layout },
    });
  }

  async getSystemTemplates(): Promise<VoucherTypeDefinition[]> {
    const records = await this.prisma.voucherTypeDefinition.findMany({
      where: { companyId: 'SYSTEM' },
      orderBy: { name: 'asc' },
    });
    return records.map((r) => this.toDomain(r));
  }

  async deleteVoucherType(companyId: string, id: string): Promise<void> {
    await this.prisma.voucherTypeDefinition.delete({
      where: { id, companyId },
    });
  }

  private toDomain(record: any): VoucherTypeDefinition {
    const layout = (record.layout as Record<string, any>) || {};
    const meta = (layout._meta as Record<string, any>) || {};
    return new VoucherTypeDefinition(
      record.id,
      record.companyId,
      record.name,
      record.code,
      record.module,
      (record.headerFields as FieldDefinition[]) || [],
      (record.tableColumns as TableColumn[]) || [],
      layout,
      record.schemaVersion,
      (record.requiredPostingRoles as PostingRole[]) || [],
      record.workflow,
      record.uiModeOverrides,
      record.isMultiLine,
      (record.rules as unknown[]) || [],
      (record.actions as unknown[]) || [],
      record.defaultCurrency,
      typeof meta.voucherType === 'string' ? meta.voucherType : record.code,
      typeof meta.persona === 'string' ? meta.persona : undefined,
      typeof meta.sidebarGroup === 'string' ? meta.sidebarGroup : undefined
    );
  }
}
