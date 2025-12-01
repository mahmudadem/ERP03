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
exports.CompanyUserMapper = exports.UserMapper = exports.CompanyMapper = void 0;
/**
 * CoreMappers.ts
 *
 * Purpose:
 * Transforms plain Firestore objects into rich Domain Entities and vice-versa.
 * Decouples the Domain layer from persistence details (e.g. Timestamp objects).
 */
const admin = __importStar(require("firebase-admin"));
const Company_1 = require("../../../domain/core/entities/Company");
const User_1 = require("../../../domain/core/entities/User");
const CompanyUser_1 = require("../../../domain/core/entities/CompanyUser");
class CompanyMapper {
    static toTimestamp(date) {
        var _a;
        if ((_a = admin === null || admin === void 0 ? void 0 : admin.firestore) === null || _a === void 0 ? void 0 : _a.Timestamp) {
            return admin.firestore.Timestamp.fromDate(date);
        }
        // Fallback to plain Date if Timestamp is unavailable
        return date;
    }
    static toDomain(data) {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        return new Company_1.Company(data.id, data.name, data.ownerId, ((_b = (_a = data.createdAt) === null || _a === void 0 ? void 0 : _a.toDate) === null || _b === void 0 ? void 0 : _b.call(_a)) || new Date(data.createdAt), ((_d = (_c = data.updatedAt) === null || _c === void 0 ? void 0 : _c.toDate) === null || _d === void 0 ? void 0 : _d.call(_c)) || new Date(data.updatedAt), data.baseCurrency, ((_f = (_e = data.fiscalYearStart) === null || _e === void 0 ? void 0 : _e.toDate) === null || _f === void 0 ? void 0 : _f.call(_e)) || new Date(data.fiscalYearStart), ((_h = (_g = data.fiscalYearEnd) === null || _g === void 0 ? void 0 : _g.toDate) === null || _h === void 0 ? void 0 : _h.call(_g)) || new Date(data.fiscalYearEnd), data.modules || [], data.taxId, data.address);
    }
    static toPersistence(entity) {
        return {
            id: entity.id,
            name: entity.name,
            ownerId: entity.ownerId,
            taxId: entity.taxId,
            address: entity.address || null,
            baseCurrency: entity.baseCurrency,
            fiscalYearStart: this.toTimestamp(entity.fiscalYearStart),
            fiscalYearEnd: this.toTimestamp(entity.fiscalYearEnd),
            modules: entity.modules,
            createdAt: this.toTimestamp(entity.createdAt),
            updatedAt: this.toTimestamp(entity.updatedAt),
        };
    }
}
exports.CompanyMapper = CompanyMapper;
class UserMapper {
    static toDomain(data) {
        var _a, _b;
        return new User_1.User(data.id, data.email, data.name, data.globalRole || data.role || 'USER', ((_b = (_a = data.createdAt) === null || _a === void 0 ? void 0 : _a.toDate) === null || _b === void 0 ? void 0 : _b.call(_a)) || new Date(data.createdAt), data.pictureUrl);
    }
    static toPersistence(entity) {
        return {
            id: entity.id,
            email: entity.email,
            name: entity.name,
            globalRole: entity.globalRole,
            createdAt: admin.firestore.Timestamp.fromDate(entity.createdAt),
            pictureUrl: entity.pictureUrl || null
        };
    }
}
exports.UserMapper = UserMapper;
class CompanyUserMapper {
    static toDomain(data) {
        return new CompanyUser_1.CompanyUser(data.id, data.userId, data.companyId, data.role, data.permissions || []);
    }
    static toPersistence(entity) {
        return {
            id: entity.id,
            userId: entity.userId,
            companyId: entity.companyId,
            role: entity.role,
            permissions: entity.permissions
        };
    }
}
exports.CompanyUserMapper = CompanyUserMapper;
//# sourceMappingURL=CoreMappers.js.map