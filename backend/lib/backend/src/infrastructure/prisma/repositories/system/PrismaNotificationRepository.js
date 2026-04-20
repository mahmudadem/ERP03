"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaNotificationRepository = void 0;
const Notification_1 = require("../../../../domain/system/entities/Notification");
class PrismaNotificationRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    toDomain(data) {
        return new Notification_1.Notification(data.id, data.companyId, data.type, data.category, data.title, data.message, data.createdAt, data.recipientUserIds || [], data.readBy || [], data.actionUrl || undefined, data.sourceModule || undefined, data.sourceEntityType || undefined, data.sourceEntityId || undefined, data.expiresAt || undefined);
    }
    async create(notification) {
        await this.prisma.notification.create({
            data: {
                id: notification.id,
                companyId: notification.companyId,
                type: notification.type,
                category: notification.category,
                title: notification.title,
                message: notification.message,
                recipientUserIds: notification.recipientUserIds,
                readBy: notification.readBy,
                actionUrl: notification.actionUrl || null,
                sourceModule: notification.sourceModule || null,
                sourceEntityType: notification.sourceEntityType || null,
                sourceEntityId: notification.sourceEntityId || null,
                expiresAt: notification.expiresAt || null,
            },
        });
    }
    async sendNotification(notification) {
        await this.create(notification);
    }
    async getUnreadForUser(companyId, userId) {
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
    async getUserNotifications(companyId, userId, limit) {
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
    async markAsReadByUser(notificationId, userId) {
        await this.prisma.notification.update({
            where: { id: notificationId },
            data: {
                readBy: { push: userId },
            },
        });
    }
    async markAllAsReadByUser(companyId, userId) {
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
                    readBy: { push: userId },
                },
            });
        }
    }
    async markAsRead(notificationId) {
        await this.prisma.notification.update({
            where: { id: notificationId },
            data: {
                readBy: { push: '_legacy' },
            },
        });
    }
    async getUnreadCount(companyId, userId) {
        const count = await this.prisma.notification.count({
            where: {
                companyId,
                recipientUserIds: { has: userId },
                NOT: { readBy: { has: userId } },
            },
        });
        return count;
    }
    async deleteExpired(companyId) {
        const result = await this.prisma.notification.deleteMany({
            where: {
                companyId,
                expiresAt: { lt: new Date() },
            },
        });
        return result.count;
    }
}
exports.PrismaNotificationRepository = PrismaNotificationRepository;
//# sourceMappingURL=PrismaNotificationRepository.js.map