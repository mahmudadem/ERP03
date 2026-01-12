import { useQuery } from '@tanstack/react-query';
import { accountingApi, CurrencyDTO, CompanyCurrencyDTO } from '../../../api/accountingApi';
import { useCompanyAccess } from '../../../context/CompanyAccessContext';

export interface Currency {
  code: string;
  name: string;
  symbol: string;
  decimalPlaces: number;
}

/**
 * Hook to fetch and cache currencies enabled for the current company.
 * 
 * Uses React Query for deduplication across multiple components (e.g. voucher lines).
 */
export function useCompanyCurrencies() {
  const { companyId, company } = useCompanyAccess();
  const baseCurrencyCode = company?.baseCurrency || 'USD';

  return useQuery({
    queryKey: ['company-currencies', companyId, baseCurrencyCode],
    queryFn: async () => {
      if (!companyId) return [];

      // Fetch company-enabled currencies
      const response = await accountingApi.getCompanyCurrencies();
      
      // Fetch full currency metadata
      const globalResponse = await accountingApi.getCurrencies();
      const globalMap = new Map(
        globalResponse.currencies?.map((c: CurrencyDTO) => [c.code, c]) || []
      );

      // Base currency is always enabled
      const baseCurrency: Currency = {
        code: baseCurrencyCode,
        name: globalMap.get(baseCurrencyCode)?.name || (baseCurrencyCode === 'USD' ? 'US Dollar' : baseCurrencyCode),
        symbol: globalMap.get(baseCurrencyCode)?.symbol || (baseCurrencyCode === 'USD' ? '$' : baseCurrencyCode),
        decimalPlaces: globalMap.get(baseCurrencyCode)?.decimalPlaces || 2,
      };

      // Map enabled currencies to full details
      const enabledExtraCurrencies: Currency[] = (response.currencies || [])
        .filter((cc: CompanyCurrencyDTO) => cc.isEnabled && cc.currencyCode !== baseCurrencyCode)
        .map((cc: CompanyCurrencyDTO) => {
          const full = globalMap.get(cc.currencyCode);
          return full ? {
            code: full.code,
            name: full.name,
            symbol: full.symbol,
            decimalPlaces: full.decimalPlaces,
          } : {
            code: cc.currencyCode,
            name: cc.currencyCode,
            symbol: cc.currencyCode,
            decimalPlaces: 2,
          };
        });

      return [baseCurrency, ...enabledExtraCurrencies];
    },
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });
}
