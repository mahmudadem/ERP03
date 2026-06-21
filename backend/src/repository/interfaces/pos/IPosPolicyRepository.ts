import { POSPolicy } from '../../../domain/pos/entities/POSPolicy';

export interface IPosPolicyRepository {
  getPolicy(companyId: string): Promise<POSPolicy | null>;
  savePolicy(policy: POSPolicy, tx?: unknown): Promise<void>;
}