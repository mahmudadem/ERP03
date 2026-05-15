/**
 * AiAutoSeedCertification — Automatically certifies well-known model profiles
 *
 * On first run (or when called), this service creates CERTIFIED results for
 * well-known AI models that have established tool calling support, so tenants
 * who select these models get tool access without manual certification.
 *
 * Only seeds if no CERTIFIED result already exists for that model+category.
 * Running multiple times is idempotent — no duplicates.
 */

import { AiCertificationCategory } from '../../../domain/ai-assistant/entities/AiCertificationCategory';
import { AiModelCertificationResult, AiModelCertificationStatus } from '../../../domain/ai-assistant/entities/AiModelCertificationResult';
import { AiModelProfile } from '../../../domain/ai-assistant/entities/AiModelProfile';
import { IAiModelCertificationRepository } from '../../../repository/interfaces/ai-assistant/IAiModelCertificationRepository';
import { IAiModelProfileRepository } from '../../../repository/interfaces/ai-assistant/IAiModelProfileRepository';
import { AI_TOOL_CONTRACT_VERSION, AI_DATA_FILTER_POLICY_VERSION } from './AiModelRoutingGuard';

/**
 * Models that should be auto-certified.
 * Each entry defines the provider and modelId that, if a matching profile exists,
 * will receive automatic certification for GENERAL_CHAT and TOOL_CALLING.
 *
 * Only profiles that exist in the database are certified — we never create
 * profiles here, only certify existing ones.
 */
const AUTO_CERTIFY_MODELS = [
  { provider: 'openai_compatible', modelId: 'gpt-4o' },
  { provider: 'openai_compatible', modelId: 'gpt-4o-mini' },
  { provider: 'openai_compatible', modelId: 'gpt-4-turbo' },
  { provider: 'openai_compatible', modelId: 'claude-3-5-sonnet' },
  { provider: 'openai_compatible', modelId: 'claude-3-5-haiku' },
  { provider: 'openai_compatible', modelId: 'gemini-1.5-pro' },
  { provider: 'openai_compatible', modelId: 'gemini-1.5-flash' },
];

/**
 * Categories to auto-certify for each well-known model.
 * GENERAL_CHAT and TOOL_CALLING are the minimum for AI Assistant to function
 * with the selected model.
 */
const AUTO_CERTIFY_CATEGORIES: AiCertificationCategory[] = [
  'GENERAL_CHAT',
  'TOOL_CALLING',
];

export class AiAutoSeedCertification {
  constructor(
    private readonly profileRepository: IAiModelProfileRepository,
    private readonly certificationRepository: IAiModelCertificationRepository,
  ) {}

  /**
   * Seed auto-certifications for well-known models.
   * Only creates certifications for profiles that exist in the database.
   * Idempotent — skips if a CERTIFIED result already exists.
   *
   * @returns Number of new certifications created.
   */
  async seed(): Promise<number> {
    let createdCount = 0;

    // Load all model profiles
    const allProfiles = await this.profileRepository.list();

    for (const autoModel of AUTO_CERTIFY_MODELS) {
      // Find matching GLOBAL profile that is enabled
      const matchingProfile = allProfiles.find(
        (p: AiModelProfile) =>
          p.providerId === autoModel.provider &&
          p.modelId === autoModel.modelId &&
          p.scope === 'GLOBAL' &&
          p.enabled !== false,
      );

      if (!matchingProfile) {
        // No matching profile in the database — skip
        continue;
      }

      for (const category of AUTO_CERTIFY_CATEGORIES) {
        // Check if a CERTIFIED result already exists for this profile+category
        const existingCertId = AiModelCertificationResult.makeId({
          scope: 'GLOBAL',
          modelProfileId: matchingProfile.id,
          profileHash: matchingProfile.profileHash,
          category,
          moduleId: undefined,
          skillId: undefined,
        });

        const existing = await this.certificationRepository.getById(existingCertId);
        if (existing && existing.status === 'CERTIFIED') {
          // Already certified — skip (idempotent)
          continue;
        }

        // Create auto-certification
        const result = new AiModelCertificationResult(
          existingCertId,
          'GLOBAL',
          undefined, // no tenantId for GLOBAL
          autoModel.provider,
          matchingProfile.id,
          matchingProfile.profileHash,
          category,
          100,          // score
          100,          // maxScore
          'CERTIFIED' as AiModelCertificationStatus,
          'auto-seed-v2',
          AI_TOOL_CONTRACT_VERSION,
          AI_DATA_FILTER_POLICY_VERSION,
          new Date(),
          'system',     // testedBy
          `Auto-certified: ${autoModel.provider}/${autoModel.modelId} has established ${category === 'TOOL_CALLING' ? 'tool calling' : 'general chat'} support.`,
          undefined,    // moduleId
          undefined,    // skillId
          undefined,    // approvedBy
          undefined,    // failureReasons
          undefined,    // metadata
        );

        await this.certificationRepository.save(result);
        createdCount++;
      }
    }

    return createdCount;
  }
}