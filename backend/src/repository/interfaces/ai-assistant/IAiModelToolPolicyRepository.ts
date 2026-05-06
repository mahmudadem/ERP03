/**
 * IAiModelToolPolicyRepository - Repository for AI Model Tool Policies
 *
 * Stores per-provider/model tool policies that control which tools
 * a specific AI model can invoke.
 *
 * Firestore paths:
 *   system_metadata/ai_model_tool_policies/{policyId}
 */
import { AiModelToolPolicy } from '../../../domain/ai-assistant/entities/AiModelToolPolicy';

export interface IAiModelToolPolicyRepository {
  /** Get a model tool policy by ID */
  getById(policyId: string): Promise<AiModelToolPolicy | null>;

  /** Get all model tool policies */
  list(): Promise<AiModelToolPolicy[]>;

  /** Get policies for a specific provider */
  listByProvider(providerType: string): Promise<AiModelToolPolicy[]>;

  /** Get policies for a specific model */
  listByModel(model: string): Promise<AiModelToolPolicy[]>;

  /** Save/update a model tool policy */
  save(policy: AiModelToolPolicy): Promise<void>;

  /** Delete a model tool policy */
  delete(policyId: string): Promise<void>;
}