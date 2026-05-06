/**
 * IAiToolCatalogRepository - Repository interface for AI Tool Definitions
 *
 * Stores tool definitions and enablement policies.
 * Tool definitions are platform-level (Super Admin manages them).
 * Enablement policies are also platform-level but can reference companies.
 *
 * Firestore paths:
 *   system_metadata/ai_tools/{toolId}
 */
import { AiToolDefinition } from '../../../domain/ai-assistant/entities/AiToolDefinition';

export interface IAiToolCatalogRepository {
  /** Get a tool definition by ID */
  getById(toolId: string): Promise<AiToolDefinition | null>;

  /** Get all tool definitions */
  list(): Promise<AiToolDefinition[]>;

  /** Get tools by module */
  listByModule(moduleId: string): Promise<AiToolDefinition[]>;

  /** Get tools by category */
  listByCategory(category: string): Promise<AiToolDefinition[]>;

  /** Get tools by status */
  listByStatus(status: string): Promise<AiToolDefinition[]>;

  /** Save/update a tool definition */
  save(definition: AiToolDefinition): Promise<void>;

  /** Delete a tool definition */
  delete(toolId: string): Promise<void>;
}