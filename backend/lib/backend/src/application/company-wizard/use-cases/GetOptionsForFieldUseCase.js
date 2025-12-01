"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetOptionsForFieldUseCase = void 0;
class GetOptionsForFieldUseCase {
    constructor(chartRepo, currencyRepo, inventoryTemplateRepo) {
        this.chartRepo = chartRepo;
        this.currencyRepo = currencyRepo;
        this.inventoryTemplateRepo = inventoryTemplateRepo;
    }
    async execute(field) {
        if (!field.optionsSource)
            return null;
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
exports.GetOptionsForFieldUseCase = GetOptionsForFieldUseCase;
//# sourceMappingURL=GetOptionsForFieldUseCase.js.map