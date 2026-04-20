"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaAttendanceRepository = void 0;
const AttendanceRecord_1 = require("../../../../domain/hr/entities/AttendanceRecord");
class PrismaAttendanceRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async logAttendance(record) {
        await this.prisma.attendance.create({
            data: {
                id: record.id,
                employeeId: record.employeeId,
                companyId: record.companyId,
                loginAt: record.loginAt,
                method: record.method,
                location: record.location,
                date: record.loginAt,
            },
        });
    }
    async closeAttendance(recordId, logoutAt) {
        await this.prisma.attendance.update({
            where: { id: recordId },
            data: { logoutAt },
        });
    }
    async getEmployeeAttendance(employeeId) {
        const records = await this.prisma.attendance.findMany({
            where: { employeeId },
            orderBy: { loginAt: 'desc' },
        });
        return records.map((r) => this.toDomain(r));
    }
    toDomain(record) {
        var _a, _b;
        return new AttendanceRecord_1.AttendanceRecord(record.id, record.employeeId, record.companyId, record.loginAt, record.method, (_a = record.logoutAt) !== null && _a !== void 0 ? _a : undefined, (_b = record.location) !== null && _b !== void 0 ? _b : undefined);
    }
}
exports.PrismaAttendanceRepository = PrismaAttendanceRepository;
//# sourceMappingURL=PrismaAttendanceRepository.js.map