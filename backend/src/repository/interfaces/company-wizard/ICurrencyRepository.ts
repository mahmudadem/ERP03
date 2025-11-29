export interface ICurrencyRepository {
  listCurrencies(): Promise<Array<{ id: string; name: string }>>;
}
