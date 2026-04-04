"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PurchaseReturnMapper = exports.PurchaseInvoiceMapper = exports.GoodsReceiptMapper = exports.PurchaseOrderMapper = exports.PurchaseSettingsMapper = void 0;
const firestore_1 = require("firebase-admin/firestore");
const GoodsReceipt_1 = require("../../../domain/purchases/entities/GoodsReceipt");
const PurchaseInvoice_1 = require("../../../domain/purchases/entities/PurchaseInvoice");
const PurchaseOrder_1 = require("../../../domain/purchases/entities/PurchaseOrder");
const PurchaseReturn_1 = require("../../../domain/purchases/entities/PurchaseReturn");
const PurchaseSettings_1 = require("../../../domain/purchases/entities/PurchaseSettings");
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
class PurchaseSettingsMapper {
    static toDomain(data) {
        return PurchaseSettings_1.PurchaseSettings.fromJSON(Object.assign({}, data));
    }
    static toPersistence(entity) {
        const data = entity.toJSON();
        return stripUndefinedDeep(Object.assign({}, data));
    }
}
exports.PurchaseSettingsMapper = PurchaseSettingsMapper;
class PurchaseOrderMapper {
    static toDomain(data) {
        return PurchaseOrder_1.PurchaseOrder.fromJSON(Object.assign(Object.assign({}, data), { createdAt: toDate(data.createdAt), updatedAt: toDate(data.updatedAt), confirmedAt: toDate(data.confirmedAt), closedAt: toDate(data.closedAt) }));
    }
    static toPersistence(entity) {
        const data = entity.toJSON();
        return stripUndefinedDeep(Object.assign(Object.assign({}, data), { createdAt: toTimestamp(entity.createdAt), updatedAt: toTimestamp(entity.updatedAt), confirmedAt: toTimestamp(entity.confirmedAt), closedAt: toTimestamp(entity.closedAt) }));
    }
}
exports.PurchaseOrderMapper = PurchaseOrderMapper;
class GoodsReceiptMapper {
    static toDomain(data) {
        return GoodsReceipt_1.GoodsReceipt.fromJSON(Object.assign(Object.assign({}, data), { createdAt: toDate(data.createdAt), updatedAt: toDate(data.updatedAt), postedAt: toDate(data.postedAt) }));
    }
    static toPersistence(entity) {
        const data = entity.toJSON();
        return stripUndefinedDeep(Object.assign(Object.assign({}, data), { createdAt: toTimestamp(entity.createdAt), updatedAt: toTimestamp(entity.updatedAt), postedAt: toTimestamp(entity.postedAt) }));
    }
}
exports.GoodsReceiptMapper = GoodsReceiptMapper;
class PurchaseInvoiceMapper {
    static toDomain(data) {
        return PurchaseInvoice_1.PurchaseInvoice.fromJSON(Object.assign(Object.assign({}, data), { createdAt: toDate(data.createdAt), updatedAt: toDate(data.updatedAt), postedAt: toDate(data.postedAt) }));
    }
    static toPersistence(entity) {
        const data = entity.toJSON();
        return stripUndefinedDeep(Object.assign(Object.assign({}, data), { createdAt: toTimestamp(entity.createdAt), updatedAt: toTimestamp(entity.updatedAt), postedAt: toTimestamp(entity.postedAt) }));
    }
}
exports.PurchaseInvoiceMapper = PurchaseInvoiceMapper;
class PurchaseReturnMapper {
    static toDomain(data) {
        return PurchaseReturn_1.PurchaseReturn.fromJSON(Object.assign(Object.assign({}, data), { createdAt: toDate(data.createdAt), updatedAt: toDate(data.updatedAt), postedAt: toDate(data.postedAt) }));
    }
    static toPersistence(entity) {
        const data = entity.toJSON();
        return stripUndefinedDeep(Object.assign(Object.assign({}, data), { createdAt: toTimestamp(entity.createdAt), updatedAt: toTimestamp(entity.updatedAt), postedAt: toTimestamp(entity.postedAt) }));
    }
}
exports.PurchaseReturnMapper = PurchaseReturnMapper;
//# sourceMappingURL=PurchaseMappers.js.map