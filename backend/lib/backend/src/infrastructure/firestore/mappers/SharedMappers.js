"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaxCodeMapper = exports.PartyMapper = void 0;
const firestore_1 = require("firebase-admin/firestore");
const Party_1 = require("../../../domain/shared/entities/Party");
const TaxCode_1 = require("../../../domain/shared/entities/TaxCode");
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
class PartyMapper {
    static toDomain(data) {
        return Party_1.Party.fromJSON(Object.assign(Object.assign({}, data), { createdAt: toDate(data.createdAt), updatedAt: toDate(data.updatedAt) }));
    }
    static toPersistence(entity) {
        const data = entity.toJSON();
        return stripUndefinedDeep(Object.assign(Object.assign({}, data), { createdAt: toTimestamp(entity.createdAt), updatedAt: toTimestamp(entity.updatedAt) }));
    }
}
exports.PartyMapper = PartyMapper;
class TaxCodeMapper {
    static toDomain(data) {
        return TaxCode_1.TaxCode.fromJSON(Object.assign(Object.assign({}, data), { createdAt: toDate(data.createdAt), updatedAt: toDate(data.updatedAt) }));
    }
    static toPersistence(entity) {
        const data = entity.toJSON();
        return stripUndefinedDeep(Object.assign(Object.assign({}, data), { createdAt: toTimestamp(entity.createdAt), updatedAt: toTimestamp(entity.updatedAt) }));
    }
}
exports.TaxCodeMapper = TaxCodeMapper;
//# sourceMappingURL=SharedMappers.js.map