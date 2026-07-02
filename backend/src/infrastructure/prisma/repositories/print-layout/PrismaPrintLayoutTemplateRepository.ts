import { Prisma, PrismaClient } from '@prisma/client';
import { PrintDocumentType } from '../../../../application/system-core/contracts/IPrintLayoutCore';
import { PrintLayoutTemplate } from '../../../../domain/print-layout/PrintLayoutTemplate';
import { IPrintLayoutTemplateRepository } from '../../../../repository/interfaces/print-layout/IPrintLayoutTemplateRepository';

export class PrismaPrintLayoutTemplateRepository implements IPrintLayoutTemplateRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private toDomain(row: any): PrintLayoutTemplate {
    return PrintLayoutTemplate.fromJSON({
      id: row.id,
      companyId: row.companyId,
      name: row.name,
      documentType: row.documentType,
      layout: row.layout,
      isDefault: row.isDefault,
      createdBy: row.createdBy,
      updatedBy: row.updatedBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  async create(template: PrintLayoutTemplate): Promise<void> {
    const data = template.toJSON();
    await (this.prisma).printLayoutTemplate.create({
      data: {
        id: data.id,
        companyId: data.companyId,
        name: data.name,
        documentType: data.documentType,
        layout: data.layout,
        isDefault: data.isDefault,
        createdBy: data.createdBy,
        updatedBy: data.updatedBy ?? null,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      },
    });
  }

  async update(template: PrintLayoutTemplate): Promise<void> {
    const data = template.toJSON();
    await (this.prisma).printLayoutTemplate.update({
      where: { id: template.id },
      data: {
        name: data.name,
        documentType: data.documentType,
        layout: data.layout,
        isDefault: data.isDefault,
        updatedBy: data.updatedBy ?? null,
        updatedAt: data.updatedAt,
      },
    });
  }

  async getById(companyId: string, id: string): Promise<PrintLayoutTemplate | null> {
    const row = await (this.prisma).printLayoutTemplate.findFirst({
      where: { id, companyId },
    });
    if (!row) return null;
    return this.toDomain(row);
  }

  async list(companyId: string, documentType?: PrintDocumentType): Promise<PrintLayoutTemplate[]> {
    const where: Prisma.PrintLayoutTemplateWhereInput = { companyId };
    if (documentType) where.documentType = documentType;
    const rows = await (this.prisma).printLayoutTemplate.findMany({ where });
    return rows
      .map((r: any) => this.toDomain(r))
      .sort((a: PrintLayoutTemplate, b: PrintLayoutTemplate) =>
        Number(b.isDefault) - Number(a.isDefault) || a.name.localeCompare(b.name)
      );
  }

  async getDefault(companyId: string, documentType: PrintDocumentType): Promise<PrintLayoutTemplate | null> {
    const row = await (this.prisma).printLayoutTemplate.findFirst({
      where: { companyId, documentType, isDefault: true },
    });
    if (!row) return null;
    return this.toDomain(row);
  }

  async clearDefault(companyId: string, documentType: PrintDocumentType, exceptId?: string): Promise<void> {
    const where: Prisma.PrintLayoutTemplateWhereInput = { companyId, documentType, isDefault: true };
    if (exceptId) where.id = { not: exceptId };
    await (this.prisma).printLayoutTemplate.updateMany({
      where,
      data: { isDefault: false, updatedAt: new Date() },
    });
  }

  async delete(companyId: string, id: string): Promise<void> {
    await (this.prisma).printLayoutTemplate.deleteMany({
      where: { id, companyId },
    });
  }
}
