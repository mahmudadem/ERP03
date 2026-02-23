import { Request, Response, NextFunction } from 'express';
import { CalculateFXRevaluationUseCase } from '../../../application/accounting/use-cases/CalculateFXRevaluationUseCase';
import { GenerateFXRevaluationVoucherUseCase } from '../../../application/accounting/use-cases/GenerateFXRevaluationVoucherUseCase';
import { GetSuggestedRateUseCase } from '../../../application/accounting/services/ExchangeRateService';
import { diContainer } from '../../../infrastructure/di/bindRepositories';

/**
 * FXRevaluationController
 * 
 * Exposes endpoints for:
 * 1. Calculating FX revaluation deltas (preview, no DB writes)
 * 2. Generating a DRAFT voucher from the calculation
 * 3. Detecting currencies requiring revaluation
 */
export class FXRevaluationController {
  
  /**
   * POST /fx-revaluation/calculate
   * Body: { asOfDate, targetAccountIds?, exchangeRates }
   * Returns: Calculation preview with per-account deltas
   */
  static async calculate(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).companyId || (req as any).user?.companyId;
      const { asOfDate, targetAccountIds, exchangeRates } = req.body;

      if (!asOfDate) {
        return (res as any).status(400).json({ success: false, error: 'asOfDate is required' });
      }

      if (!exchangeRates || Object.keys(exchangeRates).length === 0) {
        return (res as any).status(400).json({ success: false, error: 'exchangeRates map is required' });
      }

      const useCase = new CalculateFXRevaluationUseCase(
        diContainer.ledgerRepository,
        diContainer.accountRepository,
        diContainer.companyRepository
      );

      const result = await useCase.execute({
        companyId,
        asOfDate: new Date(asOfDate),
        targetAccountIds,
        exchangeRates
      });

      (res as any).status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /fx-revaluation/detect-currencies
   * Body: { asOfDate, targetAccountIds? }
   * Returns: List of foreign currencies found in selected accounts
   */
  static async detectCurrencies(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).companyId || (req as any).user?.companyId;
      const { asOfDate, targetAccountIds } = req.body;

      if (!asOfDate) {
        return (res as any).status(400).json({ success: false, error: 'asOfDate is required' });
      }

      const company = await diContainer.companyRepository.findById(companyId);
      if (!company) {
        return (res as any).status(404).json({ success: false, error: 'Company not found' });
      }

      // Fetch foreign balances to detect which currencies need revaluation
      const foreignBalances = await diContainer.ledgerRepository.getForeignBalances(
        companyId, 
        new Date(asOfDate), 
        targetAccountIds
      );

      const currencies = Array.from(new Set(foreignBalances.map(b => b.currency)));

      // Fetch suggested rates (latest rates from ExchangeRateRepository)
      const suggestedRates: Record<string, number> = {};
      const suggestedRateUseCase = new GetSuggestedRateUseCase(diContainer.exchangeRateRepository);

      for (const curr of currencies) {
        const result = await suggestedRateUseCase.execute(
            companyId, 
            curr, 
            company.baseCurrency, 
            new Date(asOfDate)
        );
        suggestedRates[curr] = result.rate?.rate || 1.0;
      }

      (res as any).status(200).json({
        success: true,
        data: {
          baseCurrency: company.baseCurrency,
          currencies,
          suggestedRates
        }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /fx-revaluation/generate-voucher
   * Body: { calculationResult, targetGainLossAccountId }
   * Returns: Created draft voucher info
   */
  static async generateVoucher(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).companyId || (req as any).user?.companyId;
      const userId = (req as any).user?.uid;
      const { calculationResult, targetGainLossAccountId } = req.body;

      if (!calculationResult || !targetGainLossAccountId) {
        return (res as any).status(400).json({ 
          success: false, 
          error: 'calculationResult and targetGainLossAccountId are required' 
        });
      }

      const useCase = new GenerateFXRevaluationVoucherUseCase(
        diContainer.voucherRepository,
        diContainer.companyRepository
      );

      const result = await useCase.execute(
        companyId,
        userId,
        {
          ...calculationResult,
          asOfDate: new Date(calculationResult.asOfDate)
        },
        targetGainLossAccountId
      );

      (res as any).status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
}
