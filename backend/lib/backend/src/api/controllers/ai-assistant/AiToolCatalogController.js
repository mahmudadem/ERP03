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
class AiToolCatalogController {
    static getUserId(req) {
        var _a;
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
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
}
exports.AiToolCatalogController = AiToolCatalogController;
//# sourceMappingURL=AiToolCatalogController.js.map