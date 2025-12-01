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
}
exports.DesignerController = DesignerController;
//# sourceMappingURL=DesignerController.js.map