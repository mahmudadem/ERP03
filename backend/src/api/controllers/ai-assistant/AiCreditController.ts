/**
 * AiCreditController - Thin Express request handlers for AI Credit endpoints
 *
 * Tenant endpoint:
 *   GET /tenant/ai-assistant/credits — view own credit balance
 *
 * Platform (Super Admin) endpoint:
 *   POST /platform/ai-assistant/credits/grant — grant credits to a tenant
 *
 * Delegates all business logic to use cases.
 */

import { Request, Response, NextFunction } from 'express';
import { diContainer } from '../../../infrastructure/di/bindRepositories';
import { GetAiCreditBalanceUseCase } from '../../../application/ai-assistant/use-cases/GetAiCreditBalanceUseCase';
import { GrantAiCreditsUseCase } from '../../../application/ai-assistant/use-cases/GrantAiCreditsUseCase';
import { ApiError } from '../../errors/ApiError';

export class AiCreditController {
  // ─── Tenant Endpoints ────────────────────────────────────────────────────

  /**
   * GET /tenant/ai-assistant/credits
   * Returns the credit balance for the authenticated tenant's company.
   * companyId is extracted from request context — never from query/body.
   */
  static async getBalance(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = req.tenantContext?.companyId;
      if (!companyId) {
        throw ApiError.badRequest('Company context is required');
      }

      const useCase = new GetAiCreditBalanceUseCase(diContainer.aiCreditLedgerRepository);
      const result = await useCase.execute({ companyId });

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // ─── Platform (Super Admin) Endpoints ─────────────────────────────────────

  /**
   * POST /platform/ai-assistant/credits/grant
   * Super Admin grants credits to a specific tenant.
   * Body: { companyId: string, amount: number, reason?: string }
   */
  static async grantCredits(req: Request, res: Response, next: NextFunction) {
    try {
      const { companyId, amount, reason } = req.body;

      const useCase = new GrantAiCreditsUseCase(diContainer.aiCreditLedgerRepository);
      const result = await useCase.execute({ companyId, amount, reason });

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}