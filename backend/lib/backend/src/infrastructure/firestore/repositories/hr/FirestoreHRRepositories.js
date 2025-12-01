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
exports.FirestoreAttendanceRepository = exports.FirestoreEmployeeRepository = void 0;
const BaseFirestoreRepository_1 = require("../BaseFirestoreRepository");
const HRMappers_1 = require("../../mappers/HRMappers");
const admin = __importStar(require("firebase-admin"));
class FirestoreEmployeeRepository extends BaseFirestoreRepository_1.BaseFirestoreRepository {
    constructor() {
        super(...arguments);
        this.collectionName = 'employees';
        this.toDomain = HRMappers_1.EmployeeMapper.toDomain;
        this.toPersistence = HRMappers_1.EmployeeMapper.toPersistence;
    }
    async createEmployee(e) { return this.save(e); }
    async updateEmployee(id, data) { await this.db.collection(this.collectionName).doc(id).update(data); }
    async getEmployee(id) { return this.findById(id); }
    async getCompanyEmployees(companyId) {
        const snap = await this.db.collection(this.collectionName).where('companyId', '==', companyId).get();
        return snap.docs.map(d => this.toDomain(d.data()));
    }
}
exports.FirestoreEmployeeRepository = FirestoreEmployeeRepository;
class FirestoreAttendanceRepository extends BaseFirestoreRepository_1.BaseFirestoreRepository {
    constructor() {
        super(...arguments);
        this.collectionName = 'attendance';
        this.toDomain = HRMappers_1.AttendanceMapper.toDomain;
        this.toPersistence = HRMappers_1.AttendanceMapper.toPersistence;
    }
    async logAttendance(r) { return this.save(r); }
    async closeAttendance(id, logoutAt) {
        await this.db.collection(this.collectionName).doc(id).update({
            logoutAt: admin.firestore.Timestamp.fromDate(logoutAt)
        });
    }
    async getEmployeeAttendance(employeeId) {
        const snap = await this.db.collection(this.collectionName).where('employeeId', '==', employeeId).get();
        return snap.docs.map(d => this.toDomain(d.data()));
    }
}
exports.FirestoreAttendanceRepository = FirestoreAttendanceRepository;
//# sourceMappingURL=FirestoreHRRepositories.js.map