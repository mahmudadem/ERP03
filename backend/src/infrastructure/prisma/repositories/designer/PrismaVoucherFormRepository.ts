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
    });
    if (!record) return null;
    const fullForm = await this.getStoredDefinition(formId);
    if (!fullForm) return null;
    return this.toDomain(record, fullForm);
  }

  async getByTypeId(companyId: string, typeId: string): Promise<VoucherFormDefinition[]> {
    const records = await this.prisma.voucherForm.findMany({
      where: { companyId, voucherTypeId: typeId },
      orderBy: { createdAt: 'asc' },
    });
    return records.map((r) => {
      const fullForm = this.getStoredDefinition(r.id);
      return fullForm.then((f) => this.toDomain(r, f!));
    }).reduce(async (acc, p) => {
      const results = await acc;
      results.push(await p);
      return results;
    }, Promise.resolve([] as VoucherFormDefinition[]));
  }

  async getDefaultForType(companyId: string, typeId: string): Promise<VoucherFormDefinition | null> {
    const record = await this.prisma.voucherForm.findFirst({
      where: { companyId, voucherTypeId: typeId },
      orderBy: { createdAt: 'asc' },
    });
    if (!record) return null;
    const fullForm = await this.getStoredDefinition(record.id);
    if (!fullForm) return null;
    return this.toDomain(record, fullForm);
  }

  async getAllByCompany(companyId: string): Promise<VoucherFormDefinition[]> {
    const records = await this.prisma.voucherForm.findMany({
      where: { companyId },
      orderBy: { createdAt: 'asc' },
    });
    const results: VoucherFormDefinition[] = [];
    for (const r of records) {
      const fullForm = await this.getStoredDefinition(r.id);
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

  private async getStoredDefinition(formId: string): Promise<VoucherFormDefinition | null> {
    const stored = await this.prisma.voucherForm.findUnique({
      where: { id: formId },
    });
    if (!stored) return null;
    return {
      id: stored.id,
      companyId: stored.companyId,
      typeId: stored.voucherTypeId,
      module: undefined,
      name: '',
      code: '',
      isDefault: false,
      isSystemGenerated: false,
      isLocked: false,
      enabled: true,
      headerFields: [],
      tableColumns: [],
      layout: {},
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
