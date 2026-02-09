
export type NotificationType = 'ACTION_REQUIRED' | 'INFO' | 'WARNING' | 'SUCCESS' | 'ERROR';
export type NotificationCategory = 'APPROVAL' | 'CUSTODY' | 'SYSTEM' | 'HR' | 'INVENTORY';

/**
 * Enhanced Notification Entity
 * 
 * System-wide, module-agnostic notification supporting multi-user dispatch.
 * Designed for migration from Firebase to SQL.
 */
export class Notification {
  constructor(
    public readonly id: string,
    public readonly companyId: string,
    public readonly type: NotificationType,
    public readonly category: NotificationCategory,
    public readonly title: string,
    public readonly message: string,
    public readonly createdAt: Date,
    public readonly recipientUserIds: string[],      // Multi-user support
    public readonly readBy: string[] = [],           // Track who has read
    public readonly actionUrl?: string,              // Deep link
    public readonly sourceModule?: string,           // 'accounting', 'hr', etc.
    public readonly sourceEntityType?: string,       // 'voucher', 'employee', etc.
    public readonly sourceEntityId?: string,
    public readonly expiresAt?: Date
  ) {}

  /**
   * Check if a specific user has read this notification
   */
  public isReadByUser(userId: string): boolean {
    return this.readBy.includes(userId);
  }

  /**
   * Create a new notification with user marked as read
   */
  public markAsReadByUser(userId: string): Notification {
    if (this.readBy.includes(userId)) {
      return this;
    }
    return new Notification(
      this.id,
      this.companyId,
      this.type,
      this.category,
      this.title,
      this.message,
      this.createdAt,
      this.recipientUserIds,
      [...this.readBy, userId],
      this.actionUrl,
      this.sourceModule,
      this.sourceEntityType,
      this.sourceEntityId,
      this.expiresAt
    );
  }

  /**
   * Check if notification is expired
   */
  public isExpired(): boolean {
    if (!this.expiresAt) return false;
    return new Date() > this.expiresAt;
  }

  /**
   * Convert to plain object for persistence
   */
  public toJSON(): Record<string, any> {
    return {
      id: this.id,
      companyId: this.companyId,
      type: this.type,
      category: this.category,
      title: this.title,
      message: this.message,
      createdAt: this.createdAt.toISOString(),
      recipientUserIds: this.recipientUserIds,
      readBy: this.readBy,
      actionUrl: this.actionUrl,
      sourceModule: this.sourceModule,
      sourceEntityType: this.sourceEntityType,
      sourceEntityId: this.sourceEntityId,
      expiresAt: this.expiresAt?.toISOString()
    };
  }

  /**
   * Create from plain object
   */
  public static fromJSON(data: Record<string, any>): Notification {
    return new Notification(
      data.id,
      data.companyId,
      data.type,
      data.category,
      data.title,
      data.message,
      new Date(data.createdAt),
      data.recipientUserIds || [data.userId], // Backward compat
      data.readBy || (data.read ? [data.userId] : []),
      data.actionUrl,
      data.sourceModule,
      data.sourceEntityType,
      data.sourceEntityId,
      data.expiresAt ? new Date(data.expiresAt) : undefined
    );
  }
}
