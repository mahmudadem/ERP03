
import { IBundleRegistryRepository } from '../../../repository/interfaces/super-admin/IBundleRegistryRepository';
import { BundleDefinition } from '../../../domain/super-admin/BundleDefinition';

export class ListBundlesUseCase {
  constructor(private bundleRepo: IBundleRegistryRepository) {}

  async execute(): Promise<BundleDefinition[]> {
    return await this.bundleRepo.getAll();
  }
}
