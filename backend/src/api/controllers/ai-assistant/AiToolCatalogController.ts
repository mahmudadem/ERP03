/**
 * AiToolCatalogController - Express request handlers for Super Admin AI Tool Management
 *
 * Thin controller that delegates to AiToolCatalogUseCase.
 * All endpoints require Super Admin authentication.
 */

import { Request, Response, NextFunction } from 'express';
import { diContainer } from '../../../infrastructure/di/bindRepositories';
import { ApiError } from '../../errors/ApiError';

export class AiToolCatalogController {
  private static getUserId(req: Request): string {
    const userId = (req as any).user?.id;
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
}