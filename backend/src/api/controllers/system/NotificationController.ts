import { Request, Response } from 'express';
import { diContainer } from '../../../infrastructure/di/bindRepositories';

/**
 * Notification Controller
 * 
 * Handles API requests for user notifications.
 */
export class NotificationController {
  /**
   * GET /notifications
   * Get notifications for the current user
   */
  static async getUserNotifications(req: Request, res: Response): Promise<void> {
    try {
      const companyId = (req as any).companyId;
      const userId = (req as any).user?.uid;
      const limit = parseInt(req.query.limit as string) || 20;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const notifications = await diContainer.notificationService.getUserNotifications(
        companyId,
        userId,
        limit
      );

      res.json({
        notifications: notifications.map(n => n.toJSON()),
        total: notifications.length
      });
    } catch (error: any) {
      console.error('[NotificationController] getUserNotifications error:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch notifications' });
    }
  }

  /**
   * GET /notifications/unread
   * Get unread notifications for the current user
   */
  static async getUnreadNotifications(req: Request, res: Response): Promise<void> {
    try {
      const companyId = (req as any).companyId;
      const userId = (req as any).user?.uid;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const notifications = await diContainer.notificationService.getUnreadForUser(
        companyId,
        userId
      );

      res.json({
        notifications: notifications.map(n => n.toJSON()),
        total: notifications.length
      });
    } catch (error: any) {
      console.error('[NotificationController] getUnreadNotifications error:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch unread notifications' });
    }
  }

  /**
   * GET /notifications/count
   * Get unread count for the current user
   */
  static async getUnreadCount(req: Request, res: Response): Promise<void> {
    try {
      const companyId = (req as any).companyId;
      const userId = (req as any).user?.uid;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const count = await diContainer.notificationService.getUnreadCount(companyId, userId);

      res.json({ count });
    } catch (error: any) {
      console.error('[NotificationController] getUnreadCount error:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch unread count' });
    }
  }

  /**
   * POST /notifications/:id/read
   * Mark a notification as read
   */
  static async markAsRead(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.uid;
      const notificationId = req.params.id;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      await diContainer.notificationService.markAsRead(notificationId, userId);

      res.json({ success: true });
    } catch (error: any) {
      console.error('[NotificationController] markAsRead error:', error);
      res.status(500).json({ error: error.message || 'Failed to mark notification as read' });
    }
  }
}
