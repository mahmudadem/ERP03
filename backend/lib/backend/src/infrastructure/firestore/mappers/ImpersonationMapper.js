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
exports.ImpersonationMapper = void 0;
const admin = __importStar(require("firebase-admin"));
const ImpersonationSession_1 = require("../../../domain/impersonation/ImpersonationSession");
class ImpersonationMapper {
    static toDomain(data) {
        var _a, _b, _c, _d;
        return new ImpersonationSession_1.ImpersonationSession(data.id, data.superAdminId, data.companyId, data.active, ((_b = (_a = data.createdAt) === null || _a === void 0 ? void 0 : _a.toDate) === null || _b === void 0 ? void 0 : _b.call(_a)) || new Date(data.createdAt), ((_d = (_c = data.endedAt) === null || _c === void 0 ? void 0 : _c.toDate) === null || _d === void 0 ? void 0 : _d.call(_c)) || undefined);
    }
    static toPersistence(entity) {
        return {
            id: entity.id,
            superAdminId: entity.superAdminId,
            companyId: entity.companyId,
            active: entity.active,
            createdAt: admin.firestore.Timestamp.fromDate(entity.createdAt),
            endedAt: entity.endedAt ? admin.firestore.Timestamp.fromDate(entity.endedAt) : null
        };
    }
}
exports.ImpersonationMapper = ImpersonationMapper;
//# sourceMappingURL=ImpersonationMapper.js.map