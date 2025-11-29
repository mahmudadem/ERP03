export interface IInventoryTemplateRepository {
  listInventoryTemplates(): Promise<Array<{ id: string; name: string }>>;
}
