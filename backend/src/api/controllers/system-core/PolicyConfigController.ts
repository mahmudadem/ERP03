import { Request, Response, NextFunction } from 'express';
import { diContainer } from '../../../infrastructure/di/bindRepositories';
import { PolicyConfig } from '../../../domain/system-core/entities/PolicyConfig';
import { validateUpdatePolicyConfigInput } from '../../validators/policyConfig.validators';

/**
 * PolicyConfigController — engine-owned doorway to the typed `PolicyConfig`
 * store for the company-wide Controls & Policies screen.
 *
 * Task 267-D (Engine Management API Doorways): the same `PolicyConfig`
 * document is read/written by every module's policy doorway. This
 * controller is the "full matrix" doorway — it accepts rules for any
 * module tag and any action. Module-specific doorways (POS / Sales /
 * Purchases) constrain the rule set to their own module tag.
 *
 * Tenant isolation: `companyId` is always resolved from
 * `req.tenantContext.companyId` (or `req.user.companyId` for the auth
 * path). The request body is NEVER allowed to override the company id.
 */
export class PolicyConfigController {
  private static getCompanyId(req: Request): string {
    const ctxCompanyId = (req as any).tenantContext?.companyId;
    const userCompanyId = (req as any).user?.companyId;
    const companyId = ctxCompanyId || userCompanyId;
    if (!companyId) {
      throw new Error('Company context not found');
    }
    return companyId;
  }

  /**
   * GET /tenant/settings/controls/policies
   *
   * Returns the full `PolicyConfig` for the authenticated company. If no
   * document exists yet, returns the default (empty rule set) so the
   * company-wide matrix page always has something to render.
   */
  static async getPolicyConfig(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = PolicyConfigController.getCompanyId(req);
      const existing = await diContainer.policyConfigRepository.getConfig(companyId);
      const config = existing ?? PolicyConfig.createDefault(companyId);
      (res as any).json({ success: true, data: config.toJSON() });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /tenant/settings/controls/policies
   *
   * Replaces the company's `PolicyConfig` with the supplied rule set.
   * Validates shape via the neutral `validateUpdatePolicyConfigInput`. The
   * entity constructor further rejects rules with missing id / action /
   * scope (the PolicyConfig entity is the last line of defense — see
   * `tests/domain/system-core/PolicyConfig.test.ts`).
   */
  static async updatePolicyConfig(req: Request, res: Response, next: NextFunction) {
    try {
      validateUpdatePolicyConfigInput((req as any).body);
      const companyId = PolicyConfigController.getCompanyId(req);
      const body = (req as any).body || {};

      // Load the existing config so we preserve `createdAt` and any
      // audit-only fields the entity owns.
      const existing = await diContainer.policyConfigRepository.getConfig(companyId);
      const createdAt = existing?.createdAt;

      const nextConfig = new PolicyConfig({
        companyId,
        rules: Array.isArray(body.rules) ? body.rules : [],
        ...(createdAt ? { createdAt } : {}),
      });
      await diContainer.policyConfigRepository.saveConfig(nextConfig);
      (res as any).json({ success: true, data: nextConfig.toJSON() });
    } catch (error) {
      next(error);
    }
  }
}
