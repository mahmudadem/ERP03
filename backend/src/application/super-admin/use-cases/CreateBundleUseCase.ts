
import { IBundleRegistryRepository } from '../../../repository/interfaces/super-admin/IBundleRegistryRepository';
import { BundleLifecycleStatus } from '../../../domain/super-admin/BundleDefinition';

interface CreateBundleInput {
  id: string;
  name: string;
  description: string;
  businessDomains: string[];
  modulesIncluded: string[];
  capabilities?: string[];
  lifecycleStatus?: BundleLifecycleStatus;
}

export class CreateBundleUseCase {
  constructor(private bundleRepo: IBundleRegistryRepository) {}

  async execute(input: CreateBundleInput): Promise<void> {
    if (!Array.isArray(input.businessDomains)) {
      throw new Error('businessDomains must be an array');
    }

    if (!Array.isArray(input.modulesIncluded)) {
      throw new Error('modulesIncluded must be an array');
    }

    if (input.capabilities !== undefined && !Array.isArray(input.capabilities)) {
      throw new Error('capabilities must be an array');
    }

    const bundle: any = {
      id: input.id,
      code: input.id,
      name: input.name,
      description: input.description,
      businessDomains: input.businessDomains,
      modulesIncluded: input.modulesIncluded,
      capabilities: input.capabilities || [],
      lifecycleStatus: input.lifecycleStatus || 'draft',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.bundleRepo.create(bundle);
  }
}
