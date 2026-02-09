import * as admin from 'firebase-admin';
import { IRealtimeDispatcher } from './IRealtimeDispatcher';
import { Notification } from '../../domain/system/entities/Notification';

/**
 * Firebase Realtime Database implementation of IRealtimeDispatcher.
 * 
 * Writes notifications to `/notifications/{companyId}/{userId}/{notificationId}`
 * Frontend listens to this path for real-time updates.
 */
export class FirebaseRealtimeDispatcher implements IRealtimeDispatcher {
  private rtdb: admin.database.Database;

  constructor() {
    this.rtdb = admin.database();
  }

  /**
   * Push a notification to a single user in real-time
   */
  async pushToUser(companyId: string, userId: string, notification: Notification): Promise<void> {
    const path = `notifications/${companyId}/${userId}/${notification.id}`;
    await this.rtdb.ref(path).set(notification.toJSON());
  }

  /**
   * Push a notification to multiple users in real-time
   */
  async pushToMany(companyId: string, userIds: string[], notification: Notification): Promise<void> {
    const updates: Record<string, any> = {};
    
    for (const userId of userIds) {
      const path = `notifications/${companyId}/${userId}/${notification.id}`;
      updates[path] = notification.toJSON();
    }

    await this.rtdb.ref().update(updates);
  }
}
