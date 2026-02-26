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
    constructor(notificationRepository, realtimeDispatcher, userPreferencesRepository, companySettingsRepository) {
        this.notificationRepository = notificationRepository;
        this.realtimeDispatcher = realtimeDispatcher;
        this.userPreferencesRepository = userPreferencesRepository;
        this.companySettingsRepository = companySettingsRepository;
    }
    /**
     * Create and dispatch a notification to multiple users
     */
    async notify(options) {
        var _a, _b;
        // Filter recipients based on company defaults + user overrides.
        let finalRecipients = options.recipientUserIds;
        if (this.userPreferencesRepository || this.companySettingsRepository) {
            let companyDisabledCategories = new Set();
            if (this.companySettingsRepository) {
                try {
                    const companySettings = await this.companySettingsRepository.getSettings(options.companyId);
                    companyDisabledCategories = new Set((companySettings === null || companySettings === void 0 ? void 0 : companySettings.disabledNotificationCategories) || []);
                }
                catch (error) {
                    // Ignore and fallback to fully enabled company defaults
                }
            }
            const filtered = [];
            for (const userId of options.recipientUserIds) {
                // Base state from company-level default
                let isEnabled = !companyDisabledCategories.has(options.category);
                try {
                    const prefs = this.userPreferencesRepository
                        ? await this.userPreferencesRepository.getByUserId(userId)
                        : null;
                    const explicitOverride = (_a = prefs === null || prefs === void 0 ? void 0 : prefs.notificationCategoryOverrides) === null || _a === void 0 ? void 0 : _a[options.category];
                    if (typeof explicitOverride === 'boolean') {
                        // User override has highest priority (true = force enable, false = force disable)
                        isEnabled = explicitOverride;
                    }
                    else if ((_b = prefs === null || prefs === void 0 ? void 0 : prefs.disabledNotificationCategories) === null || _b === void 0 ? void 0 : _b.includes(options.category)) {
                        // Backward compatibility: legacy per-user opt-out list
                        isEnabled = false;
                    }
                }
                catch (error) {
                    // ignore error, keep current state
                }
                if (!isEnabled) {
                    continue;
                }
                filtered.push(userId);
            }
            finalRecipients = filtered;
        }
        if (finalRecipients.length === 0) {
            return null;
        }
        const notification = new Notification_1.Notification((0, uuid_1.v4)(), options.companyId, options.type, options.category, options.title, options.message, new Date(), finalRecipients, [], // readBy starts empty
        options.actionUrl, options.sourceModule, options.sourceEntityType, options.sourceEntityId, options.expiresInDays
            ? new Date(Date.now() + options.expiresInDays * 24 * 60 * 60 * 1000)
            : undefined);
        // 1. Persist to Firestore
        await this.notificationRepository.create(notification);
        // 2. Push via Realtime DB for instant delivery
        await this.realtimeDispatcher.pushToMany(options.companyId, finalRecipients, notification);
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
            actionUrl: `/accounting/vouchers/${voucherId}/view`,
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
     * Mark all notifications as read by user
     */
    async markAllAsRead(companyId, userId) {
        return this.notificationRepository.markAllAsReadByUser(companyId, userId);
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