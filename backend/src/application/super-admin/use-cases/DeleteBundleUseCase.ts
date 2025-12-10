
import { IBundleRegistryRepository } from '../../../repository/interfaces/super-admin/IBundleRegistryRepository';

export class DeleteBundleUseCase {
  constructor(private bundleRepo: IBundleRegistryRepository) {}

  async execute(id: string): Promise<void> {
    await this.bundleRepo.delete(id);
  }
}
