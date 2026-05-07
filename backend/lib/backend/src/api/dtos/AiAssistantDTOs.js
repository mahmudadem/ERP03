"use strict";
/**
 * AiAssistantDTOs - Request/Response types for AI Assistant endpoints
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiAssistantDTOMapper = void 0;
class AiAssistantDTOMapper {
    static toChatMessageResponse(message) {
        var _a, _b;
        return {
            id: message.id,
            conversationId: message.conversationId,
            role: message.role,
            content: message.content,
            provider: message.provider,
            model: message.model || null,
            tokenCount: message.tokenCount || null,
            metadata: message.metadata || null,
            createdAt: ((_b = (_a = message.createdAt) === null || _a === void 0 ? void 0 : _a.toISOString) === null || _b === void 0 ? void 0 : _b.call(_a)) || message.createdAt,
        };
    }
}
exports.AiAssistantDTOMapper = AiAssistantDTOMapper;
//# sourceMappingURL=AiAssistantDTOs.js.map