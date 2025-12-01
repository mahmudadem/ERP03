"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditLog = void 0;
class AuditLog {
    constructor(id, action, entityType, entityId, userId, timestamp, meta) {
        this.id = id;
        this.action = action;
        this.entityType = entityType;
        this.entityId = entityId;
        this.userId = userId;
        this.timestamp = timestamp;
        this.meta = meta;
    }
}
exports.AuditLog = AuditLog;
//# sourceMappingURL=AuditLog.js.map