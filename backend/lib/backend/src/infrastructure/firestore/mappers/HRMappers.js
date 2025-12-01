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
exports.AttendanceMapper = exports.EmployeeMapper = void 0;
const admin = __importStar(require("firebase-admin"));
const Employee_1 = require("../../../domain/hr/entities/Employee");
const AttendanceRecord_1 = require("../../../domain/hr/entities/AttendanceRecord");
class EmployeeMapper {
    static toDomain(data) {
        return new Employee_1.Employee(data.id, data.companyId, data.name, data.phone, data.departmentId, data.active, data.position, data.email);
    }
    static toPersistence(entity) {
        return {
            id: entity.id,
            companyId: entity.companyId,
            name: entity.name,
            phone: entity.phone,
            departmentId: entity.departmentId,
            active: entity.active,
            position: entity.position || null,
            email: entity.email || null
        };
    }
}
exports.EmployeeMapper = EmployeeMapper;
class AttendanceMapper {
    static toDomain(data) {
        var _a, _b, _c, _d;
        return new AttendanceRecord_1.AttendanceRecord(data.id, data.employeeId, data.companyId, ((_b = (_a = data.loginAt) === null || _a === void 0 ? void 0 : _a.toDate) === null || _b === void 0 ? void 0 : _b.call(_a)) || new Date(data.loginAt), data.method, data.logoutAt ? (((_d = (_c = data.logoutAt) === null || _c === void 0 ? void 0 : _c.toDate) === null || _d === void 0 ? void 0 : _d.call(_c)) || new Date(data.logoutAt)) : undefined, data.location);
    }
    static toPersistence(entity) {
        return {
            id: entity.id,
            employeeId: entity.employeeId,
            companyId: entity.companyId,
            loginAt: admin.firestore.Timestamp.fromDate(entity.loginAt),
            method: entity.method,
            logoutAt: entity.logoutAt ? admin.firestore.Timestamp.fromDate(entity.logoutAt) : null,
            location: entity.location || null
        };
    }
}
exports.AttendanceMapper = AttendanceMapper;
//# sourceMappingURL=HRMappers.js.map