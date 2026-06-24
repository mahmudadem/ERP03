import { PolicyConfig } from '../../../domain/system-core/entities/PolicyConfig';

/**
 * IPolicyConfigRepository — neutral store for the company-wide `PolicyConfig`
 * document.
 *
 * Task 267-C: one `PolicyConfig` per company, used by `IPolicyEngine.resolveTyped`
 * for typed policy resolution. This is the single source of truth that every
 * module's policy-management doorway writes to. The interface deliberately
 * mirrors the existing `ISellingPolicyRepository` and `IPosPolicyRepository`
 * shape so a Firestore implementation can land in a follow-up slice.
 */
export interface IPolicyConfigRepository {
  getConfig(companyId: string): Promise<PolicyConfig | null>;
  saveConfig(config: PolicyConfig, transaction?: unknown): Promise<void>;
}
