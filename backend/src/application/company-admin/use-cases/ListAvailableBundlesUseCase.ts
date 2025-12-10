import { IBundleRegistryRepository } from '../../../repository/interfaces/super-admin/IBundleRegistryRepository';

export class ListAvailableBundlesUseCase {
    constructor(private bundleRepo: IBundleRegistryRepository) {}

    async execute(): Promise<any[]> {
        // Return all bundles from Firestore
        const bundles = await this.bundleRepo.getAll();
        return bundles.map(bundle => ({
            bundleId: bundle.id,
            ...bundle
        }));
    }
}
