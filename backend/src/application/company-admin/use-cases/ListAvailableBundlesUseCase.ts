import { BUNDLES } from '../../../domain/platform/Bundle';

export class ListAvailableBundlesUseCase {
    async execute(): Promise<any[]> {
        // Return all bundles from registry
        return BUNDLES.map(bundle => ({
            bundleId: bundle.id,
            ...bundle
        }));
    }
}
