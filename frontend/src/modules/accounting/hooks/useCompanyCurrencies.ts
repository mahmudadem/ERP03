import { useQuery } from '@tanstack/react-query';
import { accountingApi, CurrencyDTO, CompanyCurrencyDTO } from '../../../api/accountingApi';
import { useCompanyAccess } from '../../../context/CompanyAccessContext';

export interface Currency {
  code: string;
  name: string;
  symbol: string;
  decimalPlaces: number;
  isBase?: boolean;
}

/**
 * Hook to fetch and cache currencies enabled for the current company.
 * 
 * Uses React Query for deduplication across multiple components (e.g. voucher lines).
 */
export function useCompanyCurrencies() {
  const { companyId, company } = useCompanyAccess();
  const profileBaseCode = company?.baseCurrency;

  return useQuery({
    queryKey: ['company-currencies', companyId, profileBaseCode],
    queryFn: async () => {
      if (!companyId) return [];

      // Fetch company-enabled currencies
      const response = await accountingApi.getCompanyCurrencies();
      const companyCurrencies = response.currencies || [];
      
      // Determine base currency code
      // Priority: 1. Found in enabled list via isBase flag, 2. Global profile, 3. 'USD' fallback
      const foundBase = companyCurrencies.find(c => c.isBase)?.currencyCode;
      const effectiveBaseCode = foundBase || profileBaseCode || 'USD';
      
      // Fetch full currency metadata
      const globalResponse = await accountingApi.getCurrencies();
      const globalMap = new Map(
        globalResponse.currencies?.map((c: CurrencyDTO) => [c.code, c]) || []
      );
      
      // Map base currency
      const baseCurrency: Currency = {
        code: effectiveBaseCode,
        name: globalMap.get(effectiveBaseCode)?.name || (effectiveBaseCode === 'SYP' ? 'Syrian Pound' : effectiveBaseCode),
        symbol: globalMap.get(effectiveBaseCode)?.symbol || (effectiveBaseCode === 'SYP' ? 'ل.س' : effectiveBaseCode),
        decimalPlaces: globalMap.get(effectiveBaseCode)?.decimalPlaces || 2,
        isBase: true,
      };

      // Map enabled currencies to full details (excluding the one we already added as base)
      const enabledExtraCurrencies: Currency[] = companyCurrencies
        .filter((cc: CompanyCurrencyDTO) => cc.isEnabled && cc.currencyCode !== effectiveBaseCode)
        .map((cc: CompanyCurrencyDTO) => {
          const full = globalMap.get(cc.currencyCode);
          const fallbackName = cc.currencyCode === 'SYP' ? 'Syrian Pound' : cc.currencyCode;
          const fallbackSymbol = cc.currencyCode === 'SYP' ? 'ل.س' : cc.currencyCode;
          
          return full ? {
            code: full.code,
            name: full.name,
            symbol: full.symbol,
            decimalPlaces: full.decimalPlaces,
            isBase: false,
          } : {
            code: cc.currencyCode,
            name: fallbackName,
            symbol: fallbackSymbol,
            decimalPlaces: 2,
            isBase: false,
          };
        });

      return [baseCurrency, ...enabledExtraCurrencies];
    },
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });
}
