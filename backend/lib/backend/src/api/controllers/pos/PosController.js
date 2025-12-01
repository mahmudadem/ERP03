"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PosController = void 0;
const PosUseCases_1 = require("../../../application/pos/use-cases/PosUseCases");
const bindRepositories_1 = require("../../../infrastructure/di/bindRepositories");
const PosDTOs_1 = require("../../dtos/PosDTOs");
class PosController {
    static async openShift(req, res, next) {
        try {
            const useCase = new PosUseCases_1.OpenPOSShiftUseCase(bindRepositories_1.diContainer.posShiftRepository);
            const shift = await useCase.execute(req.body);
            res.status(201).json({
                success: true,
                data: PosDTOs_1.PosDTOMapper.toShiftDTO(shift)
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async createOrder(req, res, next) {
        try {
            const useCase = new PosUseCases_1.CreatePOSOrderUseCase(bindRepositories_1.diContainer.posOrderRepository);
            const order = await useCase.execute(req.body);
            res.status(201).json({
                success: true,
                data: PosDTOs_1.PosDTOMapper.toOrderDTO(order)
            });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.PosController = PosController;
//# sourceMappingURL=PosController.js.map