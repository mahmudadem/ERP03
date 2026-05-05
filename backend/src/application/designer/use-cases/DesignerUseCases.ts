
import { FormDefinition } from '../../../domain/designer/entities/FormDefinition';
import { VoucherTypeDefinition } from '../../../domain/designer/entities/VoucherTypeDefinition';
import { IFormDefinitionRepository, IVoucherTypeDefinitionRepository } from '../../../repository/interfaces/designer';
import { VoucherTypeDefinitionValidator } from '../../../domain/designer/validators/VoucherTypeDefinitionValidator';

export class CreateFormDefinitionUseCase {
  constructor(private repo: IFormDefinitionRepository) {}
  async execute(def: FormDefinition): Promise<void> {
    await this.repo.createFormDefinition(def);
  }
}

export class UpdateFormDefinitionUseCase {
  constructor(private repo: IFormDefinitionRepository) {}
  async execute(id: string, data: Partial<FormDefinition>): Promise<void> {
    await this.repo.updateFormDefinition(id, data);
  }
}

export class CreateVoucherTypeDefinitionUseCase {
  constructor(private repo: IVoucherTypeDefinitionRepository) {}
  async execute(def: VoucherTypeDefinition): Promise<void> {
    // STEP 3 ENFORCEMENT: Validate before save
    VoucherTypeDefinitionValidator.validate(def);
    await this.repo.createVoucherType(def);
  }
}

export class UpdateVoucherTypeDefinitionUseCase {
  constructor(private repo: IVoucherTypeDefinitionRepository) {}
  async execute(companyId: string, id: string, data: Partial<VoucherTypeDefinition>): Promise<void> {
    await this.repo.updateVoucherType(companyId, id, data);
  }
}

export class ValidateDynamicFieldRulesUseCase {
  // Logic to validate rules structure itself (e.g. infinite loops in visibility)
  async execute(rules: any[]): Promise<boolean> {
    return true; // Placeholder for logic
  }
}

export interface AdoptTemplateInput {
  companyId: string;
  userId: string;
  templateId: string;
  module: string;
}

export class AdoptTemplateUseCase {
  constructor(
    private voucherTypeRepo: IVoucherTypeDefinitionRepository,
    private voucherFormRepo: any
  ) {}

  async execute(input: AdoptTemplateInput): Promise<{ formId: string; voucherTypeId: string }> {
    const { companyId, userId, templateId, module } = input;

    // 1. Get system template
    const systemTemplates = await this.voucherTypeRepo.getSystemTemplates();
    const template = systemTemplates.find(t => t.id === templateId || t.code === templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    // 2. Check if company already has this voucher type
    const existingType = await this.voucherTypeRepo.getByCode(companyId, template.code);
    let voucherTypeId: string;

    if (existingType) {
      voucherTypeId = existingType.id;
    } else {
      // 3. Clone voucher type to company
      const { randomUUID } = await import('crypto');
      const newType = new VoucherTypeDefinition(
        randomUUID(),
        companyId,
        template.name,
        template.code,
        module,
        template.headerFields,
        template.tableColumns,
        template.layout,
        template.schemaVersion || 2,
        template.requiredPostingRoles,
        template.workflow,
        template.uiModeOverrides,
        template.isMultiLine ?? true,
        template.rules,
        template.actions,
        template.defaultCurrency,
        template.voucherType,
        template.persona
      );
      await this.voucherTypeRepo.createVoucherType(newType);
      voucherTypeId = newType.id;
    }

    // 4. Return the formId (same as voucherTypeId for default forms)
    return { formId: voucherTypeId, voucherTypeId };
  }
}
