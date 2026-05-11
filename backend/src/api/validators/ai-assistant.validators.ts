/**
 * ai-assistant.validators - Input validation for AI Assistant endpoints
 */

import { ApiError } from '../errors/ApiError';

/**
 * Validate the send chat message request.
 */
export function validateSendChatMessageInput(body: any): void {
  if (!body) {
    throw ApiError.badRequest('Request body is required');
  }

  if (!body.message || typeof body.message !== 'string') {
    throw ApiError.badRequest('message is required and must be a string');
  }

  if (body.message.trim().length === 0) {
    throw ApiError.badRequest('message must not be empty');
  }

  if (body.message.length > 10000) {
    throw ApiError.badRequest('message must not exceed 10,000 characters');
  }

  if (body.conversationId !== undefined && typeof body.conversationId !== 'string') {
    throw ApiError.badRequest('conversationId must be a string if provided');
  }

  if (body.conversationId && body.conversationId.length > 100) {
    throw ApiError.badRequest('conversationId must not exceed 100 characters');
  }
}

/**
 * Validate the update settings request.
 */
export function validateUpdateAiSettingsInput(body: any): void {
  if (!body) {
    throw ApiError.badRequest('Request body is required');
  }

  const validProviders = ['mock', 'openai_compatible', 'ollama'];
  if (body.provider !== undefined) {
    if (!validProviders.includes(body.provider)) {
      throw ApiError.badRequest(`provider must be one of: ${validProviders.join(', ')}`);
    }
  }

  if (body.model !== undefined && typeof body.model !== 'string') {
    throw ApiError.badRequest('model must be a string');
  }

  if (body.apiKey !== undefined && typeof body.apiKey !== 'string') {
    throw ApiError.badRequest('apiKey must be a string');
  }

  if (body.apiEndpoint !== undefined && typeof body.apiEndpoint !== 'string') {
    throw ApiError.badRequest('apiEndpoint must be a string');
  }

  if (body.maxTokensPerRequest !== undefined) {
    if (typeof body.maxTokensPerRequest !== 'number' || body.maxTokensPerRequest < 1) {
      throw ApiError.badRequest('maxTokensPerRequest must be a positive number');
    }
  }

  if (body.maxRequestsPerDay !== undefined) {
    if (typeof body.maxRequestsPerDay !== 'number' || body.maxRequestsPerDay < 1) {
      throw ApiError.badRequest('maxRequestsPerDay must be a positive number');
    }
  }

  if (body.conversationContextMode !== undefined) {
    const validContextModes = ['minimal', 'balanced', 'deep'];
    if (!validContextModes.includes(body.conversationContextMode)) {
      throw ApiError.badRequest(`conversationContextMode must be one of: ${validContextModes.join(', ')}`);
    }
  }

  if (body.includePreviousToolResults !== undefined && typeof body.includePreviousToolResults !== 'boolean') {
    throw ApiError.badRequest('includePreviousToolResults must be a boolean');
  }

  if (body.isEnabled !== undefined && typeof body.isEnabled !== 'boolean') {
    throw ApiError.badRequest('isEnabled must be a boolean');
  }

  if (body.mode !== undefined) {
    const validModes = ['certified_profile', 'custom_uncertified', 'legacy_unverified'];
    if (!validModes.includes(body.mode)) {
      throw ApiError.badRequest(`mode must be one of: ${validModes.join(', ')}`);
    }
  }

  if (body.providerId !== undefined && typeof body.providerId !== 'string') {
    throw ApiError.badRequest('providerId must be a string');
  }

  if (body.selectedModelProfileId !== undefined && typeof body.selectedModelProfileId !== 'string') {
    throw ApiError.badRequest('selectedModelProfileId must be a string');
  }

  if (body.runtimeMode !== undefined) {
    const validRuntimeModes = ['BYOK', 'PLATFORM_MANAGED', 'DISABLED'];
    if (!validRuntimeModes.includes(body.runtimeMode)) {
      throw ApiError.badRequest(`runtimeMode must be one of: ${validRuntimeModes.join(', ')}`);
    }
  }

  if (body.allowedRuntimeModes !== undefined) {
    if (!Array.isArray(body.allowedRuntimeModes)) {
      throw ApiError.badRequest('allowedRuntimeModes must be an array');
    }
    const validRuntimeModes = ['BYOK', 'PLATFORM_MANAGED', 'DISABLED'];
    for (const mode of body.allowedRuntimeModes) {
      if (!validRuntimeModes.includes(mode)) {
        throw ApiError.badRequest(`allowedRuntimeModes must contain only: ${validRuntimeModes.join(', ')}`);
      }
    }
  }
}
