export interface ICurrencyRepository {
  listCurrencies(companyId?: string): Promise<Array<{ id: string; name: string }>>;
  seedCurrencies(companyId: string, currencies: any[], baseCurrency?: string): Promise<void>;
}
