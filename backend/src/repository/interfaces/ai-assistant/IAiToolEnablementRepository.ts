/**
 * IAiToolEnablementRepository - Repository for AI Tool Enablement Policies
 *
 * Stores enablement policies that control which tools are available in which contexts.
 * Super Admin manages these globally.
 *
 * Firestore paths:
 *   system_metadata/ai_tool_policies/{policyId}  (policyId = toolId)
 */
import { AiToolEnablementPolicy } from '../../../domain/ai-assistant/entities/AiToolEnablementPolicy';

export interface IAiToolEnablementRepository {
  /** Get enablement policy for a specific tool */
  getByToolId(toolId: string): Promise<AiToolEnablementPolicy | null>;

  /** Get all enablement policies */
  list(): Promise<AiToolEnablementPolicy[]>;

  /** Get policies for a set of tool IDs */
  listByToolIds(toolIds: string[]): Promise<AiToolEnablementPolicy[]>;

  /** Save/update an enablement policy */
  save(policy: AiToolEnablementPolicy): Promise<void>;

  /** Delete an enablement policy */
  delete(toolId: string): Promise<void>;
}