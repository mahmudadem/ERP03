"use strict";
/**
 * AiChatMessage - Domain Entity
 *
 * Represents a single message in an AI Assistant conversation.
 * Chat messages are advisory-only — they must NEVER create, update,
 * delete, approve, post, or modify business records.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiChatMessage = void 0;
class AiChatMessage {
    constructor(id, companyId, userId, conversationId, role, content, provider, model, tokenCount, metadata, createdAt = new Date()) {
        this.id = id;
        this.companyId = companyId;
        this.userId = userId;
        this.conversationId = conversationId;
        this.role = role;
        this.content = content;
        this.provider = provider;
        this.model = model;
        this.tokenCount = tokenCount;
        this.metadata = metadata;
        this.createdAt = createdAt;
    }
    static create(input) {
        const id = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        return new AiChatMessage(id, input.companyId, input.userId, input.conversationId, input.role, input.content, input.provider, input.model, undefined, input.metadata, new Date());
    }
    toJSON() {
        return {
            id: this.id,
            companyId: this.companyId,
            userId: this.userId,
            conversationId: this.conversationId,
            role: this.role,
            content: this.content,
            provider: this.provider,
            model: this.model || null,
            tokenCount: this.tokenCount || null,
            metadata: this.metadata || null,
            createdAt: this.createdAt.toISOString(),
        };
    }
    static fromJSON(data) {
        var _a, _b;
        return new AiChatMessage(data.id, data.companyId, data.userId, data.conversationId, data.role, data.content, data.provider, data.model || undefined, data.tokenCount || undefined, data.metadata || undefined, ((_b = (_a = data.createdAt) === null || _a === void 0 ? void 0 : _a.toDate) === null || _b === void 0 ? void 0 : _b.call(_a)) || new Date(data.createdAt));
    }
}
exports.AiChatMessage = AiChatMessage;
//# sourceMappingURL=AiChatMessage.js.map