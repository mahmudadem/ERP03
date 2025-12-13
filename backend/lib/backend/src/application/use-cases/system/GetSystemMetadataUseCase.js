"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetSystemMetadataUseCase = void 0;
class GetSystemMetadataUseCase {
    constructor(systemMetadataRepository) {
        this.systemMetadataRepository = systemMetadataRepository;
    }
    async execute(key) {
        const metadata = await this.systemMetadataRepository.getMetadata(key);
        if (!metadata) {
            throw new Error(`System metadata not found: ${key}`);
        }
        return metadata.data || metadata;
    }
}
exports.GetSystemMetadataUseCase = GetSystemMetadataUseCase;
//# sourceMappingURL=GetSystemMetadataUseCase.js.map