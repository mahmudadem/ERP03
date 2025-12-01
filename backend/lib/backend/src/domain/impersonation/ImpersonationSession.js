"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImpersonationSession = void 0;
class ImpersonationSession {
    constructor(id, superAdminId, companyId, active, createdAt, endedAt) {
        this.id = id;
        this.superAdminId = superAdminId;
        this.companyId = companyId;
        this.active = active;
        this.createdAt = createdAt;
        this.endedAt = endedAt;
    }
}
exports.ImpersonationSession = ImpersonationSession;
//# sourceMappingURL=ImpersonationSession.js.map