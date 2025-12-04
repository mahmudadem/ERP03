
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
    // In MVP, this might just query a modules collection or company.modules
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

  async sendNotification(notification: Notification): Promise<void> {
    return this.save(notification);
  }
  async getUserNotifications(userId: string): Promise<Notification[]> {
    const snapshot = await this.db.collection(this.collectionName).where('userId', '==', userId).get();
    return snapshot.docs.map(doc => this.toDomain(doc.data()));
  }
  async markAsRead(notificationId: string): Promise<void> {
    await this.db.collection(this.collectionName).doc(notificationId).update({ read: true });
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
    // Basic query
    const snapshot = await this.db.collection(this.collectionName).limit(50).get();
    return snapshot.docs.map(doc => this.toDomain(doc.data()));
  }
}
