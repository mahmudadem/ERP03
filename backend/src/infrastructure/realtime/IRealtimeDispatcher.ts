import { Notification } from '../../domain/system/entities/Notification';

/**
 * Interface for real-time notification delivery.
 * 
 * Abstraction layer for push notifications.
 * Implementations:
 * - FirebaseRealtimeDispatcher (Firebase Realtime DB)
 * - WebSocketDispatcher (Socket.io - future)
 */
export interface IRealtimeDispatcher {
  /**
   * Push a notification to a single user in real-time
   */
  pushToUser(companyId: string, userId: string, notification: Notification): Promise<void>;

  /**
   * Push a notification to multiple users in real-time
   */
  pushToMany(companyId: string, userIds: string[], notification: Notification): Promise<void>;
}
