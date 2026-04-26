import { IBundleRegistryRepository } from '../../../repository/interfaces/super-admin/IBundleRegistryRepository';

export class ListAvailableBundlesUseCase {
    constructor(private bundleRepo: IBundleRegistryRepository) {}

    async execute(): Promise<any[]> {
        const bundles = await this.bundleRepo.getReady();
        return bundles.map(bundle => ({
            bundleId: bundle.id,
            ...bundle
        }));
    }
}
