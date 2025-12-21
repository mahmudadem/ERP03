
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
