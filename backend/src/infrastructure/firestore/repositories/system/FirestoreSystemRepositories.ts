
import { BaseFirestoreRepository } from '../BaseFirestoreRepository';
import { IModuleRepository, IRoleRepository, IPermissionRepository, INotificationRepository, IAuditLogRepository } from '../../../../repository/interfaces/system';
import { Module } from '../../../../domain/system/entities/Module';
import { Role } from '../../../../domain/system/entities/Role';
import { Permission } from '../../../../domain/system/entities/Permission';
import { Notification } from '../../../../domain/system/entities/Notification';
import { AuditLog } from '../../../../domain/system/entities/AuditLog';
import { ModuleMapper, RoleMapper, PermissionMapper, NotificationMapper, AuditLogMapper } from '../../mappers/SystemMappers';
import * as admin from 'firebase-admin';
void admin;

export class FirestoreModuleRepository extends BaseFirestoreRepository<Module> implements IModuleRepository {
  protected collectionName = 'modules';
  protected toDomain = ModuleMapper.toDomain;
  protected toPersistence = ModuleMapper.toPersistence;

  async findAll(): Promise<Module[]> {
    const snapshot = await this.db.collection(this.collectionName).get();
    return snapshot.docs.map(doc => this.toDomain(doc.data()));
  }

  async getEnabledModules(companyId: string): Promise<Module[]> {
    const snapshot = await this.db.collection(this.collectionName).where('enabled', '==', true).get();
    return snapshot.docs.map(doc => this.toDomain(doc.data()));
  }
  async enableModule(companyId: string, moduleName: string): Promise<void> {
    // Simplified logic
  }
  async disableModule(companyId: string, moduleName: string): Promise<void> {
    // Simplified logic
  }
}

export class FirestoreRoleRepository extends BaseFirestoreRepository<Role> implements IRoleRepository {
  protected collectionName = 'roles';
  protected toDomain = RoleMapper.toDomain;
  protected toPersistence = RoleMapper.toPersistence;

  async createRole(companyId: string, role: Role): Promise<void> {
    return this.save(role);
  }
  async updateRole(roleId: string, data: Partial<Role>): Promise<void> {
    await this.db.collection(this.collectionName).doc(roleId).update(data);
  }
  async getRole(roleId: string): Promise<Role | null> {
    return this.findById(roleId);
  }
  async getCompanyRoles(companyId: string): Promise<Role[]> {
    const snapshot = await this.db.collection(this.collectionName).where('companyId', '==', companyId).get();
    return snapshot.docs.map(doc => this.toDomain(doc.data()));
  }
  async listSystemRoleTemplates?(): Promise<Role[]> {
    const snapshot = await this.db.collection(this.collectionName).get();
    return snapshot.docs.map(doc => this.toDomain(doc.data()));
  }
}

export class FirestorePermissionRepository extends BaseFirestoreRepository<Permission> implements IPermissionRepository {
  protected collectionName = 'permissions';
  protected toDomain = PermissionMapper.toDomain;
  protected toPersistence = PermissionMapper.toPersistence;

  async getPermissionsByRole(roleId: string): Promise<Permission[]> {
    return []; // MVP: Permissions typically stored on Role
  }
  async assignPermissions(roleId: string, permissions: string[]): Promise<void> {
    // MVP: Update Role document
  }
}

export class FirestoreNotificationRepository extends BaseFirestoreRepository<Notification> implements INotificationRepository {
  protected collectionName = 'notifications';
  protected toDomain = NotificationMapper.toDomain;
  protected toPersistence = NotificationMapper.toPersistence;

  /**
   * Create a notification for multiple recipients
   */
  async create(notification: Notification): Promise<void> {
    return this.save(notification);
  }

  /**
   * Legacy method - backward compat
   */
  async sendNotification(notification: Notification): Promise<void> {
    return this.save(notification);
  }

  /**
   * Get unread notifications for a specific user
   */
  async getUnreadForUser(companyId: string, userId: string): Promise<Notification[]> {
    const snapshot = await this.db.collection(this.collectionName)
      .where('companyId', '==', companyId)
      .where('recipientUserIds', 'array-contains', userId)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();
    
    return snapshot.docs
      .map(doc => this.toDomain(doc.data()))
      .filter(n => !n.isReadByUser(userId) && !n.isExpired());
  }

  /**
   * Get all notifications for a specific user (paginated)
   */
  async getUserNotifications(companyId: string, userId: string, limit: number = 20): Promise<Notification[]> {
    const snapshot = await this.db.collection(this.collectionName)
      .where('companyId', '==', companyId)
      .where('recipientUserIds', 'array-contains', userId)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();
    
    return snapshot.docs.map(doc => this.toDomain(doc.data()));
  }

  /**
   * Mark notification as read by a specific user
   */
  async markAsReadByUser(notificationId: string, userId: string): Promise<void> {
    const docRef = this.db.collection(this.collectionName).doc(notificationId);
    await docRef.update({
      readBy: admin.firestore.FieldValue.arrayUnion(userId)
    });
  }

  /**
   * Legacy method - backward compat
   */
  async markAsRead(notificationId: string): Promise<void> {
    await this.db.collection(this.collectionName).doc(notificationId).update({ read: true });
  }

  /**
   * Get unread count for a user
   */
  async getUnreadCount(companyId: string, userId: string): Promise<number> {
    const unread = await this.getUnreadForUser(companyId, userId);
    return unread.length;
  }

  /**
   * Delete expired notifications (cleanup job)
   */
  async deleteExpired(companyId: string): Promise<number> {
    const now = admin.firestore.Timestamp.now();
    const snapshot = await this.db.collection(this.collectionName)
      .where('companyId', '==', companyId)
      .where('expiresAt', '<', now)
      .get();
    
    const batch = this.db.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    
    return snapshot.size;
  }
}

export class FirestoreAuditLogRepository extends BaseFirestoreRepository<AuditLog> implements IAuditLogRepository {
  protected collectionName = 'audit_logs';
  protected toDomain = AuditLogMapper.toDomain;
  protected toPersistence = AuditLogMapper.toPersistence;

  async log(entry: AuditLog): Promise<void> {
    return this.save(entry);
  }
  async getLogs(companyId: string, filters?: any): Promise<AuditLog[]> {
    const snapshot = await this.db.collection(this.collectionName).limit(50).get();
    return snapshot.docs.map(doc => this.toDomain(doc.data()));
  }
}
