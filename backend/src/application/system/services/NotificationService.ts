import { v4 as uuidv4 } from 'uuid';
import { Notification, NotificationType, NotificationCategory } from '../../../domain/system/entities/Notification';
import { INotificationRepository } from '../../../repository/interfaces/system/INotificationRepository';
import { IRealtimeDispatcher } from '../../../infrastructure/realtime/IRealtimeDispatcher';

/**
 * Options for creating a notification
 */
export interface NotifyOptions {
  companyId: string;
  recipientUserIds: string[];
  type: NotificationType;
  category: NotificationCategory;
  title: string;
  message: string;
  actionUrl?: string;
  sourceModule?: string;
  sourceEntityType?: string;
  sourceEntityId?: string;
  expiresInDays?: number;
}

/**
 * Central Notification Service
 * 
 * System-wide, module-agnostic service for creating and dispatching notifications.
 * Uses repository for persistence and realtime dispatcher for push delivery.
 */
export class NotificationService {
  constructor(
    private readonly notificationRepository: INotificationRepository,
    private readonly realtimeDispatcher: IRealtimeDispatcher
  ) {}

  /**
   * Create and dispatch a notification to multiple users
   */
  async notify(options: NotifyOptions): Promise<Notification> {
    const notification = new Notification(
      uuidv4(),
      options.companyId,
      options.type,
      options.category,
      options.title,
      options.message,
      new Date(),
      options.recipientUserIds,
      [], // readBy starts empty
      options.actionUrl,
      options.sourceModule,
      options.sourceEntityType,
      options.sourceEntityId,
      options.expiresInDays 
        ? new Date(Date.now() + options.expiresInDays * 24 * 60 * 60 * 1000)
        : undefined
    );

    // 1. Persist to Firestore
    await this.notificationRepository.create(notification);

    // 2. Push via Realtime DB for instant delivery
    await this.realtimeDispatcher.pushToMany(
      options.companyId,
      options.recipientUserIds,
      notification
    );

    return notification;
  }

  /**
   * Convenience method: Notify about a voucher action required
   */
  async notifyVoucherAction(
    companyId: string,
    recipientUserIds: string[],
    voucherNo: string,
    voucherId: string,
    action: 'APPROVAL' | 'CUSTODY' | 'REJECTED' | 'APPROVED' | 'INFO'
  ): Promise<void> {
    const titles: Record<string, string> = {
      APPROVAL: 'Approval Required',
      CUSTODY: 'Custody Confirmation Required',
      REJECTED: 'Voucher Rejected',
      APPROVED: 'Voucher Approved',
      INFO: 'Voucher Submitted'
    };

    const messages: Record<string, string> = {
      APPROVAL: `Voucher ${voucherNo} requires your financial approval.`,
      CUSTODY: `Voucher ${voucherNo} requires your custody confirmation.`,
      REJECTED: `Voucher ${voucherNo} has been rejected.`,
      APPROVED: `Voucher ${voucherNo} has been approved and is ready for posting.`,
      INFO: `Voucher ${voucherNo} was submitted involving your account.`
    };

    const types: Record<string, NotificationType> = {
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
      actionUrl: `/accounting/vouchers/${voucherId}`,
      sourceModule: 'accounting',
      sourceEntityType: 'voucher',
      sourceEntityId: voucherId,
      expiresInDays: 30
    });
  }

  /**
   * Get unread notifications for a user
   */
  async getUnreadForUser(companyId: string, userId: string): Promise<Notification[]> {
    return this.notificationRepository.getUnreadForUser(companyId, userId);
  }

  /**
   * Get all notifications for a user
   */
  async getUserNotifications(companyId: string, userId: string, limit?: number): Promise<Notification[]> {
    return this.notificationRepository.getUserNotifications(companyId, userId, limit);
  }

  /**
   * Mark notification as read by user
   */
  async markAsRead(notificationId: string, userId: string): Promise<void> {
    return this.notificationRepository.markAsReadByUser(notificationId, userId);
  }

  /**
   * Get unread count for user
   */
  async getUnreadCount(companyId: string, userId: string): Promise<number> {
    return this.notificationRepository.getUnreadCount(companyId, userId);
  }
}
