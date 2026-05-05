/**
 * IAiSettingsRepository - Repository Interface
 *
 * DB-agnostic interface for AI provider configuration persistence.
 * Implementations: FirestoreAiSettingsRepository, PrismaAiSettingsRepository
 */

import { AiProviderConfig } from '../../../domain/ai-assistant/entities/AiProviderConfig';

export interface IAiSettingsRepository {
  /**
   * Get the AI provider config for a company.
   * Returns null if no config exists (defaults to mock provider).
   */
  getConfig(companyId: string): Promise<AiProviderConfig | null>;

  /**
   * Save or update the AI provider config for a company.
   */
  saveConfig(config: AiProviderConfig): Promise<void>;
}