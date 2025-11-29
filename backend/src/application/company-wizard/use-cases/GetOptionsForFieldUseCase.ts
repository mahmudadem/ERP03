import { CompanyWizardField } from '../../../domain/company-wizard';
import { IChartOfAccountsTemplateRepository } from '../../../repository/interfaces/company-wizard/IChartOfAccountsTemplateRepository';
import { ICurrencyRepository } from '../../../repository/interfaces/company-wizard/ICurrencyRepository';
import { IInventoryTemplateRepository } from '../../../repository/interfaces/company-wizard/IInventoryTemplateRepository';

export class GetOptionsForFieldUseCase {
  constructor(
    private chartRepo: IChartOfAccountsTemplateRepository,
    private currencyRepo: ICurrencyRepository,
    private inventoryTemplateRepo: IInventoryTemplateRepository
  ) {}

  async execute(field: CompanyWizardField): Promise<Array<{ id: string; label: string }> | null> {
    if (!field.optionsSource) return null;

    if (field.optionsSource === 'chartOfAccountsTemplates') {
      const items = await this.chartRepo.listChartOfAccountsTemplates();
      return items.map((i) => ({ id: i.id, label: i.name }));
    }

    if (field.optionsSource === 'currencies') {
      const items = await this.currencyRepo.listCurrencies();
      return items.map((i) => ({ id: i.id, label: i.name }));
    }

    if (field.optionsSource === 'inventoryTemplates') {
      const items = await this.inventoryTemplateRepo.listInventoryTemplates();
      return items.map((i) => ({ id: i.id, label: i.name }));
    }

    return null;
  }
}
