"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AttendanceRecord = void 0;
class AttendanceRecord {
    constructor(id, employeeId, companyId, loginAt, method, logoutAt, location) {
        this.id = id;
        this.employeeId = employeeId;
        this.companyId = companyId;
        this.loginAt = loginAt;
        this.method = method;
        this.logoutAt = logoutAt;
        this.location = location;
    }
    getDurationHours() {
        if (!this.logoutAt)
            return 0;
        return (this.logoutAt.getTime() - this.loginAt.getTime()) / (1000 * 60 * 60);
    }
}
exports.AttendanceRecord = AttendanceRecord;
//# sourceMappingURL=AttendanceRecord.js.map