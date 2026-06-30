import { PrismaClient } from '@prisma/client';
import { IVoucherFormRepository, VoucherFormDefinition } from '../../../../repository/interfaces/designer/IVoucherFormRepository';

export class PrismaVoucherFormRepository implements IVoucherFormRepository {
  constructor(private prisma: PrismaClient) {}

  async create(form: VoucherFormDefinition): Promise<VoucherFormDefinition> {
    const record = await this.prisma.voucherForm.create({
      data: {
        id: form.id,
        companyId: form.companyId,
        voucherTypeId: form.typeId,
        formDefinitionId: form.id,
        createdAt: form.createdAt,
        updatedAt: form.updatedAt,
      } as any,
    });
    return this.toDomain(record, form);
  }

  async getById(companyId: string, formId: string): Promise<VoucherFormDefinition | null> {
    const record = await this.prisma.voucherForm.findFirst({
      where: { id: formId, companyId },
      include: { voucherType: true },
    });
    if (!record) return null;
    const fullForm = this.getStoredDefinition(record);
    if (!fullForm) return null;
    return this.toDomain(record, fullForm);
  }

  async getByTypeId(companyId: string, typeId: string): Promise<VoucherFormDefinition[]> {
    const records = await this.prisma.voucherForm.findMany({
      where: { companyId, voucherTypeId: typeId },
      include: { voucherType: true },
      orderBy: { createdAt: 'asc' },
    });
    return records
      .map((record) => {
        const fullForm = this.getStoredDefinition(record);
        return fullForm ? this.toDomain(record, fullForm) : null;
      })
      .filter((form): form is VoucherFormDefinition => !!form);
  }

  async getDefaultForType(companyId: string, typeId: string): Promise<VoucherFormDefinition | null> {
    const record = await this.prisma.voucherForm.findFirst({
      where: { companyId, voucherTypeId: typeId },
      include: { voucherType: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!record) return null;
    const fullForm = this.getStoredDefinition(record);
    if (!fullForm) return null;
    return this.toDomain(record, fullForm);
  }

  async getAllByCompany(companyId: string): Promise<VoucherFormDefinition[]> {
    const records = await this.prisma.voucherForm.findMany({
      where: { companyId },
      include: { voucherType: true },
      orderBy: { createdAt: 'asc' },
    });
    const results: VoucherFormDefinition[] = [];
    for (const r of records) {
      const fullForm = this.getStoredDefinition(r);
      if (fullForm) {
        results.push(this.toDomain(r, fullForm));
      }
    }
    return results;
  }

  async update(companyId: string, formId: string, updates: Partial<VoucherFormDefinition>): Promise<void> {
    await this.prisma.voucherForm.update({
      where: { id: formId, companyId },
      data: {
        updatedAt: new Date(),
      },
    });
  }

  async delete(companyId: string, formId: string): Promise<void> {
    await this.prisma.voucherForm.delete({
      where: { id: formId, companyId },
    });
  }

  private getStoredDefinition(stored: any): VoucherFormDefinition | null {
    if (!stored?.voucherType) return null;
    const voucherType = stored.voucherType;
    const layout = (voucherType.layout as Record<string, any>) || {};
    const meta = (layout._meta as Record<string, any>) || {};
    const code = String(voucherType.code || stored.id || '').trim();
    const baseType = code.toLowerCase();

    return {
      id: stored.id,
      companyId: stored.companyId,
      typeId: stored.voucherTypeId,
      module: voucherType.module,
      name: voucherType.name,
      code,
      description: `Default form for ${voucherType.name}`,
      prefix: code.slice(0, 3).toUpperCase() || 'V',
      isDefault: true,
      isSystemGenerated: true,
      isLocked: true,
      enabled: true,
      headerFields: (voucherType.headerFields as any[]) || [],
      tableColumns: (voucherType.tableColumns as any[]) || [],
      layout,
      uiModeOverrides: voucherType.uiModeOverrides,
      rules: (voucherType.rules as any[]) || [],
      actions: (voucherType.actions as any[]) || [],
      isMultiLine: voucherType.isMultiLine,
      tableStyle: 'web',
      defaultCurrency: voucherType.defaultCurrency || '',
      formType: code || stored.id,
      voucherType: typeof meta.voucherType === 'string' ? meta.voucherType : code || stored.id,
      persona: typeof meta.persona === 'string' ? meta.persona : undefined,
      baseType: baseType || stored.id,
      sidebarGroup: typeof meta.sidebarGroup === 'string' ? meta.sidebarGroup : undefined,
      createdAt: stored.createdAt,
      updatedAt: stored.updatedAt,
    };
  }

  private toDomain(record: any, form: VoucherFormDefinition): VoucherFormDefinition {
    return {
      ...form,
      id: record.id,
      companyId: record.companyId,
      typeId: record.voucherTypeId,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}
