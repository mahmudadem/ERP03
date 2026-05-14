/**
 * chatMessageHelpers - Shared stateless helpers for chat message use cases.
 *
 * Extracted from SendChatMessageUseCase so both sync and streaming use cases
 * can reuse the same logic without duplication.
 *
 * DESIGN PRINCIPLES:
 * - All functions are pure or depend only on injected repository interfaces
 * - No Firestore-specific code
 * - No stateful services — these are utility functions
 */

import { IAiConversationMetaRepository } from '../../../repository/interfaces/ai-assistant/IAiConversationMetaRepository';
import { AiModelProfile, AiModelCapabilityCatalog } from './AiModelCapabilityCatalog';
import { AiModelProfileUseCase } from '../use-cases/AiModelProfileUseCase';

/**
 * Update or create conversation metadata.
 * On first user message, auto-generates a title from the message content.
 * On subsequent messages, increments the message count and updates lastMessageAt.
 */
export async function upsertConversationMeta(
  conversationMetaRepository: IAiConversationMetaRepository | undefined,
  input: {
    companyId: string;
    userId: string;
    conversationId: string;
    message: string;
  },
): Promise<void> {
  if (!conversationMetaRepository) return;

  try {
    const existing = await conversationMetaRepository.get(
      input.conversationId,
      input.companyId,
    );

    if (existing) {
      // Increment message count and update timestamp
      existing.messageCount += 2; // user + assistant
      existing.lastMessageAt = new Date();
      await conversationMetaRepository.save(existing);
    } else {
      // First message — generate a title
      const title = generateTitle(input.message);
      await conversationMetaRepository.save({
        id: input.conversationId,
        companyId: input.companyId,
        userId: input.userId,
        title,
        messageCount: 2, // user + assistant
        lastMessageAt: new Date(),
        createdAt: new Date(),
      });
    }
  } catch (error) {
    // Title generation is non-critical — log and continue
    console.warn(`[AI Assistant] Failed to update conversation meta: ${(error as Error).message}`);
  }
}

/**
 * Generate a conversation title from the first user message.
 * Takes the first 50 characters, then trims to the last full word
 * to avoid cutting mid-word.
 */
export function generateTitle(message: string): string {
  const MAX_LENGTH = 50;
  if (message.length <= MAX_LENGTH) {
    return message.trim();
  }
  const truncated = message.substring(0, MAX_LENGTH);
  const lastSpaceIndex = truncated.lastIndexOf(' ');
  if (lastSpaceIndex > 0) {
    return truncated.substring(0, lastSpaceIndex).trim();
  }
  return truncated.trim();
}

/**
 * Resolve the model capability profile for a given provider/model combination.
 * Falls back to the default catalog if no profile use case is available.
 */
export async function resolveModelProfile(
  modelProfileUseCase: AiModelProfileUseCase | undefined,
  provider: string,
  modelName: string | null | undefined,
): Promise<AiModelProfile> {
  if (modelProfileUseCase) {
    return modelProfileUseCase.resolveRuntimeProfile(provider, modelName);
  }
  return AiModelCapabilityCatalog.getProfile(provider, modelName);
}