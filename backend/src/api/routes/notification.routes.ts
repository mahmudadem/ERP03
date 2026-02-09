import { Router } from 'express';
import { NotificationController } from '../controllers/system/NotificationController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { companyContextMiddleware } from '../middlewares/companyContextMiddleware';

const router = Router();

// Apply auth and company context middlewares
router.use(authMiddleware);
router.use(companyContextMiddleware);

// Notification endpoints
router.get('/notifications', NotificationController.getUserNotifications);
router.get('/notifications/unread', NotificationController.getUnreadNotifications);
router.get('/notifications/count', NotificationController.getUnreadCount);
router.post('/notifications/:id/read', NotificationController.markAsRead);

export default router;
