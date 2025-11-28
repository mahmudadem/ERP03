
import { Notification } from '../../../domain/system/entities/Notification';

/**
 * Interface for Notification delivery and retrieval.
 */
export interface INotificationRepository {
  sendNotification(notification: Notification): Promise<void>;
  getUserNotifications(userId: string): Promise<Notification[]>;
  markAsRead(notificationId: string): Promise<void>;
}
