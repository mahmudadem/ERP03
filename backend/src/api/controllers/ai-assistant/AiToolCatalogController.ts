/**
 * AiToolCatalogController - Express request handlers for Super Admin AI Tool Management
 *
 * Thin controller that delegates to AiToolCatalogUseCase.
 * All endpoints require Super Admin authentication.
 */

import { Request, Response, NextFunction } from 'express';
import { diContainer } from '../../../infrastructure/di/bindRepositories';
import { ApiError } from '../../errors/ApiError';
import { isAiCertificationCategory } from '../../../domain/ai-assistant/entities/AiCertificationCategory';

export class AiToolCatalogController {
  private static getUserId(req: Request): string {
    const userId = (req as any).user?.uid || (req as any).user?.id;
    if (!userId) throw ApiError.unauthorized('User not authenticated');
    return userId;
  }

  /**
   * GET /platform/ai-tools
   * List all tool definitions with optional filters.
   */
  static async listTools(req: Request, res: Response, next: NextFunction) {
    try {
      const useCase = diContainer.aiToolCatalogUseCase;
      const filters = {
        module: req.query.module as string | undefined,
        category: req.query.category as string | undefined,
        status: req.query.status as string | undefined,
        mode: req.query.mode as string | undefined,
        implemented: req.query.implemented as string | undefined,
      };
      const tools = await useCase.listCatalog(filters);
      res.json({ success: true, data: tools.map(t => t.toJSON()) });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /platform/ai-tools/:toolName
   * Get a single tool definition.
   */
  static async getTool(req: Request, res: Response, next: NextFunction) {
    try {
      const { toolName } = req.params;
      const useCase = diContainer.aiToolCatalogUseCase;
      const tool = await useCase.getCatalogEntry(toolName);

      if (!tool) {
        throw ApiError.notFound(`Tool '${toolName}' not found`);
      }

      res.json({ success: true, data: tool.toJSON() });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /platform/ai-tools/:toolName
   * Update a tool definition (status only — mode, permissions, and riskLevel are immutable).
   */
  static async updateTool(req: Request, res: Response, next: NextFunction) {
    try {
      const { toolName } = req.params;
      const { status } = req.body;
      const userId = AiToolCatalogController.getUserId(req);

      if (!status || !['active', 'disabled', 'deprecated'].includes(status)) {
        throw ApiError.badRequest('Status must be one of: active, disabled, deprecated');
      }

      const useCase = diContainer.aiToolCatalogUseCase;
      const updated = await useCase.updateToolStatus(toolName, status, userId);
      res.json({ success: true, data: updated.toJSON() });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /platform/ai-tools/:toolName/enable
   * Enable a tool globally.
   */
  static async enableTool(req: Request, res: Response, next: NextFunction) {
    try {
      const { toolName } = req.params;
      const userId = AiToolCatalogController.getUserId(req);

      const useCase = diContainer.aiToolCatalogUseCase;
      const updated = await useCase.enableTool(toolName, userId);
      res.json({ success: true, data: updated.toJSON() });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /platform/ai-tools/:toolName/disable
   * Disable a tool globally.
   */
  static async disableTool(req: Request, res: Response, next: NextFunction) {
    try {
      const { toolName } = req.params;
      const userId = AiToolCatalogController.getUserId(req);

      const useCase = diContainer.aiToolCatalogUseCase;
      const updated = await useCase.disableTool(toolName, userId);
      res.json({ success: true, data: updated.toJSON() });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /platform/ai-tools/:toolName/keywords
   * Update a tool's chat keywords.
   */
  static async updateChatKeywords(req: Request, res: Response, next: NextFunction) {
    try {
      const { toolName } = req.params;
      const userId = AiToolCatalogController.getUserId(req);
      const keywords = (req.body as any)?.keywords as string[] | undefined;

      if (!Array.isArray(keywords)) {
        throw new Error('Request body must include "keywords" array');
      }

      const useCase = diContainer.aiToolCatalogUseCase;
      const updated = await useCase.updateChatKeywords(toolName, keywords, userId);
      res.json({ success: true, data: updated.toJSON() });
    } catch (error) {
      next(error);
    }
  }

  // ─── Enablement Policies ───────────────────────────────────────────────

  /**
   * GET /platform/ai-tool-policies
   * List all tool enablement policies.
   */
  static async listEnablementPolicies(req: Request, res: Response, next: NextFunction) {
    try {
      const useCase = diContainer.aiToolCatalogUseCase;
      const policies = await useCase.listEnablementPolicies();
      res.json({ success: true, data: policies.map(p => p.toJSON()) });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /platform/ai-tool-policies/:toolId
   * Update a tool enablement policy.
   */
  static async updateEnablementPolicy(req: Request, res: Response, next: NextFunction) {
    try {
      const { toolId } = req.params;
      const userId = AiToolCatalogController.getUserId(req);
      const policyData = req.body;

      const { AiToolEnablementPolicy } = await import('../../../domain/ai-assistant/entities/AiToolEnablementPolicy');
      const policy = AiToolEnablementPolicy.fromJSON({ ...policyData, toolId });

      const useCase = diContainer.aiToolCatalogUseCase;
      const updated = await useCase.updateEnablementPolicy(policy, userId);
      res.json({ success: true, data: updated.toJSON() });
    } catch (error) {
      next(error);
    }
  }

  // ─── Model Tool Policies ──────────────────────────────────────────────

  /**
   * GET /platform/ai-model-tool-policies
   * List all model tool policies.
   */
  static async listModelToolPolicies(req: Request, res: Response, next: NextFunction) {
    try {
      const useCase = diContainer.aiToolCatalogUseCase;
      const policies = await useCase.listModelToolPolicies();
      res.json({ success: true, data: policies.map(p => p.toJSON()) });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /platform/ai-model-tool-policies/:policyId
   * Update a model tool policy.
   */
  static async updateModelToolPolicy(req: Request, res: Response, next: NextFunction) {
    try {
      const { policyId } = req.params;
      const userId = AiToolCatalogController.getUserId(req);
      const policyData = req.body;

      const { AiModelToolPolicy } = await import('../../../domain/ai-assistant/entities/AiModelToolPolicy');
      const policy = AiModelToolPolicy.fromJSON({ ...policyData, id: policyId });

      const useCase = diContainer.aiToolCatalogUseCase;
      const updated = await useCase.updateModelToolPolicy(policy, userId);
      res.json({ success: true, data: updated.toJSON() });
    } catch (error) {
      next(error);
    }
  }

  // ─── Catalog Sync ──────────────────────────────────────────────────────

  /**
   * POST /platform/ai-tools/sync
   * Sync the static catalog seed into the DB.
   * Creates entries for new tools but does NOT overwrite existing overrides.
   */
  static async syncCatalog(req: Request, res: Response, next: NextFunction) {
    try {
      const useCase = diContainer.aiToolCatalogUseCase;
      const synced = await useCase.syncCatalogToDb();
      res.json({ success: true, data: { synced, message: `${synced} new tool definitions synced to DB` } });
    } catch (error) {
      next(error);
    }
  }

  // ─── Model Profiles ───────────────────────────────────────────────────

  static async listProviders(req: Request, res: Response, next: NextFunction) {
    try {
      const providers = await diContainer.aiProviderRegistryUseCase.listProviders();
      res.json({ success: true, data: providers.map(provider => provider.toJSON()) });
    } catch (error) {
      next(error);
    }
  }

  static async getProvider(req: Request, res: Response, next: NextFunction) {
    try {
      const provider = await diContainer.aiProviderRegistryUseCase.getProvider(req.params.providerId);
      res.json({ success: true, data: provider.toJSON() });
    } catch (error) {
      next(error);
    }
  }

  static async createProvider(req: Request, res: Response, next: NextFunction) {
    try {
      const provider = await diContainer.aiProviderRegistryUseCase.upsertProvider(req.body);
      res.status(201).json({ success: true, data: provider.toJSON() });
    } catch (error) {
      next(error);
    }
  }

  static async updateProvider(req: Request, res: Response, next: NextFunction) {
    try {
      const existing = await diContainer.aiProviderRegistryUseCase.getProvider(req.params.providerId);
      const provider = await diContainer.aiProviderRegistryUseCase.upsertProvider({
        ...existing.toJSON(),
        ...req.body,
        id: req.params.providerId,
      } as any);
      res.json({ success: true, data: provider.toJSON() });
    } catch (error) {
      next(error);
    }
  }

  static async enableProvider(req: Request, res: Response, next: NextFunction) {
    try {
      const provider = await diContainer.aiProviderRegistryUseCase.setEnabled(req.params.providerId, true);
      res.json({ success: true, data: provider.toJSON() });
    } catch (error) {
      next(error);
    }
  }

  static async disableProvider(req: Request, res: Response, next: NextFunction) {
    try {
      const provider = await diContainer.aiProviderRegistryUseCase.setEnabled(req.params.providerId, false);
      res.json({ success: true, data: provider.toJSON() });
    } catch (error) {
      next(error);
    }
  }

  static async listModelProfiles(req: Request, res: Response, next: NextFunction) {
    try {
      const profiles = await diContainer.aiModelProfileUseCase.listProfiles({
        provider: req.query.provider as string | undefined,
        status: req.query.status as string | undefined,
        tag: req.query.tag as string | undefined,
      });
      res.json({ success: true, data: profiles.map(profile => profile.toJSON()) });
    } catch (error) {
      next(error);
    }
  }

  static async getModelProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const profile = await diContainer.aiModelProfileUseCase.getProfileById(req.params.profileId);
      if (!profile) {
        throw ApiError.notFound(`AI model profile '${req.params.profileId}' not found`);
      }
      res.json({ success: true, data: profile.toJSON() });
    } catch (error) {
      next(error);
    }
  }

  static async createModelProfile(req: Request, res: Response, next: NextFunction) {
    try {
      AiToolCatalogController.validateModelProfilePayload(req.body);
      const profile = await diContainer.aiModelProfileUseCase.upsertProfile(req.body);
      res.status(201).json({ success: true, data: profile.toJSON() });
    } catch (error) {
      next(error);
    }
  }

  static async updateModelProfile(req: Request, res: Response, next: NextFunction) {
    try {
      AiToolCatalogController.validateModelProfilePayload(req.body);
      const profile = await diContainer.aiModelProfileUseCase.upsertProfile({
        ...req.body,
        provider: req.body.provider ?? req.params.profileId.split(':')[0],
        modelName: req.body.modelName ?? req.params.profileId.split(':').slice(1).join(':'),
      });
      res.json({ success: true, data: profile.toJSON() });
    } catch (error) {
      next(error);
    }
  }

  static async deleteModelProfile(req: Request, res: Response, next: NextFunction) {
    try {
      await diContainer.aiModelProfileUseCase.deleteProfile(req.params.profileId);
      res.json({ success: true, data: { deleted: true } });
    } catch (error) {
      next(error);
    }
  }

  static async syncModelProfiles(req: Request, res: Response, next: NextFunction) {
    try {
      const synced = await diContainer.aiModelProfileUseCase.syncBuiltInProfiles();
      res.json({ success: true, data: { synced, message: `${synced} model profiles synced to DB` } });
    } catch (error) {
      next(error);
    }
  }

  static async runModelProfileDiagnostics(req: Request, res: Response, next: NextFunction) {
    try {
      const { companyId } = req.body as { companyId?: string };
      if (!companyId || typeof companyId !== 'string') {
        throw ApiError.badRequest('companyId is required');
      }

      const profile = await diContainer.aiModelProfileUseCase.getProfileById(req.params.profileId);
      if (!profile) {
        throw ApiError.notFound(`AI model profile '${req.params.profileId}' not found`);
      }

      const { CheckProviderHealthUseCase } = await import(
        '../../../application/ai-assistant/use-cases/CheckProviderHealthUseCase'
      );
      const useCase = new CheckProviderHealthUseCase(
        diContainer.aiSettingsRepository,
        diContainer.encryptionService,
        diContainer.httpClient,
        diContainer.aiModelProfileUseCase,
      );
      const result = await useCase.execute({
        companyId,
        providerOverride: profile.provider as any,
        modelOverride: profile.modelName,
      });
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async listModelProfileCertifications(req: Request, res: Response, next: NextFunction) {
    try {
      const results = await diContainer.aiModelCertificationUseCase.listResultsForProfile(req.params.profileId);
      res.json({ success: true, data: results.map(result => result.toJSON()) });
    } catch (error) {
      next(error);
    }
  }

  static async recordGlobalCertification(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = AiToolCatalogController.getUserId(req);
      const result = await diContainer.aiModelCertificationUseCase.recordManualCertification({
        ...req.body,
        scope: 'GLOBAL',
        modelProfileId: req.params.profileId,
        testedBy: req.body.testedBy || userId,
        approvedBy: req.body.approvedBy || userId,
      });
      res.status(201).json({ success: true, data: result.toJSON() });
    } catch (error) {
      next(error);
    }
  }

  static async runGlobalCertification(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = AiToolCatalogController.getUserId(req);
      const { profileHash, category, moduleId, skillId } = req.body;
      if (!profileHash) throw ApiError.badRequest('profileHash is required');
      if (!category || !isAiCertificationCategory(category)) throw ApiError.badRequest('valid category is required');
      const result = await diContainer.aiModelCertificationUseCase.runShellCertification({
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
    } catch (error) {
      next(error);
    }
  }

  static async expireCertification(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = AiToolCatalogController.getUserId(req);
      const result = await diContainer.aiModelCertificationUseCase.expireCertification(req.params.certificationId, userId);
      res.json({ success: true, data: result.toJSON() });
    } catch (error) {
      next(error);
    }
  }

  static async listValidCertifiedProfiles(req: Request, res: Response, next: NextFunction) {
    try {
      const category = req.query.category as string | undefined;
      if (category && !isAiCertificationCategory(category)) throw ApiError.badRequest('Invalid category');
      const data = await diContainer.aiModelCertificationUseCase.listValidCertifiedProfiles({
        scope: req.query.scope as any,
        category: category as any,
        moduleId: req.query.moduleId as string | undefined,
      });
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  private static validateModelProfilePayload(body: any): void {
    const statuses = ['recommended', 'tested', 'experimental', 'custom'];
    const warningLevels = ['none', 'info', 'warning', 'danger'];
    if (!body || typeof body !== 'object') {
      throw ApiError.badRequest('Request body is required');
    }
    if (!body.provider || typeof body.provider !== 'string') {
      throw ApiError.badRequest('provider is required');
    }
    if (!body.modelName || typeof body.modelName !== 'string') {
      throw ApiError.badRequest('modelName is required');
    }
    if (!statuses.includes(body.status)) {
      throw ApiError.badRequest(`status must be one of: ${statuses.join(', ')}`);
    }
    if (typeof body.supportsToolCalling !== 'boolean') {
      throw ApiError.badRequest('supportsToolCalling must be boolean');
    }
    if (typeof body.supportsStructuredJson !== 'boolean') {
      throw ApiError.badRequest('supportsStructuredJson must be boolean');
    }
    if (typeof body.textOnlyMode !== 'boolean') {
      throw ApiError.badRequest('textOnlyMode must be boolean');
    }
    if (!Number.isFinite(Number(body.maxContextTokens)) || Number(body.maxContextTokens) < 1) {
      throw ApiError.badRequest('maxContextTokens must be a positive number');
    }
    if (body.warningLevel && !warningLevels.includes(body.warningLevel)) {
      throw ApiError.badRequest(`warningLevel must be one of: ${warningLevels.join(', ')}`);
    }
  }
}
