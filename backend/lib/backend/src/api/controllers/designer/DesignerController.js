"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DesignerController = void 0;
const DesignerUseCases_1 = require("../../../application/designer/use-cases/DesignerUseCases");
const bindRepositories_1 = require("../../../infrastructure/di/bindRepositories");
class DesignerController {
    static async createForm(req, res, next) {
        try {
            const useCase = new DesignerUseCases_1.CreateFormDefinitionUseCase(bindRepositories_1.diContainer.formDefinitionRepository);
            await useCase.execute(req.body);
            res.status(201).json({ success: true, message: 'Form definition saved' });
        }
        catch (error) {
            next(error);
        }
    }
    static async createVoucherType(req, res, next) {
        try {
            const useCase = new DesignerUseCases_1.CreateVoucherTypeDefinitionUseCase(bindRepositories_1.diContainer.voucherTypeDefinitionRepository);
            await useCase.execute(req.body);
            res.status(201).json({ success: true, message: 'Voucher type saved' });
        }
        catch (error) {
            next(error);
        }
    }
    static async adoptTemplate(req, res, next) {
        try {
            const { companyId, userId, templateId, module } = req.body;
            const useCase = new DesignerUseCases_1.AdoptTemplateUseCase(bindRepositories_1.diContainer.voucherTypeDefinitionRepository, bindRepositories_1.diContainer.voucherFormRepository);
            const result = await useCase.execute({ companyId, userId, templateId, module });
            res.status(201).json(Object.assign({ success: true }, result));
        }
        catch (error) {
            next(error);
        }
    }
}
exports.DesignerController = DesignerController;
//# sourceMappingURL=DesignerController.js.map