"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CloseAttendanceRecordUseCase = exports.RecordAttendanceUseCase = void 0;
const AttendanceRecord_1 = require("../../../domain/hr/entities/AttendanceRecord");
class RecordAttendanceUseCase {
    constructor(repo) {
        this.repo = repo;
    }
    async execute(data) {
        const record = new AttendanceRecord_1.AttendanceRecord(`att_${Date.now()}`, data.employeeId, data.companyId, new Date(), data.method, undefined, data.location);
        await this.repo.logAttendance(record);
    }
}
exports.RecordAttendanceUseCase = RecordAttendanceUseCase;
class CloseAttendanceRecordUseCase {
    constructor(repo) {
        this.repo = repo;
    }
    async execute(recordId) {
        await this.repo.closeAttendance(recordId, new Date());
    }
}
exports.CloseAttendanceRecordUseCase = CloseAttendanceRecordUseCase;
//# sourceMappingURL=AttendanceUseCases.js.map