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
/**
 * Legacy SendNotificationUseCase
 * @deprecated Use NotificationService instead for new code
 */
class SendNotificationUseCase {
    constructor(notifRepo) {
        this.notifRepo = notifRepo;
    }
    async execute(userId, companyId, type, message) {
        // Updated to match new Notification constructor
        const notif = new Notification_1.Notification(`notif_${Date.now()}`, companyId, type, 'SYSTEM', // category
        '', // title (empty for legacy)
        message, new Date(), [userId] // recipientUserIds
        );
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