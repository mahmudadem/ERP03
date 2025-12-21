import { ISystemMetadataRepository } from '../../../infrastructure/repositories/FirestoreSystemMetadataRepository';

export class GetSystemMetadataUseCase {
  constructor(private readonly systemMetadataRepository: ISystemMetadataRepository) {}

  async execute(key: string): Promise<any> {
    const metadata = await this.systemMetadataRepository.getMetadata(key);
    
    if (!metadata) {
      throw new Error(`System metadata not found: ${key}`);
    }

    return metadata;
  }
}
