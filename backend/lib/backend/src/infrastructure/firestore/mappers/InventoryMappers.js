"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StockMovementMapper = exports.WarehouseMapper = exports.ItemMapper = void 0;
const admin = __importStar(require("firebase-admin"));
const Item_1 = require("../../../domain/inventory/entities/Item");
const Warehouse_1 = require("../../../domain/inventory/entities/Warehouse");
const StockMovement_1 = require("../../../domain/inventory/entities/StockMovement");
class ItemMapper {
    static toDomain(data) {
        return new Item_1.Item(data.id, data.companyId, data.name, data.code, data.unit, data.categoryId, data.active, data.price, data.cost);
    }
    static toPersistence(entity) {
        return {
            id: entity.id,
            companyId: entity.companyId,
            name: entity.name,
            code: entity.code,
            unit: entity.unit,
            categoryId: entity.categoryId,
            active: entity.active,
            price: entity.price || 0,
            cost: entity.cost || 0
        };
    }
}
exports.ItemMapper = ItemMapper;
class WarehouseMapper {
    static toDomain(data) {
        return new Warehouse_1.Warehouse(data.id, data.companyId, data.name, data.location);
    }
    static toPersistence(entity) {
        return {
            id: entity.id,
            companyId: entity.companyId,
            name: entity.name,
            location: entity.location || null
        };
    }
}
exports.WarehouseMapper = WarehouseMapper;
class StockMovementMapper {
    static toDomain(data) {
        var _a, _b;
        return new StockMovement_1.StockMovement(data.id, data.companyId, data.itemId, data.warehouseId, data.qty, data.direction, data.referenceType, data.referenceId, ((_b = (_a = data.date) === null || _a === void 0 ? void 0 : _a.toDate) === null || _b === void 0 ? void 0 : _b.call(_a)) || new Date(data.date));
    }
    static toPersistence(entity) {
        return {
            id: entity.id,
            companyId: entity.companyId,
            itemId: entity.itemId,
            warehouseId: entity.warehouseId,
            qty: entity.qty,
            direction: entity.direction,
            referenceType: entity.referenceType,
            referenceId: entity.referenceId,
            date: admin.firestore.Timestamp.fromDate(entity.date)
        };
    }
}
exports.StockMovementMapper = StockMovementMapper;
//# sourceMappingURL=InventoryMappers.js.map