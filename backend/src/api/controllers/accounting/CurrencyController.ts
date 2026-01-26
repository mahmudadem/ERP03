/**
 * CurrencyController
 * 
 * API endpoints for currency and exchange rate management.
 */

import { Request, Response } from 'express';
import { diContainer } from '../../../infrastructure/di/bindRepositories';
import { ListCurrenciesUseCase, GetCurrencyUseCase } from '../../../application/accounting/use-cases/CurrencyUseCases';
import { ListCompanyCurrenciesUseCase, EnableCurrencyForCompanyUseCase, DisableCurrencyForCompanyUseCase } from '../../../application/accounting/use-cases/CompanyCurrencyUseCases';
import { GetSuggestedRateUseCase, SaveReferenceRateUseCase, DetectRateDeviationService } from '../../../application/accounting/services/ExchangeRateService';

export class CurrencyController {
  /**
   * GET /currencies
   * List all active currencies in the system
   */
  static async listCurrencies(req: Request, res: Response) {
    try {
      const companyId = (req as any).companyId;
      const useCase = new ListCurrenciesUseCase(diContainer.accountingCurrencyRepository);
      const currencies = await useCase.execute(); // No companyId passed for global list
      res.json({ currencies: currencies.map(c => c.toJSON()) });
    } catch (error: any) {
      console.error('Error listing currencies:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /currencies/:code
   * Get a specific currency by code
   */
  static async getCurrency(req: Request, res: Response) {
    try {
      const { code } = req.params;
      const useCase = new GetCurrencyUseCase(diContainer.accountingCurrencyRepository);
      const currency = await useCase.execute(code);
      
      if (!currency) {
        return res.status(404).json({ error: `Currency ${code} not found` });
      }
      
      res.json({ currency: currency.toJSON() });
    } catch (error: any) {
      console.error('Error getting currency:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /company/currencies
   * List currencies enabled for the current company
   */
  static async listCompanyCurrencies(req: Request, res: Response) {
    try {
      const companyId = (req as any).companyId;
      if (!companyId) {
        return res.status(400).json({ error: 'Company ID required' });
      }

      const useCase = new ListCompanyCurrenciesUseCase(diContainer.companyCurrencyRepository);
      const companyCurrencies = await useCase.execute(companyId);
      res.json({ currencies: companyCurrencies });
    } catch (error: any) {
      console.error('Error listing company currencies:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * POST /company/currencies
   * Enable a currency for the company (requires initial rate)
   * Body: { currencyCode, initialRate, initialRateDate }
   */
  static async enableCurrency(req: Request, res: Response) {
    try {
      const companyId = (req as any).companyId;
      const userId = (req as any).user?.uid;
      if (!companyId) {
        return res.status(400).json({ error: 'Company ID required' });
      }

      const baseCurrency = await diContainer.companyCurrencyRepository.getBaseCurrency(companyId);
      if (!baseCurrency) {
        return res.status(400).json({ error: 'Base currency not configured for company' });
      }

      const { currencyCode, initialRate, initialRateDate } = req.body;

      if (!currencyCode) {
        return res.status(400).json({ error: 'currencyCode is required' });
      }

      if (initialRate === undefined || initialRate <= 0) {
        return res.status(400).json({ error: 'A positive initialRate is required when enabling a currency' });
      }

      const useCase = new EnableCurrencyForCompanyUseCase(
        diContainer.accountingCurrencyRepository,
        diContainer.companyCurrencyRepository,
        diContainer.exchangeRateRepository
      );

      const result = await useCase.execute({
        companyId,
        currencyCode,
        baseCurrency,
        initialRate: Number(initialRate),
        initialRateDate: initialRateDate ? new Date(initialRateDate) : new Date(),
        userId,
      });

      res.json({ success: true, companyCurrency: result });
    } catch (error: any) {
      console.error('Error enabling currency:', error);
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * DELETE /company/currencies/:code
   * Disable a currency for the company
   */
  static async disableCurrency(req: Request, res: Response) {
    try {
      const companyId = (req as any).companyId;
      const { code } = req.params;

      if (!companyId) {
        return res.status(400).json({ error: 'Company ID required' });
      }

      const baseCurrency = await diContainer.companyCurrencyRepository.getBaseCurrency(companyId);
      if (!baseCurrency) {
        return res.status(400).json({ error: 'Base currency not configured for company' });
      }

      const useCase = new DisableCurrencyForCompanyUseCase(
        diContainer.companyCurrencyRepository,
        diContainer.accountRepository,
        diContainer.voucherRepository,
        baseCurrency
      );
      await useCase.execute(companyId, code);

      res.json({ success: true });
    } catch (error: any) {
      console.error('Error disabling currency:', error);
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * GET /exchange-rates/history
   * List recent exchange rates for a context (company, optionally specific pair)
   * Query: fromCurrency, toCurrency, limit
   */
  static async listRateHistory(req: Request, res: Response) {
    try {
      const companyId = (req as any).companyId;
      const { fromCurrency, toCurrency, limit } = req.query;

      if (!companyId) {
        return res.status(400).json({ error: 'Company ID required' });
      }

      const historyLimit = limit ? Number(limit) : 20;
      const rates = await diContainer.exchangeRateRepository.getRecentRates(
        companyId,
        fromCurrency as string || undefined as any, // Repository handles undefined as "all pairs" if implemented, or we can filter
        toCurrency as string || undefined as any,
        historyLimit
      );

      res.json({ rates: rates.map(r => r.toJSON()) });
    } catch (error: any) {
      console.error('Error listing rate history:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /exchange-rates/matrix
   * Get latest rates for all enabled currencies
   */
  static async getLatestRatesMatrix(req: Request, res: Response) {
    try {
      const companyId = (req as any).companyId;
      if (!companyId) return res.status(400).json({ error: 'Company ID required' });

      // 1. Get enabled codes
      const companyCurrencies = await diContainer.companyCurrencyRepository.findEnabledByCompany(companyId);
      const enabledCodes = companyCurrencies.filter(c => c.isEnabled).map(c => c.currencyCode);
      const baseCurrency = await diContainer.companyCurrencyRepository.getBaseCurrency(companyId);
      
      if (!baseCurrency) {
        return res.status(400).json({ error: 'Base currency not configured' });
      }

      const allCodes = Array.from(new Set([baseCurrency, ...enabledCodes]));

      // 2. Fetch recent rates (limit 200 to cover many pairs)
      const allRecent = await diContainer.exchangeRateRepository.getRecentRates(companyId, undefined, undefined, 200);
      
      const matrix: Record<string, Record<string, number>> = {};
      
      // Initialize matrix
      allCodes.forEach(from => {
        matrix[from] = {};
        allCodes.forEach(to => {
          if (from === to) matrix[from][to] = 1.0;
        });
      });

      // Fill with latest stored rates
      // Since they are ordered by createdAt desc, we only take the first occurance for each pair
      allRecent.forEach(rate => {
        const from = rate.fromCurrency.toUpperCase();
        const to = rate.toCurrency.toUpperCase();
        if (allCodes.includes(from) && allCodes.includes(to)) {
          if (matrix[from][to] === undefined) {
            matrix[from][to] = rate.rate;
          }
        }
      });

      // Helper function to round to specified decimal places for precision
      const roundToPrecision = (num: number, decimals: number = 8): number => {
        return Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals);
      };

      // Track which pairs have manually stored rates (from database)
      const manuallyStored = new Set<string>();
      allRecent.forEach(rate => {
        const from = rate.fromCurrency.toUpperCase();
        const to = rate.toCurrency.toUpperCase();
        if (allCodes.includes(from) && allCodes.includes(to)) {
          manuallyStored.add(`${from}-${to}`);
        }
      });

      // Calculate inverse rates ONLY for pairs without manually stored rates
      let inversesCalculated = 0;
      allCodes.forEach(from => {
        allCodes.forEach(to => {
          if (from !== to && matrix[to][from] !== undefined && !manuallyStored.has(`${from}-${to}`)) {
            // Only calculate inverse if this pair was NOT manually stored
            const inverseRate = 1 / matrix[to][from];
            const calculatedInverse = roundToPrecision(inverseRate, 8);
            
            matrix[from][to] = calculatedInverse;
            inversesCalculated++;
          }
        });
      });

      res.json({ matrix, currencies: allCodes });
    } catch (error: any) {
      console.error('Error getting rates matrix:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /exchange-rates/suggested
   * Get suggested exchange rate for a currency pair
   * Query: fromCurrency, toCurrency, date
   */
  static async getSuggestedRate(req: Request, res: Response) {
    try {
      const companyId = (req as any).companyId;
      const { fromCurrency, toCurrency, date } = req.query;

      if (!companyId) {
        return res.status(400).json({ error: 'Company ID required' });
      }

      if (!fromCurrency || !toCurrency) {
        return res.status(400).json({ error: 'fromCurrency and toCurrency are required' });
      }

      const useCase = new GetSuggestedRateUseCase(diContainer.exchangeRateRepository);
      const result = await useCase.execute(
        companyId,
        fromCurrency as string,
        toCurrency as string,
        date ? new Date(date as string) : new Date()
      );

      // NOTE: Returns null if no rate exists - frontend must handle this
      res.json({
        rate: result.rate?.rate ?? null,
        source: result.source,
        rateDate: result.rate?.date?.toISOString() ?? null,
      });
    } catch (error: any) {
      console.error('Error getting suggested rate:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * POST /exchange-rates
   * Save a reference exchange rate
   * Body: { fromCurrency, toCurrency, rate, date }
   */
  static async saveRate(req: Request, res: Response) {
    try {
      const companyId = (req as any).companyId;
      const userId = (req as any).user?.uid;

      if (!companyId) {
        return res.status(400).json({ error: 'Company ID required' });
      }

      const { fromCurrency, toCurrency, rate, date } = req.body;

      if (!fromCurrency || !toCurrency) {
        return res.status(400).json({ error: 'fromCurrency and toCurrency are required' });
      }

      if (rate === undefined || rate <= 0) {
        return res.status(400).json({ error: 'A positive rate is required' });
      }

      // IMPORTANT: Delete any existing inverse rate (toCurrency→fromCurrency) to prevent conflicts
      // This ensures that when we save EUR→TRY=55, any old TRY→EUR entries are removed
      // so the matrix will calculate TRY→EUR as 1/55 instead of using stale stored values
      try {
        const inverseRates = await diContainer.exchangeRateRepository.getRecentRates(
          companyId,
          toCurrency.toUpperCase(),
          fromCurrency.toUpperCase(),
          100 // Get all inverse rates
        );
        
        if (inverseRates.length > 0) {
          // Delete each inverse rate
          for (const inverseRate of inverseRates) {
            await (diContainer.exchangeRateRepository as any).delete(inverseRate.id);
          }
        }
      } catch (cleanupError) {
        // Continue anyway - cleanup failure is not critical
      }

      const useCase = new SaveReferenceRateUseCase(diContainer.exchangeRateRepository);
      const savedRate = await useCase.execute({
        companyId,
        fromCurrency,
        toCurrency,
        rate: Number(rate),
        date: date ? new Date(date) : new Date(),
        userId,
      });

      res.json({ success: true, exchangeRate: savedRate.toJSON() });
    } catch (error: any) {
      console.error('Error saving rate:', error);
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * POST /exchange-rates/check-deviation
   * Check if a proposed rate has significant deviation from historical rates
   * Body: { fromCurrency, toCurrency, proposedRate }
   */
  static async checkRateDeviation(req: Request, res: Response) {
    try {
      const companyId = (req as any).companyId;

      if (!companyId) {
        return res.status(400).json({ error: 'Company ID required' });
      }

      const { fromCurrency, toCurrency, proposedRate } = req.body;

      if (!fromCurrency || !toCurrency || proposedRate === undefined) {
        return res.status(400).json({ error: 'fromCurrency, toCurrency, and proposedRate are required' });
      }

      const service = new DetectRateDeviationService(diContainer.exchangeRateRepository);
      const warnings = await service.detectDeviations(
        companyId,
        fromCurrency,
        toCurrency,
        Number(proposedRate)
      );

      res.json({ warnings, hasWarnings: warnings.length > 0 });
    } catch (error: any) {
      console.error('Error checking rate deviation:', error);
      res.status(500).json({ error: error.message });
    }
  }
}
