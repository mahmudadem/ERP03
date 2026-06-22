import { PrintLayoutTemplate } from '../../../domain/print-layout/PrintLayoutTemplate';
import { IPrintLayoutTemplateRepository } from '../../../repository/interfaces/print-layout/IPrintLayoutTemplateRepository';
import { PrintLayoutCore } from '../../../application/system-core/print-layout/PrintLayoutCore';
import {
  CreateDefaultPrintLayoutTemplateUseCase,
  SavePrintLayoutTemplateUseCase,
} from '../../../application/print-layout/PrintLayoutTemplateUseCases';

class InMemoryPrintLayoutTemplateRepository implements IPrintLayoutTemplateRepository {
  readonly templates = new Map<string, PrintLayoutTemplate>();

  async create(template: PrintLayoutTemplate): Promise<void> {
    this.templates.set(template.id, template);
  }

  async update(template: PrintLayoutTemplate): Promise<void> {
    this.templates.set(template.id, template);
  }

  async getById(companyId: string, id: string): Promise<PrintLayoutTemplate | null> {
    const template = this.templates.get(id);
    return template?.companyId === companyId ? template : null;
  }

  async list(companyId: string): Promise<PrintLayoutTemplate[]> {
    return [...this.templates.values()].filter((template) => template.companyId === companyId);
  }

  async getDefault(companyId: string, documentType: string): Promise<PrintLayoutTemplate | null> {
    return [...this.templates.values()].find((template) =>
      template.companyId === companyId && template.documentType === documentType && template.isDefault
    ) || null;
  }

  async clearDefault(companyId: string, documentType: string, exceptId?: string): Promise<void> {
    for (const template of this.templates.values()) {
      if (template.companyId === companyId && template.documentType === documentType && template.id !== exceptId) {
        template.isDefault = false;
      }
    }
  }

  async delete(companyId: string, id: string): Promise<void> {
    const template = this.templates.get(id);
    if (template?.companyId === companyId) this.templates.delete(id);
  }
}

describe('Print layout template use cases', () => {
  it('creates a reusable default layout and returns it idempotently', async () => {
    const repo = new InMemoryPrintLayoutTemplateRepository();
    const core = new PrintLayoutCore();
    const useCase = new CreateDefaultPrintLayoutTemplateUseCase(repo, core);

    const first = await useCase.execute('cmp_1', 'POS_RECEIPT', 'admin_1');
    const second = await useCase.execute('cmp_1', 'POS_RECEIPT', 'admin_1');

    expect(first.id).toBe(second.id);
    expect(first.layout.components.some((component) => component.type === 'table')).toBe(true);
  });

  it('saves one default per document type and rejects unknown bindings', async () => {
    const repo = new InMemoryPrintLayoutTemplateRepository();
    const core = new PrintLayoutCore();
    const defaultUseCase = new CreateDefaultPrintLayoutTemplateUseCase(repo, core);
    const saveUseCase = new SavePrintLayoutTemplateUseCase(repo, core);

    const defaultTemplate = await defaultUseCase.execute('cmp_1', 'POS_RECEIPT', 'admin_1');
    const layout = core.createDefaultLayout('POS_RECEIPT');
    const custom = await saveUseCase.execute({
      companyId: 'cmp_1',
      name: 'Receipt compact',
      documentType: 'POS_RECEIPT',
      layout,
      isDefault: true,
      actorUserId: 'admin_1',
    });

    expect((await repo.getById('cmp_1', defaultTemplate.id))?.isDefault).toBe(false);
    expect((await repo.getById('cmp_1', custom.id))?.isDefault).toBe(true);

    await expect(saveUseCase.execute({
      companyId: 'cmp_1',
      name: 'Broken',
      documentType: 'POS_RECEIPT',
      layout: {
        ...layout,
        components: [{ ...layout.components[0], fieldPath: 'unknown.field' }],
      },
      actorUserId: 'admin_1',
    })).rejects.toThrow(/Unknown print field/);
  });
});
