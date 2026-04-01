"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryPeriodSnapshotMapper = exports.StockTransferMapper = exports.StockAdjustmentMapper = exports.InventorySettingsMapper = exports.UomConversionMapper = exports.ItemCategoryMapper = exports.StockLevelMapper = exports.StockMovementMapper = exports.WarehouseMapper = exports.ItemMapper = void 0;
const firestore_1 = require("firebase-admin/firestore");
const Item_1 = require("../../../domain/inventory/entities/Item");
const Warehouse_1 = require("../../../domain/inventory/entities/Warehouse");
const StockMovement_1 = require("../../../domain/inventory/entities/StockMovement");
const StockLevel_1 = require("../../../domain/inventory/entities/StockLevel");
const ItemCategory_1 = require("../../../domain/inventory/entities/ItemCategory");
const UomConversion_1 = require("../../../domain/inventory/entities/UomConversion");
const InventorySettings_1 = require("../../../domain/inventory/entities/InventorySettings");
const StockAdjustment_1 = require("../../../domain/inventory/entities/StockAdjustment");
const InventoryPeriodSnapshot_1 = require("../../../domain/inventory/entities/InventoryPeriodSnapshot");
const StockTransfer_1 = require("../../../domain/inventory/entities/StockTransfer");
const toDate = (value) => {
    if (!value)
        return undefined;
    if (value instanceof Date)
        return value;
    if ((value === null || value === void 0 ? void 0 : value.toDate) && typeof value.toDate === 'function')
        return value.toDate();
    return new Date(value);
};
const toTimestamp = (value) => {
    if (!value)
        return null;
    return firestore_1.Timestamp.fromDate(value);
};
const stripUndefinedDeep = (value) => {
    if (value === undefined)
        return undefined;
    if (value === null)
        return null;
    if (Array.isArray(value)) {
        return value
            .map((item) => stripUndefinedDeep(item))
            .filter((item) => item !== undefined);
    }
    if (value instanceof Date || value instanceof firestore_1.Timestamp) {
        return value;
    }
    if (typeof value !== 'object') {
        return value;
    }
    const output = {};
    Object.entries(value).forEach(([key, entry]) => {
        const normalized = stripUndefinedDeep(entry);
        if (normalized !== undefined) {
            output[key] = normalized;
        }
    });
    return output;
};
class ItemMapper {
    static toDomain(data) {
        return Item_1.Item.fromJSON(Object.assign(Object.assign({}, data), { createdAt: toDate(data.createdAt), updatedAt: toDate(data.updatedAt) }));
    }
    static toPersistence(entity) {
        const data = entity.toJSON();
        return stripUndefinedDeep(Object.assign(Object.assign({}, data), { createdAt: toTimestamp(entity.createdAt), updatedAt: toTimestamp(entity.updatedAt) }));
    }
}
exports.ItemMapper = ItemMapper;
class WarehouseMapper {
    static toDomain(data) {
        return Warehouse_1.Warehouse.fromJSON(Object.assign(Object.assign({}, data), { createdAt: toDate(data.createdAt), updatedAt: toDate(data.updatedAt) }));
    }
    static toPersistence(entity) {
        const data = entity.toJSON();
        return stripUndefinedDeep(Object.assign(Object.assign({}, data), { createdAt: toTimestamp(entity.createdAt), updatedAt: toTimestamp(entity.updatedAt) }));
    }
}
exports.WarehouseMapper = WarehouseMapper;
class StockMovementMapper {
    static toDomain(data) {
        return StockMovement_1.StockMovement.fromJSON(Object.assign(Object.assign({}, data), { createdAt: toDate(data.createdAt), postedAt: toDate(data.postedAt) }));
    }
    static toPersistence(entity) {
        const data = entity.toJSON();
        return stripUndefinedDeep(Object.assign(Object.assign({}, data), { createdAt: toTimestamp(entity.createdAt), postedAt: toTimestamp(entity.postedAt) }));
    }
}
exports.StockMovementMapper = StockMovementMapper;
class StockLevelMapper {
    static toDomain(data) {
        return StockLevel_1.StockLevel.fromJSON(Object.assign(Object.assign({}, data), { updatedAt: toDate(data.updatedAt) }));
    }
    static toPersistence(entity) {
        const data = entity.toJSON();
        return stripUndefinedDeep(Object.assign(Object.assign({}, data), { updatedAt: toTimestamp(entity.updatedAt) }));
    }
}
exports.StockLevelMapper = StockLevelMapper;
class ItemCategoryMapper {
    static toDomain(data) {
        return ItemCategory_1.ItemCategory.fromJSON(data);
    }
    static toPersistence(entity) {
        return stripUndefinedDeep(entity.toJSON());
    }
}
exports.ItemCategoryMapper = ItemCategoryMapper;
class UomConversionMapper {
    static toDomain(data) {
        return UomConversion_1.UomConversion.fromJSON(data);
    }
    static toPersistence(entity) {
        return stripUndefinedDeep(entity.toJSON());
    }
}
exports.UomConversionMapper = UomConversionMapper;
class InventorySettingsMapper {
    static toDomain(data) {
        return InventorySettings_1.InventorySettings.fromJSON(data);
    }
    static toPersistence(entity) {
        return stripUndefinedDeep(entity.toJSON());
    }
}
exports.InventorySettingsMapper = InventorySettingsMapper;
class StockAdjustmentMapper {
    static toDomain(data) {
        return StockAdjustment_1.StockAdjustment.fromJSON(Object.assign(Object.assign({}, data), { createdAt: toDate(data.createdAt), postedAt: toDate(data.postedAt) }));
    }
    static toPersistence(entity) {
        const data = entity.toJSON();
        return stripUndefinedDeep(Object.assign(Object.assign({}, data), { createdAt: toTimestamp(entity.createdAt), postedAt: toTimestamp(entity.postedAt) }));
    }
}
exports.StockAdjustmentMapper = StockAdjustmentMapper;
class StockTransferMapper {
    static toDomain(data) {
        return StockTransfer_1.StockTransfer.fromJSON(Object.assign(Object.assign({}, data), { createdAt: toDate(data.createdAt), completedAt: toDate(data.completedAt) }));
    }
    static toPersistence(entity) {
        const data = entity.toJSON();
        return stripUndefinedDeep(Object.assign(Object.assign({}, data), { createdAt: toTimestamp(entity.createdAt), completedAt: toTimestamp(entity.completedAt) }));
    }
}
exports.StockTransferMapper = StockTransferMapper;
class InventoryPeriodSnapshotMapper {
    static toDomain(data) {
        return InventoryPeriodSnapshot_1.InventoryPeriodSnapshot.fromJSON(Object.assign(Object.assign({}, data), { createdAt: toDate(data.createdAt) }));
    }
    static toPersistence(entity) {
        const data = entity.toJSON();
        return stripUndefinedDeep(Object.assign(Object.assign({}, data), { createdAt: toTimestamp(entity.createdAt) }));
    }
}
exports.InventoryPeriodSnapshotMapper = InventoryPeriodSnapshotMapper;
//# sourceMappingURL=InventoryMappers.js.map