"use strict";
/**
 * AiAssistantModule.ts
 *
 * AI Assistant module implementation that registers with the platform.
 * This module provides an optional AI chat/assistant experience for
 * companies that have it installed and enabled.
 *
 * Design principles:
 * - Advisory-only: AI responses cannot create, update, delete, approve, post, or modify business records.
 * - Provider-agnostic: Supports mock, OpenAI-compatible, Ollama, and future providers.
 * - BYOK-ready: Designed to support Bring Your Own Key per company (not yet implemented).
 * - Installable: Follows the same module registry pattern as Accounting, Inventory, etc.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiAssistantModule = void 0;
const ai_assistant_routes_1 = __importDefault(require("../../api/routes/ai-assistant.routes"));
class AiAssistantModule {
    constructor() {
        this.metadata = {
            id: 'ai-assistant',
            name: 'AI Assistant',
            version: '1.0.0',
            description: 'Optional AI assistant module providing advisory chat, explanations, and suggestions. The assistant cannot create, modify, or delete business records.',
            requiredBundles: ['professional', 'enterprise'],
            dependencies: [] // No hard dependencies — works standalone
        };
        this.permissions = [
            'ai-assistant.chat.use',
            'ai-assistant.chat.view',
            'ai-assistant.settings.view',
            'ai-assistant.settings.manage',
            'ai-assistant.settings.health',
            'ai-assistant.tools.accounting.trial-balance',
            'ai-assistant.tools.view',
            'ai-assistant.tools.manage',
            'ai-assistant.usage.view',
            'ai-assistant.health.test',
            'ai-assistant.model-policy.view',
            'ai-assistant.model-policy.manage',
            // Proposal Sandbox permissions
            'ai-assistant.proposals.view',
            'ai-assistant.proposals.create',
            'ai-assistant.proposals.review',
            'ai-assistant.proposals.manage',
            'ai-assistant.proposals.archive',
        ];
    }
    getManifest() {
        return {
            id: this.metadata.id,
            name: this.metadata.name,
            version: this.metadata.version,
            description: this.metadata.description,
            requiredPermissions: this.permissions,
        };
    }
    async initialize() {
        console.log('Initializing AI Assistant Module...');
    }
    getRouter() {
        return ai_assistant_routes_1.default;
    }
    async shutdown() {
        console.log('Shutting down AI Assistant Module...');
    }
}
exports.AiAssistantModule = AiAssistantModule;
//# sourceMappingURL=AiAssistantModule.js.map