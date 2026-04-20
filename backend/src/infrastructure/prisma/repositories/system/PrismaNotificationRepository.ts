import { PrismaClient } from '@prisma/client';
import { INotificationRepository } from '../../../../repository/interfaces/system/INotificationRepository';
import { Notification, NotificationType, NotificationCategory } from '../../../../domain/system/entities/Notification';

export class PrismaNotificationRepository implements INotificationRepository {
  constructor(private prisma: PrismaClient) {}

  private toDomain(data: any): Notification {
    return new Notification(
      data.id,
      data.companyId,
      data.type as NotificationType,
      data.category as NotificationCategory,
      data.title,
      data.message,
      data.createdAt,
      (data.recipientUserIds as string[]) || [],
      (data.readBy as string[]) || [],
      data.actionUrl || undefined,
      data.sourceModule || undefined,
      data.sourceEntityType || undefined,
      data.sourceEntityId || undefined,
      data.expiresAt || undefined
    );
  }

  async create(notification: Notification): Promise<void> {
    await this.prisma.notification.create({
      data: {
        id: notification.id,
        companyId: notification.companyId,
        type: notification.type,
        category: notification.category,
        title: notification.title,
        message: notification.message,
        recipientUserIds: notification.recipientUserIds as any,
        readBy: notification.readBy as any,
        actionUrl: notification.actionUrl || null,
        sourceModule: notification.sourceModule || null,
        sourceEntityType: notification.sourceEntityType || null,
        sourceEntityId: notification.sourceEntityId || null,
        expiresAt: notification.expiresAt || null,
      },
    });
  }

  async sendNotification(notification: Notification): Promise<void> {
    await this.create(notification);
  }

  async getUnreadForUser(companyId: string, userId: string): Promise<Notification[]> {
    const data = await this.prisma.notification.findMany({
      where: {
        companyId,
        recipientUserIds: { has: userId },
        NOT: { readBy: { has: userId } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return data.map((d) => this.toDomain(d));
  }

  async getUserNotifications(companyId: string, userId: string, limit?: number): Promise<Notification[]> {
    const data = await this.prisma.notification.findMany({
      where: {
        companyId,
        recipientUserIds: { has: userId },
      },
      orderBy: { createdAt: 'desc' },
      take: limit || 50,
    });
    return data.map((d) => this.toDomain(d));
  }

  async markAsReadByUser(notificationId: string, userId: string): Promise<void> {
    await this.prisma.notification.update({
      where: { id: notificationId },
      data: {
        readBy: { push: userId } as any,
      },
    });
  }

  async markAllAsReadByUser(companyId: string, userId: string): Promise<void> {
    const notifications = await this.prisma.notification.findMany({
      where: {
        companyId,
        recipientUserIds: { has: userId },
        NOT: { readBy: { has: userId } },
      },
      select: { id: true },
    });
    for (const n of notifications) {
      await this.prisma.notification.update({
        where: { id: n.id },
        data: {
          readBy: { push: userId } as any,
        },
      });
    }
  }

  async markAsRead(notificationId: string): Promise<void> {
    await this.prisma.notification.update({
      where: { id: notificationId },
      data: {
        readBy: { push: '_legacy' } as any,
      },
    });
  }

  async getUnreadCount(companyId: string, userId: string): Promise<number> {
    const count = await this.prisma.notification.count({
      where: {
        companyId,
        recipientUserIds: { has: userId },
        NOT: { readBy: { has: userId } },
      },
    });
    return count;
  }

  async deleteExpired(companyId: string): Promise<number> {
    const result = await this.prisma.notification.deleteMany({
      where: {
        companyId,
        expiresAt: { lt: new Date() },
      },
    });
    return result.count;
  }
}
