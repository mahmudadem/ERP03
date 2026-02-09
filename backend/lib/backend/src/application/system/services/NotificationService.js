"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationService = void 0;
const uuid_1 = require("uuid");
const Notification_1 = require("../../../domain/system/entities/Notification");
/**
 * Central Notification Service
 *
 * System-wide, module-agnostic service for creating and dispatching notifications.
 * Uses repository for persistence and realtime dispatcher for push delivery.
 */
class NotificationService {
    constructor(notificationRepository, realtimeDispatcher) {
        this.notificationRepository = notificationRepository;
        this.realtimeDispatcher = realtimeDispatcher;
    }
    /**
     * Create and dispatch a notification to multiple users
     */
    async notify(options) {
        const notification = new Notification_1.Notification((0, uuid_1.v4)(), options.companyId, options.type, options.category, options.title, options.message, new Date(), options.recipientUserIds, [], // readBy starts empty
        options.actionUrl, options.sourceModule, options.sourceEntityType, options.sourceEntityId, options.expiresInDays
            ? new Date(Date.now() + options.expiresInDays * 24 * 60 * 60 * 1000)
            : undefined);
        // 1. Persist to Firestore
        await this.notificationRepository.create(notification);
        // 2. Push via Realtime DB for instant delivery
        await this.realtimeDispatcher.pushToMany(options.companyId, options.recipientUserIds, notification);
        return notification;
    }
    /**
     * Convenience method: Notify about a voucher action required
     */
    async notifyVoucherAction(companyId, recipientUserIds, voucherNo, voucherId, action) {
        const titles = {
            APPROVAL: 'Approval Required',
            CUSTODY: 'Custody Confirmation Required',
            REJECTED: 'Voucher Rejected',
            APPROVED: 'Voucher Approved',
            INFO: 'Voucher Submitted'
        };
        const messages = {
            APPROVAL: `Voucher ${voucherNo} requires your financial approval.`,
            CUSTODY: `Voucher ${voucherNo} requires your custody confirmation.`,
            REJECTED: `Voucher ${voucherNo} has been rejected.`,
            APPROVED: `Voucher ${voucherNo} has been approved and is ready for posting.`,
            INFO: `Voucher ${voucherNo} was submitted involving your account.`
        };
        const types = {
            APPROVAL: 'ACTION_REQUIRED',
            CUSTODY: 'ACTION_REQUIRED',
            REJECTED: 'WARNING',
            APPROVED: 'SUCCESS',
            INFO: 'INFO'
        };
        await this.notify({
            companyId,
            recipientUserIds,
            type: types[action],
            category: action === 'CUSTODY' ? 'CUSTODY' : action === 'INFO' ? 'SYSTEM' : 'APPROVAL',
            title: titles[action],
            message: messages[action],
            actionUrl: `/accounting/vouchers/${voucherId}`,
            sourceModule: 'accounting',
            sourceEntityType: 'voucher',
            sourceEntityId: voucherId,
            expiresInDays: 30
        });
    }
    /**
     * Get unread notifications for a user
     */
    async getUnreadForUser(companyId, userId) {
        return this.notificationRepository.getUnreadForUser(companyId, userId);
    }
    /**
     * Get all notifications for a user
     */
    async getUserNotifications(companyId, userId, limit) {
        return this.notificationRepository.getUserNotifications(companyId, userId, limit);
    }
    /**
     * Mark notification as read by user
     */
    async markAsRead(notificationId, userId) {
        return this.notificationRepository.markAsReadByUser(notificationId, userId);
    }
    /**
     * Get unread count for user
     */
    async getUnreadCount(companyId, userId) {
        return this.notificationRepository.getUnreadCount(companyId, userId);
    }
}
exports.NotificationService = NotificationService;
//# sourceMappingURL=NotificationService.js.map