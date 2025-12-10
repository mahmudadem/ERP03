
import { IBundleRegistryRepository } from '../../../repository/interfaces/super-admin/IBundleRegistryRepository';
import { BundleDefinition } from '../../../domain/super-admin/BundleDefinition';

interface CreateBundleInput {
  id: string;
  name: string;
  description: string;
  businessDomains: string[];
  modulesIncluded: string[];
}

export class CreateBundleUseCase {
  constructor(private bundleRepo: IBundleRegistryRepository) {}

  async execute(input: CreateBundleInput): Promise<void> {
    // Validate businessDomains is an array
    if (!Array.isArray(input.businessDomains)) {
      throw new Error('businessDomains must be an array');
    }

    // Validate modulesIncluded is an array
    if (!Array.isArray(input.modulesIncluded)) {
      throw new Error('modulesIncluded must be an array');
    }

    const bundle: BundleDefinition = {
      ...input,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.bundleRepo.create(bundle);
  }
}
