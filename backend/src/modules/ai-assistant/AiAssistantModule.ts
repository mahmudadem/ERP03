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

import { Router } from 'express';
import { IModule, ModuleMetadata } from '../../domain/platform/IModule';
import { ModuleManifest } from '../../domain/platform/ModuleManifest';
import aiAssistantRoutes from '../../api/routes/ai-assistant.routes';

export class AiAssistantModule implements IModule {
    metadata: ModuleMetadata = {
        id: 'ai-assistant',
        name: 'AI Assistant',
        version: '1.0.0',
        description: 'Optional AI assistant module providing advisory chat, explanations, and suggestions. The assistant cannot create, modify, or delete business records.',
        requiredBundles: ['professional', 'enterprise'],
        dependencies: [] // No hard dependencies — works standalone
    };

    permissions: string[] = [
        'ai-assistant.chat.use',
        'ai-assistant.chat.view',
        'ai-assistant.settings.view',
        'ai-assistant.settings.manage',
        'ai-assistant.settings.health',
        'ai-assistant.tools.accounting.trial-balance',
    ];

    getManifest(): ModuleManifest {
        return {
            id: this.metadata.id,
            name: this.metadata.name,
            version: this.metadata.version,
            description: this.metadata.description,
            requiredPermissions: this.permissions,
        };
    }

    async initialize(): Promise<void> {
        console.log('Initializing AI Assistant Module...');
    }

    getRouter(): Router {
        return aiAssistantRoutes;
    }

    async shutdown(): Promise<void> {
        console.log('Shutting down AI Assistant Module...');
    }
}