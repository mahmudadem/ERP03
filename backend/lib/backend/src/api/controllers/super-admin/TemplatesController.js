"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TemplatesController = void 0;
const bindRepositories_1 = require("../../../infrastructure/di/bindRepositories");
class TemplatesController {
    static async listWizardTemplates(req, res, next) {
        try {
            const templates = await bindRepositories_1.diContainer.companyWizardTemplateRepository.listAll();
            res.json({ success: true, data: templates });
        }
        catch (error) {
            next(error);
        }
    }
    static async listCoaTemplates(req, res, next) {
        try {
            const templates = await bindRepositories_1.diContainer.chartOfAccountsTemplateRepository.listChartOfAccountsTemplates();
            res.json({ success: true, data: templates });
        }
        catch (error) {
            next(error);
        }
    }
    static async listCurrencies(req, res, next) {
        try {
            const currencies = await bindRepositories_1.diContainer.currencyRepository.listCurrencies();
            res.json({ success: true, data: currencies });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.TemplatesController = TemplatesController;
//# sourceMappingURL=TemplatesController.js.map