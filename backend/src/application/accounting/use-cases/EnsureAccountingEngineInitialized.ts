import { ICompanyModuleRepository } from '../../../repository/interfaces/company/ICompanyModuleRepository';
import { ICompanyRepository } from '../../../repository/interfaces/core/ICompanyRepository';
import { InitializeAccountingUseCase } from './InitializeAccountingUseCase';
import { AccountingEngineUnavailableError } from '../../../domain/accounting/errors/AccountingEngineUnavailableError';

/**
 * EnsureAccountingEngineInitialized
 *
 * Idempotent guard used by Sales/Purchases/Inventory before any posting or
 * module initialization. Ensures the Accounting **Engine** is ready:
 *   - chart of accounts seeded
 *   - voucher types copied
 *   - fiscal year created
 *   - base currency set
 *
 * The Accounting **UI/App** visibility is a separate concern (CompanyModule.isEnabled)
 * and is never consulted here. Posting paths must call this — UI toggling does not
 * affect whether the Engine runs.
 *
 * Behavior:
 *   - If accounting CompanyModule.initialized === true → no-op
 *   - Otherwise: auto-invoke InitializeAccountingUseCase with safe defaults derived from
 *     the company record (base currency must already be set on Company)
 *   - Throws AccountingEngineUnavailableError when defaults cannot be derived (missing
 *     base currency, no default COA template, init failure)
 */
export class EnsureAccountingEngineInitialized {
  constructor(
    private readonly companyModuleRepo: ICompanyModuleRepository,
    private readonly companyRepo: ICompanyRepository,
    private readonly initializeAccountingUseCase: InitializeAccountingUseCase
  ) {}

  async execute(companyId: string): Promise<void> {
    const accountingModule = await this.companyModuleRepo.get(companyId, 'accounting');
    if (accountingModule?.initialized) {
      return;
    }

    const company = await this.companyRepo.findById(companyId);
    if (!company) {
      throw new AccountingEngineUnavailableError({
        companyId,
        reason: 'INIT_FAILED',
        cause: 'Company not found',
      });
    }

    if (!company.baseCurrency || String(company.baseCurrency).trim() === '') {
      throw new AccountingEngineUnavailableError({
        companyId,
        reason: 'MISSING_BASE_CURRENCY',
        missingFields: ['company.baseCurrency'],
      });
    }

    try {
      await this.initializeAccountingUseCase.execute({
        companyId,
        config: {
          baseCurrency: company.baseCurrency,
          coaTemplate: 'standard',
          fiscalYearStart: '01-01',
          fiscalYearEnd: '12-31',
          periodScheme: 'MONTHLY',
          selectedVoucherTypes: [],
        },
      });
    } catch (err: any) {
      if (err instanceof AccountingEngineUnavailableError) throw err;
      const cause = err?.message || String(err);
      const reason = cause.includes('COA Template') ? 'MISSING_COA_TEMPLATE' : 'INIT_FAILED';
      throw new AccountingEngineUnavailableError({
        companyId,
        reason,
        cause,
      });
    }
  }
}
