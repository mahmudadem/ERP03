
import * as admin from 'firebase-admin';
import { Module } from '../../../domain/system/entities/Module';
import { Role } from '../../../domain/system/entities/Role';
import { Permission } from '../../../domain/system/entities/Permission';
import { Notification } from '../../../domain/system/entities/Notification';
import { AuditLog } from '../../../domain/system/entities/AuditLog';

export class ModuleMapper {
  static toDomain(data: any): Module {
    return new Module(data.id, data.name, data.enabled);
  }
  static toPersistence(entity: Module): any {
    return { id: entity.id, name: entity.name, enabled: entity.enabled };
  }
}

export class RoleMapper {
  static toDomain(data: any): Role {
    return new Role(
      data.id,
      data.name,
      data.permissions || [],
      data.moduleBundles || [],
      data.explicitPermissions || [],
      data.resolvedPermissions || []
    );
  }
  static toPersistence(entity: Role): any {
    return {
      id: entity.id,
      name: entity.name,
      permissions: entity.permissions,
      moduleBundles: (entity as any).moduleBundles || [],
      explicitPermissions: (entity as any).explicitPermissions || [],
      resolvedPermissions: (entity as any).resolvedPermissions || [],
    };
  }
}

export class PermissionMapper {
  static toDomain(data: any): Permission {
    return new Permission(data.id, data.code, data.description);
  }
  static toPersistence(entity: Permission): any {
    return { id: entity.id, code: entity.code, description: entity.description };
  }
}

export class NotificationMapper {
  static toDomain(data: any): Notification {
    return new Notification(
      data.id,
      data.companyId,
      data.type || 'INFO',
      data.category || 'SYSTEM',
      data.title || '',
      data.message,
      data.createdAt?.toDate?.() || new Date(data.createdAt),
      data.recipientUserIds || [data.userId], // Backward compat
      data.readBy || (data.read ? [data.userId] : []),
      data.actionUrl,
      data.sourceModule,
      data.sourceEntityType,
      data.sourceEntityId,
      data.expiresAt?.toDate?.() || (data.expiresAt ? new Date(data.expiresAt) : undefined)
    );
  }
  static toPersistence(entity: Notification): any {
    return {
      id: entity.id,
      companyId: entity.companyId,
      type: entity.type,
      category: entity.category,
      title: entity.title,
      message: entity.message,
      createdAt: admin.firestore.Timestamp.fromDate(entity.createdAt),
      recipientUserIds: entity.recipientUserIds,
      readBy: entity.readBy,
      actionUrl: entity.actionUrl || null,
      sourceModule: entity.sourceModule || null,
      sourceEntityType: entity.sourceEntityType || null,
      sourceEntityId: entity.sourceEntityId || null,
      expiresAt: entity.expiresAt ? admin.firestore.Timestamp.fromDate(entity.expiresAt) : null
    };
  }
}

export class AuditLogMapper {
  static toDomain(data: any): AuditLog {
    return new AuditLog(
      data.id,
      data.action,
      data.entityType,
      data.entityId,
      data.userId,
      data.timestamp?.toDate?.() || new Date(data.timestamp),
      data.meta
    );
  }
  static toPersistence(entity: AuditLog): any {
    return {
      id: entity.id,
      action: entity.action,
      entityType: entity.entityType,
      entityId: entity.entityId,
      userId: entity.userId,
      timestamp: admin.firestore.Timestamp.fromDate(entity.timestamp),
      meta: entity.meta || null
    };
  }
}
