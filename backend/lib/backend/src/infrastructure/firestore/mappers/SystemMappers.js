"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditLogMapper = exports.NotificationMapper = exports.PermissionMapper = exports.RoleMapper = exports.ModuleMapper = void 0;
const admin = __importStar(require("firebase-admin"));
const Module_1 = require("../../../domain/system/entities/Module");
const Role_1 = require("../../../domain/system/entities/Role");
const Permission_1 = require("../../../domain/system/entities/Permission");
const Notification_1 = require("../../../domain/system/entities/Notification");
const AuditLog_1 = require("../../../domain/system/entities/AuditLog");
class ModuleMapper {
    static toDomain(data) {
        return new Module_1.Module(data.id, data.name, data.enabled);
    }
    static toPersistence(entity) {
        return { id: entity.id, name: entity.name, enabled: entity.enabled };
    }
}
exports.ModuleMapper = ModuleMapper;
class RoleMapper {
    static toDomain(data) {
        return new Role_1.Role(data.id, data.name, data.permissions || [], data.moduleBundles || [], data.explicitPermissions || [], data.resolvedPermissions || []);
    }
    static toPersistence(entity) {
        return {
            id: entity.id,
            name: entity.name,
            permissions: entity.permissions,
            moduleBundles: entity.moduleBundles || [],
            explicitPermissions: entity.explicitPermissions || [],
            resolvedPermissions: entity.resolvedPermissions || [],
        };
    }
}
exports.RoleMapper = RoleMapper;
class PermissionMapper {
    static toDomain(data) {
        return new Permission_1.Permission(data.id, data.code, data.description);
    }
    static toPersistence(entity) {
        return { id: entity.id, code: entity.code, description: entity.description };
    }
}
exports.PermissionMapper = PermissionMapper;
class NotificationMapper {
    static toDomain(data) {
        var _a, _b, _c, _d;
        return new Notification_1.Notification(data.id, data.companyId, data.type || 'INFO', data.category || 'SYSTEM', data.title || '', data.message, ((_b = (_a = data.createdAt) === null || _a === void 0 ? void 0 : _a.toDate) === null || _b === void 0 ? void 0 : _b.call(_a)) || new Date(data.createdAt), data.recipientUserIds || [data.userId], // Backward compat
        data.readBy || (data.read ? [data.userId] : []), data.actionUrl, data.sourceModule, data.sourceEntityType, data.sourceEntityId, ((_d = (_c = data.expiresAt) === null || _c === void 0 ? void 0 : _c.toDate) === null || _d === void 0 ? void 0 : _d.call(_c)) || (data.expiresAt ? new Date(data.expiresAt) : undefined));
    }
    static toPersistence(entity) {
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
exports.NotificationMapper = NotificationMapper;
class AuditLogMapper {
    static toDomain(data) {
        var _a, _b;
        return new AuditLog_1.AuditLog(data.id, data.action, data.entityType, data.entityId, data.userId, ((_b = (_a = data.timestamp) === null || _a === void 0 ? void 0 : _a.toDate) === null || _b === void 0 ? void 0 : _b.call(_a)) || new Date(data.timestamp), data.meta);
    }
    static toPersistence(entity) {
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
exports.AuditLogMapper = AuditLogMapper;
//# sourceMappingURL=SystemMappers.js.map