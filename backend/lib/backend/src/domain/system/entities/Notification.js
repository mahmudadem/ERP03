"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Notification = void 0;
/**
 * Enhanced Notification Entity
 *
 * System-wide, module-agnostic notification supporting multi-user dispatch.
 * Designed for migration from Firebase to SQL.
 */
class Notification {
    constructor(id, companyId, type, category, title, message, createdAt, recipientUserIds, // Multi-user support
    readBy = [], // Track who has read
    actionUrl, // Deep link
    sourceModule, // 'accounting', 'hr', etc.
    sourceEntityType, // 'voucher', 'employee', etc.
    sourceEntityId, expiresAt) {
        this.id = id;
        this.companyId = companyId;
        this.type = type;
        this.category = category;
        this.title = title;
        this.message = message;
        this.createdAt = createdAt;
        this.recipientUserIds = recipientUserIds;
        this.readBy = readBy;
        this.actionUrl = actionUrl;
        this.sourceModule = sourceModule;
        this.sourceEntityType = sourceEntityType;
        this.sourceEntityId = sourceEntityId;
        this.expiresAt = expiresAt;
    }
    /**
     * Check if a specific user has read this notification
     */
    isReadByUser(userId) {
        return this.readBy.includes(userId);
    }
    /**
     * Create a new notification with user marked as read
     */
    markAsReadByUser(userId) {
        if (this.readBy.includes(userId)) {
            return this;
        }
        return new Notification(this.id, this.companyId, this.type, this.category, this.title, this.message, this.createdAt, this.recipientUserIds, [...this.readBy, userId], this.actionUrl, this.sourceModule, this.sourceEntityType, this.sourceEntityId, this.expiresAt);
    }
    /**
     * Check if notification is expired
     */
    isExpired() {
        if (!this.expiresAt)
            return false;
        return new Date() > this.expiresAt;
    }
    /**
     * Convert to plain object for persistence
     */
    toJSON() {
        var _a;
        return {
            id: this.id,
            companyId: this.companyId,
            type: this.type,
            category: this.category,
            title: this.title,
            message: this.message,
            createdAt: this.createdAt.toISOString(),
            recipientUserIds: this.recipientUserIds,
            readBy: this.readBy,
            actionUrl: this.actionUrl,
            sourceModule: this.sourceModule,
            sourceEntityType: this.sourceEntityType,
            sourceEntityId: this.sourceEntityId,
            expiresAt: (_a = this.expiresAt) === null || _a === void 0 ? void 0 : _a.toISOString()
        };
    }
    /**
     * Create from plain object
     */
    static fromJSON(data) {
        return new Notification(data.id, data.companyId, data.type, data.category, data.title, data.message, new Date(data.createdAt), data.recipientUserIds || [data.userId], // Backward compat
        data.readBy || (data.read ? [data.userId] : []), data.actionUrl, data.sourceModule, data.sourceEntityType, data.sourceEntityId, data.expiresAt ? new Date(data.expiresAt) : undefined);
    }
}
exports.Notification = Notification;
//# sourceMappingURL=Notification.js.map