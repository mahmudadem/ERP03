import { Features } from '../../../domain/platform/FeatureRegistry';

export class ListCompanyFeaturesUseCase {
    async execute(): Promise<any[]> {
        // Return full feature list from registry
        return Object.entries(Features).map(([id, config]) => ({
            featureId: id,
            ...config
        }));
    }
}
