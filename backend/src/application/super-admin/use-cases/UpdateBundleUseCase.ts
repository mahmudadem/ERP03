
import { IBundleRegistryRepository } from '../../../repository/interfaces/super-admin/IBundleRegistryRepository';
import { BundleLifecycleStatus } from '../../../domain/super-admin/BundleDefinition';

interface UpdateBundleInput {
  id: string;
  name?: string;
  description?: string;
  businessDomains?: string[];
  modulesIncluded?: string[];
  capabilities?: string[];
  lifecycleStatus?: BundleLifecycleStatus;
}

export class UpdateBundleUseCase {
  constructor(private bundleRepo: IBundleRegistryRepository) {}

  async execute(input: UpdateBundleInput): Promise<void> {
    const { id, ...updates } = input;

    // Validate arrays if provided
    if (updates.businessDomains !== undefined && !Array.isArray(updates.businessDomains)) {
      throw new Error('businessDomains must be an array');
    }

    if (updates.modulesIncluded !== undefined && !Array.isArray(updates.modulesIncluded)) {
      throw new Error('modulesIncluded must be an array');
    }

    if (updates.capabilities !== undefined && !Array.isArray(updates.capabilities)) {
      throw new Error('capabilities must be an array');
    }
    
    await this.bundleRepo.update(id, {
      ...updates,
      updatedAt: new Date(),
    });
  }
}
