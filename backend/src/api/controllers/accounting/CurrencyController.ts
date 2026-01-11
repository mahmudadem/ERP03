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
      const useCase = new ListCurrenciesUseCase(diContainer.accountingCurrencyRepository);
      const currencies = await useCase.execute();
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
      const userId = (req as any).uid;
      const baseCurrency = (req as any).baseCurrency || 'USD';
      
      if (!companyId) {
        return res.status(400).json({ error: 'Company ID required' });
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

      const useCase = new DisableCurrencyForCompanyUseCase(diContainer.companyCurrencyRepository);
      await useCase.execute(companyId, code);

      res.json({ success: true });
    } catch (error: any) {
      console.error('Error disabling currency:', error);
      res.status(400).json({ error: error.message });
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
      const userId = (req as any).uid;

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
