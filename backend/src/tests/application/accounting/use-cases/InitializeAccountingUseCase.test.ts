import { InitializeAccountingUseCase } from '../../../../application/accounting/use-cases/InitializeAccountingUseCase';

/**
 * Regression: the COA template carries reporting-classification metadata
 * (plSubgroup / equitySubgroup) that drives P&L sub-categorisation, Balance Sheet
 * equity grouping, and the periodic Trading Account (which keys entirely off
 * plSubgroup SALES / COST_OF_SALES). The account-creation path used to build the
 * create input field-by-field and silently dropped these tags, so every seeded
 * account was persisted untagged and the Trading Account reported hasData=false /
 * zeroes on a freshly-initialised periodic tenant. This test asserts the tags are
 * threaded onto the created accounts.
 */
describe('InitializeAccountingUseCase — reporting classification threading', () => {
  it('persists template plSubgroup / equitySubgroup onto created accounts', async () => {
    const templateAccounts = [
      { code: '4', name: 'Revenue', type: 'revenue', parentCode: null },
      { code: '400', name: 'Sales', type: 'revenue', parentCode: '4', plSubgroup: 'SALES' },
      { code: '5', name: 'Expenses', type: 'expense', parentCode: null },
      { code: '501', name: 'Cost of Sales', type: 'expense', parentCode: '5', plSubgroup: 'COST_OF_SALES' },
      { code: '50101', name: 'Purchases', type: 'expense', parentCode: '501', plSubgroup: 'COST_OF_SALES' },
      { code: '3', name: 'Equity', type: 'equity', parentCode: null },
      { code: '301', name: 'Owner Capital', type: 'equity', parentCode: '3', equitySubgroup: 'CONTRIBUTED_CAPITAL' },
    ];

    const created: any[] = [];

    const accountRepo: any = {
      list: jest.fn(async () => []),
      create: jest.fn(async (_companyId: string, data: any) => {
        created.push(data);
        return { id: data.id, userCode: data.userCode };
      }),
    };

    const useCase = new InitializeAccountingUseCase(
      { update: jest.fn() } as any, // companyModuleRepo
      accountRepo,
      {
        getMetadata: jest.fn(async (key: string) => {
          if (key === 'coa_templates') return [{ id: 'test_coa', accounts: templateAccounts }];
          if (key === 'currencies') return [{ code: 'SYP', name: 'Syrian Pound', symbol: 'SYP', decimalPlaces: 2 }];
          return [];
        }),
      } as any, // systemMetadataRepo
      { saveSettings: jest.fn(), getSettings: jest.fn(async () => null) } as any, // settingsRepo
      { updateSettings: jest.fn() } as any, // companySettingsRepo
      { seedCurrencies: jest.fn() } as any, // currencyRepo
      { update: jest.fn() } as any, // companyRepo
      { findByCompany: jest.fn(async () => []), save: jest.fn() } as any, // fiscalYearRepo
      { getSystemTemplates: jest.fn(async () => []), createVoucherType: jest.fn() } as any, // voucherTypeRepo
      { getAllByCompany: jest.fn(async () => []), create: jest.fn(), update: jest.fn() } as any // voucherFormRepo
    );

    await useCase.execute({
      companyId: 'cmp-1',
      config: {
        fiscalYearStart: '01-01',
        fiscalYearEnd: '12-31',
        baseCurrency: 'SYP',
        coaTemplate: 'test_coa',
        periodScheme: 'MONTHLY',
      },
    });

    const byCode = (code: string) => created.find((a) => a.userCode === code);

    expect(byCode('400')?.plSubgroup).toBe('SALES');
    expect(byCode('501')?.plSubgroup).toBe('COST_OF_SALES');
    expect(byCode('50101')?.plSubgroup).toBe('COST_OF_SALES');
    expect(byCode('301')?.equitySubgroup).toBe('CONTRIBUTED_CAPITAL');
    // Untagged accounts simply carry undefined (persisted as null by the repo).
    expect(byCode('4')?.plSubgroup).toBeUndefined();
  });
});
