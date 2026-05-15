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
 * 
 * Includes logic to detect and clean up i18n keys if they accidentally
 * reach the backend as message content.
 */
export function generateTitle(message: string): string {
  // If the message looks like an i18n key (e.g., chat.quickActions.financialOverviewPrompt)
  // try to extract a readable label from the last part.
  if (message.includes('.') && !message.includes(' ') && message.length < 100) {
    const parts = message.split('.');
    const lastPart = parts[parts.length - 1];
    // Convert camelCase or snake_case to Space Case
    const cleaned = lastPart
      .replace(/([A-Z])/g, ' $1') // insert space before capital letters
      .replace(/[_-]/g, ' ')      // replace underscores/hyphens with spaces
      .replace(/Prompt$/i, '')    // remove "Prompt" suffix
      .trim();
    
    if (cleaned.length > 2) {
      return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }
  }

  const MAX_LENGTH = 50;
  const cleanMessage = message.trim();

  if (cleanMessage.length <= MAX_LENGTH) {
    return cleanMessage;
  }

  const truncated = cleanMessage.substring(0, MAX_LENGTH);
  const lastSpaceIndex = truncated.lastIndexOf(' ');
  
  if (lastSpaceIndex > 10) { // Only trim to word if we have a reasonable length
    return truncated.substring(0, lastSpaceIndex).trim() + '...';
  }
  
  return truncated.trim() + '...';
}

/**
 * Resolve the model capability profile for a given provider/model combination.
 * Falls back to the default catalog if no profile use case is available.
 */
export async function resolveModelProfile(
  modelProfileUseCase: AiModelProfileUseCase | undefined,
  tenantId: string,
  provider: string,
  modelName: string | null | undefined,
): Promise<AiModelProfile> {
  if (modelProfileUseCase) {
    return modelProfileUseCase.resolveRuntimeProfile(tenantId, provider, modelName);
  }
  return AiModelCapabilityCatalog.getProfile(provider, modelName);
}