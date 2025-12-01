"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarkNotificationAsReadUseCase = exports.SendNotificationUseCase = exports.LogAuditActionUseCase = void 0;
const AuditLog_1 = require("../../../domain/system/entities/AuditLog");
const Notification_1 = require("../../../domain/system/entities/Notification");
class LogAuditActionUseCase {
    constructor(auditRepo) {
        this.auditRepo = auditRepo;
    }
    async execute(data) {
        const log = new AuditLog_1.AuditLog(`audit_${Date.now()}`, data.action, data.entityType, data.entityId, data.userId, new Date(), data.meta);
        await this.auditRepo.log(log);
    }
}
exports.LogAuditActionUseCase = LogAuditActionUseCase;
class SendNotificationUseCase {
    constructor(notifRepo) {
        this.notifRepo = notifRepo;
    }
    async execute(userId, companyId, type, message) {
        const notif = new Notification_1.Notification(`notif_${Date.now()}`, userId, companyId, type, message, new Date(), false);
        await this.notifRepo.sendNotification(notif);
    }
}
exports.SendNotificationUseCase = SendNotificationUseCase;
class MarkNotificationAsReadUseCase {
    constructor(notifRepo) {
        this.notifRepo = notifRepo;
    }
    async execute(notificationId) {
        await this.notifRepo.markAsRead(notificationId);
    }
}
exports.MarkNotificationAsReadUseCase = MarkNotificationAsReadUseCase;
//# sourceMappingURL=AuditNotificationUseCases.js.map