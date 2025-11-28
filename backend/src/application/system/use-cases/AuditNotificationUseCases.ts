
import { AuditLog } from '../../../domain/system/entities/AuditLog';
import { Notification } from '../../../domain/system/entities/Notification';
import { IAuditLogRepository, INotificationRepository } from '../../../repository/interfaces/system';

export class LogAuditActionUseCase {
  constructor(private auditRepo: IAuditLogRepository) {}

  async execute(data: { action: string; entityType: string; entityId: string; userId: string; meta?: any }): Promise<void> {
    const log = new AuditLog(
      `audit_${Date.now()}`,
      data.action,
      data.entityType,
      data.entityId,
      data.userId,
      new Date(),
      data.meta
    );
    await this.auditRepo.log(log);
  }
}

export class SendNotificationUseCase {
  constructor(private notifRepo: INotificationRepository) {}

  async execute(userId: string, companyId: string, type: 'INFO'|'WARNING', message: string): Promise<void> {
    const notif = new Notification(
      `notif_${Date.now()}`,
      userId,
      companyId,
      type,
      message,
      new Date(),
      false
    );
    await this.notifRepo.sendNotification(notif);
  }
}

export class MarkNotificationAsReadUseCase {
  constructor(private notifRepo: INotificationRepository) {}

  async execute(notificationId: string): Promise<void> {
    await this.notifRepo.markAsRead(notificationId);
  }
}
