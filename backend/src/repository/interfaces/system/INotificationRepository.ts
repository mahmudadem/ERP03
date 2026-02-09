
import { Notification } from '../../../domain/system/entities/Notification';

/**
 * Interface for Notification persistence and retrieval.
 * 
 * Supports multi-user dispatch and per-user read tracking.
 * Designed for system-wide, module-agnostic notifications.
 */
export interface INotificationRepository {
  /**
   * Create a notification for multiple recipients
   */
  create(notification: Notification): Promise<void>;

  /**
   * Legacy method - create for single user (backward compat)
   * @deprecated Use create() with recipientUserIds
   */
  sendNotification(notification: Notification): Promise<void>;

  /**
   * Get unread notifications for a specific user
   */
  getUnreadForUser(companyId: string, userId: string): Promise<Notification[]>;

  /**
   * Get all notifications for a specific user (paginated)
   */
  getUserNotifications(companyId: string, userId: string, limit?: number): Promise<Notification[]>;

  /**
   * Mark notification as read by a specific user
   */
  markAsReadByUser(notificationId: string, userId: string): Promise<void>;

  /**
   * Legacy method - mark as read (backward compat)
   * @deprecated Use markAsReadByUser()
   */
  markAsRead(notificationId: string): Promise<void>;

  /**
   * Get unread count for a user
   */
  getUnreadCount(companyId: string, userId: string): Promise<number>;

  /**
   * Delete expired notifications (cleanup job)
   */
  deleteExpired(companyId: string): Promise<number>;
}
