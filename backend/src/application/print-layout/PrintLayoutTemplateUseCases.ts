import { randomUUID } from 'crypto';
import { PrintLayoutTemplate } from '../../domain/print-layout/PrintLayoutTemplate';
import { IPrintLayoutTemplateRepository } from '../../repository/interfaces/print-layout/IPrintLayoutTemplateRepository';
import { IPrintLayoutCore, PrintDocumentType, PrintLayoutSchema } from '../system-core';

export interface SavePrintLayoutTemplateInput {
  companyId: string;
  id?: string;
  name: string;
  documentType: PrintDocumentType;
  layout: PrintLayoutSchema;
  isDefault?: boolean;
  actorUserId: string;
}

export class ListPrintLayoutTemplatesUseCase {
  constructor(private readonly repo: IPrintLayoutTemplateRepository) {}

  execute(companyId: string, documentType?: PrintDocumentType): Promise<PrintLayoutTemplate[]> {
    return this.repo.list(companyId, documentType);
  }
}

export class GetPrintLayoutTemplateUseCase {
  constructor(private readonly repo: IPrintLayoutTemplateRepository) {}

  async execute(companyId: string, id: string): Promise<PrintLayoutTemplate> {
    const template = await this.repo.getById(companyId, id);
    if (!template) throw new Error(`Print layout template not found: ${id}`);
    return template;
  }
}

export class SavePrintLayoutTemplateUseCase {
  constructor(
    private readonly repo: IPrintLayoutTemplateRepository,
    private readonly printLayoutCore: IPrintLayoutCore
  ) {}

  async execute(input: SavePrintLayoutTemplateInput): Promise<PrintLayoutTemplate> {
    const schema = this.printLayoutCore.getDataSchema(input.documentType);
    this.printLayoutCore.validateLayout(input.layout, schema);
    const now = new Date();
    const existing = input.id ? await this.repo.getById(input.companyId, input.id) : null;
    const template = new PrintLayoutTemplate({
      id: existing?.id || `print_layout_${randomUUID()}`,
      companyId: input.companyId,
      name: input.name,
      documentType: input.documentType,
      layout: input.layout,
      isDefault: input.isDefault === true,
      createdBy: existing?.createdBy || input.actorUserId,
      updatedBy: input.actorUserId,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    });
    if (template.isDefault) await this.repo.clearDefault(input.companyId, input.documentType, template.id);
    if (existing) await this.repo.update(template);
    else await this.repo.create(template);
    return template;
  }
}

export class CreateDefaultPrintLayoutTemplateUseCase {
  constructor(
    private readonly repo: IPrintLayoutTemplateRepository,
    private readonly printLayoutCore: IPrintLayoutCore
  ) {}

  async execute(companyId: string, documentType: PrintDocumentType, actorUserId: string): Promise<PrintLayoutTemplate> {
    const existing = await this.repo.getDefault(companyId, documentType);
    if (existing) return existing;
    const layout = this.printLayoutCore.createDefaultLayout(documentType);
    const template = new PrintLayoutTemplate({
      id: `print_layout_${randomUUID()}`,
      companyId,
      name: `${String(documentType).replace(/_/g, ' ')} Default`,
      documentType,
      layout,
      isDefault: true,
      createdBy: actorUserId,
      updatedBy: actorUserId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await this.repo.clearDefault(companyId, documentType, template.id);
    await this.repo.create(template);
    return template;
  }
}

export class DeletePrintLayoutTemplateUseCase {
  constructor(private readonly repo: IPrintLayoutTemplateRepository) {}

  async execute(companyId: string, id: string): Promise<void> {
    const existing = await this.repo.getById(companyId, id);
    if (!existing) return;
    if (existing.isDefault) throw new Error('Default print layout cannot be deleted until another default is selected.');
    await this.repo.delete(companyId, id);
  }
}
