"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SalesReturnMapper = exports.SalesInvoiceMapper = exports.DeliveryNoteMapper = exports.SalesOrderMapper = exports.SalesSettingsMapper = void 0;
const firestore_1 = require("firebase-admin/firestore");
const DeliveryNote_1 = require("../../../domain/sales/entities/DeliveryNote");
const SalesInvoice_1 = require("../../../domain/sales/entities/SalesInvoice");
const SalesOrder_1 = require("../../../domain/sales/entities/SalesOrder");
const SalesReturn_1 = require("../../../domain/sales/entities/SalesReturn");
const SalesSettings_1 = require("../../../domain/sales/entities/SalesSettings");
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
class SalesSettingsMapper {
    static toDomain(data) {
        return SalesSettings_1.SalesSettings.fromJSON(Object.assign({}, data));
    }
    static toPersistence(entity) {
        return stripUndefinedDeep(Object.assign({}, entity.toJSON()));
    }
}
exports.SalesSettingsMapper = SalesSettingsMapper;
class SalesOrderMapper {
    static toDomain(data) {
        return SalesOrder_1.SalesOrder.fromJSON(Object.assign(Object.assign({}, data), { createdAt: toDate(data.createdAt), updatedAt: toDate(data.updatedAt), confirmedAt: toDate(data.confirmedAt), closedAt: toDate(data.closedAt) }));
    }
    static toPersistence(entity) {
        const data = entity.toJSON();
        return stripUndefinedDeep(Object.assign(Object.assign({}, data), { createdAt: toTimestamp(entity.createdAt), updatedAt: toTimestamp(entity.updatedAt), confirmedAt: toTimestamp(entity.confirmedAt), closedAt: toTimestamp(entity.closedAt) }));
    }
}
exports.SalesOrderMapper = SalesOrderMapper;
class DeliveryNoteMapper {
    static toDomain(data) {
        return DeliveryNote_1.DeliveryNote.fromJSON(Object.assign(Object.assign({}, data), { createdAt: toDate(data.createdAt), updatedAt: toDate(data.updatedAt), postedAt: toDate(data.postedAt) }));
    }
    static toPersistence(entity) {
        const data = entity.toJSON();
        return stripUndefinedDeep(Object.assign(Object.assign({}, data), { createdAt: toTimestamp(entity.createdAt), updatedAt: toTimestamp(entity.updatedAt), postedAt: toTimestamp(entity.postedAt) }));
    }
}
exports.DeliveryNoteMapper = DeliveryNoteMapper;
class SalesInvoiceMapper {
    static toDomain(data) {
        return SalesInvoice_1.SalesInvoice.fromJSON(Object.assign(Object.assign({}, data), { createdAt: toDate(data.createdAt), updatedAt: toDate(data.updatedAt), postedAt: toDate(data.postedAt) }));
    }
    static toPersistence(entity) {
        const data = entity.toJSON();
        return stripUndefinedDeep(Object.assign(Object.assign({}, data), { createdAt: toTimestamp(entity.createdAt), updatedAt: toTimestamp(entity.updatedAt), postedAt: toTimestamp(entity.postedAt) }));
    }
}
exports.SalesInvoiceMapper = SalesInvoiceMapper;
class SalesReturnMapper {
    static toDomain(data) {
        return SalesReturn_1.SalesReturn.fromJSON(Object.assign(Object.assign({}, data), { createdAt: toDate(data.createdAt), updatedAt: toDate(data.updatedAt), postedAt: toDate(data.postedAt) }));
    }
    static toPersistence(entity) {
        const data = entity.toJSON();
        return stripUndefinedDeep(Object.assign(Object.assign({}, data), { createdAt: toTimestamp(entity.createdAt), updatedAt: toTimestamp(entity.updatedAt), postedAt: toTimestamp(entity.postedAt) }));
    }
}
exports.SalesReturnMapper = SalesReturnMapper;
//# sourceMappingURL=SalesMappers.js.map