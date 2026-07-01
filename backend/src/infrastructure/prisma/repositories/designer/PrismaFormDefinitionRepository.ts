import { Prisma, PrismaClient } from '@prisma/client';
import { IFormDefinitionRepository } from '../../../../repository/interfaces/designer/IFormDefinitionRepository';
import { FormDefinition, FormSection } from '../../../../domain/designer/entities/FormDefinition';
import { FieldDefinition } from '../../../../domain/designer/entities/FieldDefinition';

export class PrismaFormDefinitionRepository implements IFormDefinitionRepository {
  constructor(private prisma: PrismaClient) {}

  async createFormDefinition(def: FormDefinition): Promise<void> {
    await this.prisma.formDefinition.create({
      data: {
        id: def.id,
        companyId: 'GLOBAL',
        name: def.name,
        module: def.module,
        type: def.type,
        fields: def.fields as unknown as Prisma.InputJsonValue,
        sections: def.sections as unknown as Prisma.InputJsonValue,
      },
    });
  }

  async updateFormDefinition(id: string, data: Partial<FormDefinition>): Promise<void> {
    await this.prisma.formDefinition.update({
      where: { id },
      data: {
        name: data.name,
        module: data.module,
        type: data.type,
        fields: data.fields as unknown as Prisma.InputJsonValue,
        sections: data.sections as unknown as Prisma.InputJsonValue,
      },
    });
  }

  async getFormDefinition(id: string): Promise<FormDefinition | null> {
    const record = await this.prisma.formDefinition.findUnique({
      where: { id },
    });
    if (!record) return null;
    return this.toDomain(record);
  }

  async getDefinitionsForModule(module: string): Promise<FormDefinition[]> {
    const records = await this.prisma.formDefinition.findMany({
      where: { module },
      orderBy: { name: 'asc' },
    });
    return records.map((r) => this.toDomain(r));
  }

  private toDomain(record: any): FormDefinition {
    return new FormDefinition(
      record.id,
      record.name,
      record.module,
      record.type,
      (record.fields as unknown as FieldDefinition[]) || [],
      (record.sections as unknown as FormSection[]) || []
    );
  }
}
