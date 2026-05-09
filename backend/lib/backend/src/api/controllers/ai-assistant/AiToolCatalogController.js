"use strict";
/**
 * AiToolCatalogController - Express request handlers for Super Admin AI Tool Management
 *
 * Thin controller that delegates to AiToolCatalogUseCase.
 * All endpoints require Super Admin authentication.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiToolCatalogController = void 0;
const bindRepositories_1 = require("../../../infrastructure/di/bindRepositories");
const ApiError_1 = require("../../errors/ApiError");
const AiCertificationCategory_1 = require("../../../domain/ai-assistant/entities/AiCertificationCategory");
class AiToolCatalogController {
    static getUserId(req) {
        var _a, _b;
        const userId = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.uid) || ((_b = req.user) === null || _b === void 0 ? void 0 : _b.id);
        if (!userId)
            throw ApiError_1.ApiError.unauthorized('User not authenticated');
        return userId;
    }
    /**
     * GET /platform/ai-tools
     * List all tool definitions with optional filters.
     */
    static async listTools(req, res, next) {
        try {
            const useCase = bindRepositories_1.diContainer.aiToolCatalogUseCase;
            const filters = {
                module: req.query.module,
                category: req.query.category,
                status: req.query.status,
                mode: req.query.mode,
                implemented: req.query.implemented,
            };
            const tools = await useCase.listCatalog(filters);
            res.json({ success: true, data: tools.map(t => t.toJSON()) });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * GET /platform/ai-tools/:toolName
     * Get a single tool definition.
     */
    static async getTool(req, res, next) {
        try {
            const { toolName } = req.params;
            const useCase = bindRepositories_1.diContainer.aiToolCatalogUseCase;
            const tool = await useCase.getCatalogEntry(toolName);
            if (!tool) {
                throw ApiError_1.ApiError.notFound(`Tool '${toolName}' not found`);
            }
            res.json({ success: true, data: tool.toJSON() });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * PATCH /platform/ai-tools/:toolName
     * Update a tool definition (status only — mode, permissions, and riskLevel are immutable).
     */
    static async updateTool(req, res, next) {
        try {
            const { toolName } = req.params;
            const { status } = req.body;
            const userId = AiToolCatalogController.getUserId(req);
            if (!status || !['active', 'disabled', 'deprecated'].includes(status)) {
                throw ApiError_1.ApiError.badRequest('Status must be one of: active, disabled, deprecated');
            }
            const useCase = bindRepositories_1.diContainer.aiToolCatalogUseCase;
            const updated = await useCase.updateToolStatus(toolName, status, userId);
            res.json({ success: true, data: updated.toJSON() });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * PATCH /platform/ai-tools/:toolName/enable
     * Enable a tool globally.
     */
    static async enableTool(req, res, next) {
        try {
            const { toolName } = req.params;
            const userId = AiToolCatalogController.getUserId(req);
            const useCase = bindRepositories_1.diContainer.aiToolCatalogUseCase;
            const updated = await useCase.enableTool(toolName, userId);
            res.json({ success: true, data: updated.toJSON() });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * PATCH /platform/ai-tools/:toolName/disable
     * Disable a tool globally.
     */
    static async disableTool(req, res, next) {
        try {
            const { toolName } = req.params;
            const userId = AiToolCatalogController.getUserId(req);
            const useCase = bindRepositories_1.diContainer.aiToolCatalogUseCase;
            const updated = await useCase.disableTool(toolName, userId);
            res.json({ success: true, data: updated.toJSON() });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * PATCH /platform/ai-tools/:toolName/keywords
     * Update a tool's chat keywords.
     */
    static async updateChatKeywords(req, res, next) {
        var _a;
        try {
            const { toolName } = req.params;
            const userId = AiToolCatalogController.getUserId(req);
            const keywords = (_a = req.body) === null || _a === void 0 ? void 0 : _a.keywords;
            if (!Array.isArray(keywords)) {
                throw new Error('Request body must include "keywords" array');
            }
            const useCase = bindRepositories_1.diContainer.aiToolCatalogUseCase;
            const updated = await useCase.updateChatKeywords(toolName, keywords, userId);
            res.json({ success: true, data: updated.toJSON() });
        }
        catch (error) {
            next(error);
        }
    }
    // ─── Enablement Policies ───────────────────────────────────────────────
    /**
     * GET /platform/ai-tool-policies
     * List all tool enablement policies.
     */
    static async listEnablementPolicies(req, res, next) {
        try {
            const useCase = bindRepositories_1.diContainer.aiToolCatalogUseCase;
            const policies = await useCase.listEnablementPolicies();
            res.json({ success: true, data: policies.map(p => p.toJSON()) });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * PATCH /platform/ai-tool-policies/:toolId
     * Update a tool enablement policy.
     */
    static async updateEnablementPolicy(req, res, next) {
        try {
            const { toolId } = req.params;
            const userId = AiToolCatalogController.getUserId(req);
            const policyData = req.body;
            const { AiToolEnablementPolicy } = await Promise.resolve().then(() => __importStar(require('../../../domain/ai-assistant/entities/AiToolEnablementPolicy')));
            const policy = AiToolEnablementPolicy.fromJSON(Object.assign(Object.assign({}, policyData), { toolId }));
            const useCase = bindRepositories_1.diContainer.aiToolCatalogUseCase;
            const updated = await useCase.updateEnablementPolicy(policy, userId);
            res.json({ success: true, data: updated.toJSON() });
        }
        catch (error) {
            next(error);
        }
    }
    // ─── Model Tool Policies ──────────────────────────────────────────────
    /**
     * GET /platform/ai-model-tool-policies
     * List all model tool policies.
     */
    static async listModelToolPolicies(req, res, next) {
        try {
            const useCase = bindRepositories_1.diContainer.aiToolCatalogUseCase;
            const policies = await useCase.listModelToolPolicies();
            res.json({ success: true, data: policies.map(p => p.toJSON()) });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * PATCH /platform/ai-model-tool-policies/:policyId
     * Update a model tool policy.
     */
    static async updateModelToolPolicy(req, res, next) {
        try {
            const { policyId } = req.params;
            const userId = AiToolCatalogController.getUserId(req);
            const policyData = req.body;
            const { AiModelToolPolicy } = await Promise.resolve().then(() => __importStar(require('../../../domain/ai-assistant/entities/AiModelToolPolicy')));
            const policy = AiModelToolPolicy.fromJSON(Object.assign(Object.assign({}, policyData), { id: policyId }));
            const useCase = bindRepositories_1.diContainer.aiToolCatalogUseCase;
            const updated = await useCase.updateModelToolPolicy(policy, userId);
            res.json({ success: true, data: updated.toJSON() });
        }
        catch (error) {
            next(error);
        }
    }
    // ─── Catalog Sync ──────────────────────────────────────────────────────
    /**
     * POST /platform/ai-tools/sync
     * Sync the static catalog seed into the DB.
     * Creates entries for new tools but does NOT overwrite existing overrides.
     */
    static async syncCatalog(req, res, next) {
        try {
            const useCase = bindRepositories_1.diContainer.aiToolCatalogUseCase;
            const synced = await useCase.syncCatalogToDb();
            res.json({ success: true, data: { synced, message: `${synced} new tool definitions synced to DB` } });
        }
        catch (error) {
            next(error);
        }
    }
    // ─── Model Profiles ───────────────────────────────────────────────────
    static async listProviders(req, res, next) {
        try {
            const providers = await bindRepositories_1.diContainer.aiProviderRegistryUseCase.listProviders();
            res.json({ success: true, data: providers.map(provider => provider.toJSON()) });
        }
        catch (error) {
            next(error);
        }
    }
    static async getProvider(req, res, next) {
        try {
            const provider = await bindRepositories_1.diContainer.aiProviderRegistryUseCase.getProvider(req.params.providerId);
            res.json({ success: true, data: provider.toJSON() });
        }
        catch (error) {
            next(error);
        }
    }
    static async createProvider(req, res, next) {
        try {
            const provider = await bindRepositories_1.diContainer.aiProviderRegistryUseCase.upsertProvider(req.body);
            res.status(201).json({ success: true, data: provider.toJSON() });
        }
        catch (error) {
            next(error);
        }
    }
    static async updateProvider(req, res, next) {
        try {
            const existing = await bindRepositories_1.diContainer.aiProviderRegistryUseCase.getProvider(req.params.providerId);
            const provider = await bindRepositories_1.diContainer.aiProviderRegistryUseCase.upsertProvider(Object.assign(Object.assign(Object.assign({}, existing.toJSON()), req.body), { id: req.params.providerId }));
            res.json({ success: true, data: provider.toJSON() });
        }
        catch (error) {
            next(error);
        }
    }
    static async enableProvider(req, res, next) {
        try {
            const provider = await bindRepositories_1.diContainer.aiProviderRegistryUseCase.setEnabled(req.params.providerId, true);
            res.json({ success: true, data: provider.toJSON() });
        }
        catch (error) {
            next(error);
        }
    }
    static async disableProvider(req, res, next) {
        try {
            const provider = await bindRepositories_1.diContainer.aiProviderRegistryUseCase.setEnabled(req.params.providerId, false);
            res.json({ success: true, data: provider.toJSON() });
        }
        catch (error) {
            next(error);
        }
    }
    static async listModelProfiles(req, res, next) {
        try {
            const profiles = await bindRepositories_1.diContainer.aiModelProfileUseCase.listProfiles({
                provider: req.query.provider,
                status: req.query.status,
                tag: req.query.tag,
            });
            res.json({ success: true, data: profiles.map(profile => profile.toJSON()) });
        }
        catch (error) {
            next(error);
        }
    }
    static async getModelProfile(req, res, next) {
        try {
            const profile = await bindRepositories_1.diContainer.aiModelProfileUseCase.getProfileById(req.params.profileId);
            if (!profile) {
                throw ApiError_1.ApiError.notFound(`AI model profile '${req.params.profileId}' not found`);
            }
            res.json({ success: true, data: profile.toJSON() });
        }
        catch (error) {
            next(error);
        }
    }
    static async createModelProfile(req, res, next) {
        try {
            AiToolCatalogController.validateModelProfilePayload(req.body);
            const profile = await bindRepositories_1.diContainer.aiModelProfileUseCase.upsertProfile(req.body);
            res.status(201).json({ success: true, data: profile.toJSON() });
        }
        catch (error) {
            next(error);
        }
    }
    static async updateModelProfile(req, res, next) {
        var _a, _b;
        try {
            AiToolCatalogController.validateModelProfilePayload(req.body);
            const profile = await bindRepositories_1.diContainer.aiModelProfileUseCase.upsertProfile(Object.assign(Object.assign({}, req.body), { provider: (_a = req.body.provider) !== null && _a !== void 0 ? _a : req.params.profileId.split(':')[0], modelName: (_b = req.body.modelName) !== null && _b !== void 0 ? _b : req.params.profileId.split(':').slice(1).join(':') }));
            res.json({ success: true, data: profile.toJSON() });
        }
        catch (error) {
            next(error);
        }
    }
    static async deleteModelProfile(req, res, next) {
        try {
            await bindRepositories_1.diContainer.aiModelProfileUseCase.deleteProfile(req.params.profileId);
            res.json({ success: true, data: { deleted: true } });
        }
        catch (error) {
            next(error);
        }
    }
    static async syncModelProfiles(req, res, next) {
        try {
            const synced = await bindRepositories_1.diContainer.aiModelProfileUseCase.syncBuiltInProfiles();
            res.json({ success: true, data: { synced, message: `${synced} model profiles synced to DB` } });
        }
        catch (error) {
            next(error);
        }
    }
    static async runModelProfileDiagnostics(req, res, next) {
        try {
            const { companyId } = req.body;
            if (!companyId || typeof companyId !== 'string') {
                throw ApiError_1.ApiError.badRequest('companyId is required');
            }
            const profile = await bindRepositories_1.diContainer.aiModelProfileUseCase.getProfileById(req.params.profileId);
            if (!profile) {
                throw ApiError_1.ApiError.notFound(`AI model profile '${req.params.profileId}' not found`);
            }
            const { CheckProviderHealthUseCase } = await Promise.resolve().then(() => __importStar(require('../../../application/ai-assistant/use-cases/CheckProviderHealthUseCase')));
            const useCase = new CheckProviderHealthUseCase(bindRepositories_1.diContainer.aiSettingsRepository, bindRepositories_1.diContainer.encryptionService, bindRepositories_1.diContainer.httpClient, bindRepositories_1.diContainer.aiModelProfileUseCase);
            const result = await useCase.execute({
                companyId,
                providerOverride: profile.provider,
                modelOverride: profile.modelName,
            });
            res.json({ success: true, data: result });
        }
        catch (error) {
            next(error);
        }
    }
    static async listModelProfileCertifications(req, res, next) {
        try {
            const results = await bindRepositories_1.diContainer.aiModelCertificationUseCase.listResultsForProfile(req.params.profileId);
            res.json({ success: true, data: results.map(result => result.toJSON()) });
        }
        catch (error) {
            next(error);
        }
    }
    static async recordGlobalCertification(req, res, next) {
        try {
            const userId = AiToolCatalogController.getUserId(req);
            const result = await bindRepositories_1.diContainer.aiModelCertificationUseCase.recordManualCertification(Object.assign(Object.assign({}, req.body), { scope: 'GLOBAL', modelProfileId: req.params.profileId, testedBy: req.body.testedBy || userId, approvedBy: req.body.approvedBy || userId }));
            res.status(201).json({ success: true, data: result.toJSON() });
        }
        catch (error) {
            next(error);
        }
    }
    static async runGlobalCertification(req, res, next) {
        try {
            const userId = AiToolCatalogController.getUserId(req);
            const { profileHash, category, moduleId, skillId } = req.body;
            if (!profileHash)
                throw ApiError_1.ApiError.badRequest('profileHash is required');
            if (!category || !(0, AiCertificationCategory_1.isAiCertificationCategory)(category))
                throw ApiError_1.ApiError.badRequest('valid category is required');
            const result = await bindRepositories_1.diContainer.aiModelCertificationUseCase.runShellCertification({
                scope: 'GLOBAL',
                modelProfileId: req.params.profileId,
                profileHash,
                category,
                moduleId,
                skillId,
                testedBy: userId,
                approvedBy: userId,
            });
            res.status(201).json({ success: true, data: result.toJSON() });
        }
        catch (error) {
            next(error);
        }
    }
    static async expireCertification(req, res, next) {
        try {
            const userId = AiToolCatalogController.getUserId(req);
            const result = await bindRepositories_1.diContainer.aiModelCertificationUseCase.expireCertification(req.params.certificationId, userId);
            res.json({ success: true, data: result.toJSON() });
        }
        catch (error) {
            next(error);
        }
    }
    static async listValidCertifiedProfiles(req, res, next) {
        try {
            const category = req.query.category;
            if (category && !(0, AiCertificationCategory_1.isAiCertificationCategory)(category))
                throw ApiError_1.ApiError.badRequest('Invalid category');
            const data = await bindRepositories_1.diContainer.aiModelCertificationUseCase.listValidCertifiedProfiles({
                scope: req.query.scope,
                category: category,
                moduleId: req.query.moduleId,
            });
            res.json({ success: true, data });
        }
        catch (error) {
            next(error);
        }
    }
    static validateModelProfilePayload(body) {
        const statuses = ['recommended', 'tested', 'experimental', 'custom'];
        const warningLevels = ['none', 'info', 'warning', 'danger'];
        if (!body || typeof body !== 'object') {
            throw ApiError_1.ApiError.badRequest('Request body is required');
        }
        if (!body.provider || typeof body.provider !== 'string') {
            throw ApiError_1.ApiError.badRequest('provider is required');
        }
        if (!body.modelName || typeof body.modelName !== 'string') {
            throw ApiError_1.ApiError.badRequest('modelName is required');
        }
        if (!statuses.includes(body.status)) {
            throw ApiError_1.ApiError.badRequest(`status must be one of: ${statuses.join(', ')}`);
        }
        if (typeof body.supportsToolCalling !== 'boolean') {
            throw ApiError_1.ApiError.badRequest('supportsToolCalling must be boolean');
        }
        if (typeof body.supportsStructuredJson !== 'boolean') {
            throw ApiError_1.ApiError.badRequest('supportsStructuredJson must be boolean');
        }
        if (typeof body.textOnlyMode !== 'boolean') {
            throw ApiError_1.ApiError.badRequest('textOnlyMode must be boolean');
        }
        if (!Number.isFinite(Number(body.maxContextTokens)) || Number(body.maxContextTokens) < 1) {
            throw ApiError_1.ApiError.badRequest('maxContextTokens must be a positive number');
        }
        if (body.warningLevel && !warningLevels.includes(body.warningLevel)) {
            throw ApiError_1.ApiError.badRequest(`warningLevel must be one of: ${warningLevels.join(', ')}`);
        }
    }
}
exports.AiToolCatalogController = AiToolCatalogController;
//# sourceMappingURL=AiToolCatalogController.js.map