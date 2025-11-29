export interface IChartOfAccountsTemplateRepository {
  listChartOfAccountsTemplates(): Promise<Array<{ id: string; name: string }>>;
}
