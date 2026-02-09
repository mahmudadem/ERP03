"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationController = void 0;
const bindRepositories_1 = require("../../../infrastructure/di/bindRepositories");
/**
 * Notification Controller
 *
 * Handles API requests for user notifications.
 */
class NotificationController {
    /**
     * GET /notifications
     * Get notifications for the current user
     */
    static async getUserNotifications(req, res) {
        var _a;
        try {
            const companyId = req.companyId;
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
            const limit = parseInt(req.query.limit) || 20;
            if (!userId) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }
            const notifications = await bindRepositories_1.diContainer.notificationService.getUserNotifications(companyId, userId, limit);
            res.json({
                notifications: notifications.map(n => n.toJSON()),
                total: notifications.length
            });
        }
        catch (error) {
            console.error('[NotificationController] getUserNotifications error:', error);
            res.status(500).json({ error: error.message || 'Failed to fetch notifications' });
        }
    }
    /**
     * GET /notifications/unread
     * Get unread notifications for the current user
     */
    static async getUnreadNotifications(req, res) {
        var _a;
        try {
            const companyId = req.companyId;
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
            if (!userId) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }
            const notifications = await bindRepositories_1.diContainer.notificationService.getUnreadForUser(companyId, userId);
            res.json({
                notifications: notifications.map(n => n.toJSON()),
                total: notifications.length
            });
        }
        catch (error) {
            console.error('[NotificationController] getUnreadNotifications error:', error);
            res.status(500).json({ error: error.message || 'Failed to fetch unread notifications' });
        }
    }
    /**
     * GET /notifications/count
     * Get unread count for the current user
     */
    static async getUnreadCount(req, res) {
        var _a;
        try {
            const companyId = req.companyId;
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
            if (!userId) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }
            const count = await bindRepositories_1.diContainer.notificationService.getUnreadCount(companyId, userId);
            res.json({ count });
        }
        catch (error) {
            console.error('[NotificationController] getUnreadCount error:', error);
            res.status(500).json({ error: error.message || 'Failed to fetch unread count' });
        }
    }
    /**
     * POST /notifications/:id/read
     * Mark a notification as read
     */
    static async markAsRead(req, res) {
        var _a;
        try {
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
            const notificationId = req.params.id;
            if (!userId) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }
            await bindRepositories_1.diContainer.notificationService.markAsRead(notificationId, userId);
            res.json({ success: true });
        }
        catch (error) {
            console.error('[NotificationController] markAsRead error:', error);
            res.status(500).json({ error: error.message || 'Failed to mark notification as read' });
        }
    }
}
exports.NotificationController = NotificationController;
//# sourceMappingURL=NotificationController.js.map