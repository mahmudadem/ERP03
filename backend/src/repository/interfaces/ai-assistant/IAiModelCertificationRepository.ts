import { AiCertificationCategory } from '../../../domain/ai-assistant/entities/AiCertificationCategory';
import { AiModelCertificationResult } from '../../../domain/ai-assistant/entities/AiModelCertificationResult';

export interface CertificationLookupInput {
  tenantId: string;
  modelProfileId: string;
  profileHash: string;
  category: AiCertificationCategory;
  moduleId?: string;
  skillId?: string;
  toolContractVersion: string;
  dataFilterPolicyVersion: string;
}

export interface IAiModelCertificationRepository {
  getById(id: string): Promise<AiModelCertificationResult | null>;
  list(filters?: {
    scope?: 'GLOBAL' | 'TENANT';
    tenantId?: string;
    category?: AiCertificationCategory;
    moduleId?: string;
  }): Promise<AiModelCertificationResult[]>;
  listByModelProfile(modelProfileId: string): Promise<AiModelCertificationResult[]>;
  findValidForRouting(input: CertificationLookupInput): Promise<AiModelCertificationResult | null>;
  save(result: AiModelCertificationResult): Promise<void>;
  delete(id: string): Promise<void>;
}
