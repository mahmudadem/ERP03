import { PrismaClient } from '@prisma/client';
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
        headerFields: def.headerFields as any,
        tableColumns: def.tableColumns as any,
        layout: def.layout as any,
        schemaVersion: def.schemaVersion,
        requiredPostingRoles: (def.requiredPostingRoles || []) as string[],
        workflow: def.workflow as any,
        uiModeOverrides: def.uiModeOverrides as any,
        isMultiLine: def.isMultiLine ?? true,
        rules: def.rules as any,
        actions: def.actions as any,
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
        headerFields: data.headerFields as any,
        tableColumns: data.tableColumns as any,
        layout: data.layout as any,
        schemaVersion: data.schemaVersion,
        requiredPostingRoles: data.requiredPostingRoles as any,
        workflow: data.workflow as any,
        uiModeOverrides: data.uiModeOverrides as any,
        isMultiLine: data.isMultiLine,
        rules: data.rules as any,
        actions: data.actions as any,
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
      data: { layout: layout as any },
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
    return new VoucherTypeDefinition(
      record.id,
      record.companyId,
      record.name,
      record.code,
      record.module,
      (record.headerFields as FieldDefinition[]) || [],
      (record.tableColumns as TableColumn[]) || [],
      (record.layout as Record<string, any>) || {},
      record.schemaVersion,
      (record.requiredPostingRoles as PostingRole[]) || [],
      record.workflow as any,
      record.uiModeOverrides as any,
      record.isMultiLine,
      (record.rules as any[]) || [],
      (record.actions as any[]) || [],
      record.defaultCurrency
    );
  }
}
