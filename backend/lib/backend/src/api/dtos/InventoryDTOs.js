"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryDTOMapper = void 0;
class InventoryDTOMapper {
    static toItemDTO(item) {
        return {
            id: item.id,
            code: item.code,
            name: item.name,
            unit: item.unit,
            price: item.price || 0,
            active: item.active,
        };
    }
    static toWarehouseDTO(wh) {
        return {
            id: wh.id,
            name: wh.name,
            location: wh.location,
        };
    }
}
exports.InventoryDTOMapper = InventoryDTOMapper;
//# sourceMappingURL=InventoryDTOs.js.map