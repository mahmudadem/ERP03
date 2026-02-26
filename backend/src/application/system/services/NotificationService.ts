import { v4 as uuidv4 } from 'uuid';
import { Notification, NotificationType, NotificationCategory } from '../../../domain/system/entities/Notification';
import { INotificationRepository } from '../../../repository/interfaces/system/INotificationRepository';
import { IRealtimeDispatcher } from '../../../infrastructure/realtime/IRealtimeDispatcher';
import { IUserPreferencesRepository } from '../../../repository/interfaces/core/IUserPreferencesRepository';
import { ICompanySettingsRepository } from '../../../repository/interfaces/core/ICompanySettingsRepository';

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
    private readonly realtimeDispatcher: IRealtimeDispatcher,
    private readonly userPreferencesRepository?: IUserPreferencesRepository,
    private readonly companySettingsRepository?: ICompanySettingsRepository
  ) {}

  /**
   * Create and dispatch a notification to multiple users
   */
  async notify(options: NotifyOptions): Promise<Notification | null> {
    // Filter recipients based on company defaults + user overrides.
    let finalRecipients = options.recipientUserIds;
    if (this.userPreferencesRepository || this.companySettingsRepository) {
      let companyDisabledCategories = new Set<string>();
      if (this.companySettingsRepository) {
        try {
          const companySettings = await this.companySettingsRepository.getSettings(options.companyId);
          companyDisabledCategories = new Set(companySettings?.disabledNotificationCategories || []);
        } catch (error) {
          // Ignore and fallback to fully enabled company defaults
        }
      }

      const filtered = [];
      for (const userId of options.recipientUserIds) {
        // Base state from company-level default
        let isEnabled = !companyDisabledCategories.has(options.category);

        try {
          const prefs = this.userPreferencesRepository
            ? await this.userPreferencesRepository.getByUserId(userId)
            : null;

          const explicitOverride = prefs?.notificationCategoryOverrides?.[options.category];
          if (typeof explicitOverride === 'boolean') {
            // User override has highest priority (true = force enable, false = force disable)
            isEnabled = explicitOverride;
          } else if (prefs?.disabledNotificationCategories?.includes(options.category)) {
            // Backward compatibility: legacy per-user opt-out list
            isEnabled = false;
          }
        } catch (error) {
          // ignore error, keep current state
        }

        if (!isEnabled) {
          continue;
        }

        filtered.push(userId);
      }
      finalRecipients = filtered;
    }

    if (finalRecipients.length === 0) {
      return null;
    }

    const notification = new Notification(
      uuidv4(),
      options.companyId,
      options.type,
      options.category,
      options.title,
      options.message,
      new Date(),
      finalRecipients,
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
      finalRecipients,
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
      actionUrl: `/accounting/vouchers/${voucherId}/view`,
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
   * Mark all notifications as read by user
   */
  async markAllAsRead(companyId: string, userId: string): Promise<void> {
    return this.notificationRepository.markAllAsReadByUser(companyId, userId);
  }

  /**
   * Get unread count for user
   */
  async getUnreadCount(companyId: string, userId: string): Promise<number> {
    return this.notificationRepository.getUnreadCount(companyId, userId);
  }
}
