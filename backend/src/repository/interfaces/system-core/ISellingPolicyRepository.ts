import { SellingPolicy } from '../../../domain/system-core/entities/SellingPolicy';

export interface ISellingPolicyRepository {
  getPolicy(companyId: string): Promise<SellingPolicy | null>;
  savePolicy(policy: SellingPolicy, tx?: unknown): Promise<void>;
}
