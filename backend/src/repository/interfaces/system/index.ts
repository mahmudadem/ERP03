
import { Module } from '../../../domain/system/entities/Module';
import { Role } from '../../../domain/system/entities/Role';
import { Permission } from '../../../domain/system/entities/Permission';
import { Notification } from '../../../domain/system/entities/Notification';
import { AuditLog } from '../../../domain/system/entities/AuditLog';

/**
 * Interface for Module configuration access.
 */
export interface IModuleRepository {
  getEnabledModules(companyId: string): Promise<Module[]>;
  enableModule(companyId: string, moduleName: string): Promise<void>;
  disableModule(companyId: string, moduleName: string): Promise<void>;
}

/**
 * Interface for Role management access.
 */
export interface IRoleRepository {
  createRole(companyId: string, role: Role): Promise<void>;
  updateRole(roleId: string, data: Partial<Role>): Promise<void>;
  getRole(roleId: string): Promise<Role | null>;
  getCompanyRoles(companyId: string): Promise<Role[]>;
}

/**
 * Interface for Permission management access.
 */
export interface IPermissionRepository {
  getPermissionsByRole(roleId: string): Promise<Permission[]>;
  assignPermissions(roleId: string, permissions: string[]): Promise<void>;
}

/**
 * Interface for Notification delivery and retrieval.
 */
export interface INotificationRepository {
  sendNotification(notification: Notification): Promise<void>;
  getUserNotifications(userId: string): Promise<Notification[]>;
  markAsRead(notificationId: string): Promise<void>;
}

/**
 * Interface for Audit Logging.
 */
export interface IAuditLogRepository {
  log(entry: AuditLog): Promise<void>;
  getLogs(companyId: string, filters?: any): Promise<AuditLog[]>;
}
