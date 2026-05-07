"use strict";
/**
 * ai-assistant.validators - Input validation for AI Assistant endpoints
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateUpdateAiSettingsInput = exports.validateSendChatMessageInput = void 0;
const ApiError_1 = require("../errors/ApiError");
/**
 * Validate the send chat message request.
 */
function validateSendChatMessageInput(body) {
    if (!body) {
        throw ApiError_1.ApiError.badRequest('Request body is required');
    }
    if (!body.message || typeof body.message !== 'string') {
        throw ApiError_1.ApiError.badRequest('message is required and must be a string');
    }
    if (body.message.trim().length === 0) {
        throw ApiError_1.ApiError.badRequest('message must not be empty');
    }
    if (body.message.length > 10000) {
        throw ApiError_1.ApiError.badRequest('message must not exceed 10,000 characters');
    }
    if (body.conversationId !== undefined && typeof body.conversationId !== 'string') {
        throw ApiError_1.ApiError.badRequest('conversationId must be a string if provided');
    }
    if (body.conversationId && body.conversationId.length > 100) {
        throw ApiError_1.ApiError.badRequest('conversationId must not exceed 100 characters');
    }
}
exports.validateSendChatMessageInput = validateSendChatMessageInput;
/**
 * Validate the update settings request.
 */
function validateUpdateAiSettingsInput(body) {
    if (!body) {
        throw ApiError_1.ApiError.badRequest('Request body is required');
    }
    const validProviders = ['mock', 'openai_compatible', 'ollama'];
    if (body.provider !== undefined) {
        if (!validProviders.includes(body.provider)) {
            throw ApiError_1.ApiError.badRequest(`provider must be one of: ${validProviders.join(', ')}`);
        }
    }
    if (body.model !== undefined && typeof body.model !== 'string') {
        throw ApiError_1.ApiError.badRequest('model must be a string');
    }
    if (body.apiKey !== undefined && typeof body.apiKey !== 'string') {
        throw ApiError_1.ApiError.badRequest('apiKey must be a string');
    }
    if (body.apiEndpoint !== undefined && typeof body.apiEndpoint !== 'string') {
        throw ApiError_1.ApiError.badRequest('apiEndpoint must be a string');
    }
    if (body.maxTokensPerRequest !== undefined) {
        if (typeof body.maxTokensPerRequest !== 'number' || body.maxTokensPerRequest < 1) {
            throw ApiError_1.ApiError.badRequest('maxTokensPerRequest must be a positive number');
        }
    }
    if (body.maxRequestsPerDay !== undefined) {
        if (typeof body.maxRequestsPerDay !== 'number' || body.maxRequestsPerDay < 1) {
            throw ApiError_1.ApiError.badRequest('maxRequestsPerDay must be a positive number');
        }
    }
    if (body.isEnabled !== undefined && typeof body.isEnabled !== 'boolean') {
        throw ApiError_1.ApiError.badRequest('isEnabled must be a boolean');
    }
}
exports.validateUpdateAiSettingsInput = validateUpdateAiSettingsInput;
//# sourceMappingURL=ai-assistant.validators.js.map