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
exports.POSOrderMapper = exports.POSShiftMapper = void 0;
const admin = __importStar(require("firebase-admin"));
const POSShift_1 = require("../../../domain/pos/entities/POSShift");
const POSOrder_1 = require("../../../domain/pos/entities/POSOrder");
class POSShiftMapper {
    static toDomain(data) {
        var _a, _b, _c, _d;
        return new POSShift_1.POSShift(data.id, data.companyId, data.userId, ((_b = (_a = data.openedAt) === null || _a === void 0 ? void 0 : _a.toDate) === null || _b === void 0 ? void 0 : _b.call(_a)) || new Date(data.openedAt), data.openingBalance, data.closedAt ? (((_d = (_c = data.closedAt) === null || _c === void 0 ? void 0 : _c.toDate) === null || _d === void 0 ? void 0 : _d.call(_c)) || new Date(data.closedAt)) : undefined, data.closingBalance);
    }
    static toPersistence(entity) {
        return {
            id: entity.id,
            companyId: entity.companyId,
            userId: entity.userId,
            openedAt: admin.firestore.Timestamp.fromDate(entity.openedAt),
            openingBalance: entity.openingBalance,
            closedAt: entity.closedAt ? admin.firestore.Timestamp.fromDate(entity.closedAt) : null,
            closingBalance: entity.closingBalance || null
        };
    }
}
exports.POSShiftMapper = POSShiftMapper;
class POSOrderMapper {
    static toDomain(data) {
        var _a, _b;
        const items = (data.items || []).map((i) => new POSOrder_1.POSOrderItem(i.itemId, i.name, i.qty, i.price, i.discount));
        return new POSOrder_1.POSOrder(data.id, data.companyId, data.shiftId, items, data.totalAmount, ((_b = (_a = data.createdAt) === null || _a === void 0 ? void 0 : _a.toDate) === null || _b === void 0 ? void 0 : _b.call(_a)) || new Date(data.createdAt), data.status);
    }
    static toPersistence(entity) {
        const items = entity.items.map(i => ({
            itemId: i.itemId,
            name: i.name,
            qty: i.qty,
            price: i.price,
            discount: i.discount
        }));
        return {
            id: entity.id,
            companyId: entity.companyId,
            shiftId: entity.shiftId,
            items: items,
            totalAmount: entity.totalAmount,
            createdAt: admin.firestore.Timestamp.fromDate(entity.createdAt),
            status: entity.status
        };
    }
}
exports.POSOrderMapper = POSOrderMapper;
//# sourceMappingURL=POSMappers.js.map