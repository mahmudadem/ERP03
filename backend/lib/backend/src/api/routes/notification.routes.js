"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const NotificationController_1 = require("../controllers/system/NotificationController");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const companyContextMiddleware_1 = require("../middlewares/companyContextMiddleware");
const router = (0, express_1.Router)();
// Apply auth and company context middlewares
router.use(authMiddleware_1.authMiddleware);
router.use(companyContextMiddleware_1.companyContextMiddleware);
// Notification endpoints
router.get('/notifications', NotificationController_1.NotificationController.getUserNotifications);
router.get('/notifications/unread', NotificationController_1.NotificationController.getUnreadNotifications);
router.get('/notifications/count', NotificationController_1.NotificationController.getUnreadCount);
router.post('/notifications/read-all', NotificationController_1.NotificationController.markAllAsRead);
router.post('/notifications/test', NotificationController_1.NotificationController.createTest);
router.post('/notifications/:id/read', NotificationController_1.NotificationController.markAsRead);
exports.default = router;
//# sourceMappingURL=notification.routes.js.map