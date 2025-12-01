"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryController = void 0;
const ItemUseCases_1 = require("../../../application/inventory/use-cases/ItemUseCases");
const WarehouseUseCases_1 = require("../../../application/inventory/use-cases/WarehouseUseCases");
const bindRepositories_1 = require("../../../infrastructure/di/bindRepositories");
const InventoryDTOs_1 = require("../../dtos/InventoryDTOs");
const inventory_validators_1 = require("../../validators/inventory.validators");
class InventoryController {
    static async createItem(req, res, next) {
        try {
            (0, inventory_validators_1.validateCreateItemInput)(req.body);
            const useCase = new ItemUseCases_1.CreateItemUseCase(bindRepositories_1.diContainer.itemRepository);
            const item = await useCase.execute(req.body);
            res.status(201).json({
                success: true,
                data: InventoryDTOs_1.InventoryDTOMapper.toItemDTO(item)
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async createWarehouse(req, res, next) {
        try {
            const useCase = new WarehouseUseCases_1.CreateWarehouseUseCase(bindRepositories_1.diContainer.warehouseRepository);
            await useCase.execute(req.body);
            res.status(201).json({ success: true, message: 'Warehouse created' });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.InventoryController = InventoryController;
//# sourceMappingURL=InventoryController.js.map