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
exports.FirestoreAuditLogRepository = exports.FirestoreNotificationRepository = exports.FirestorePermissionRepository = exports.FirestoreRoleRepository = exports.FirestoreModuleRepository = void 0;
const BaseFirestoreRepository_1 = require("../BaseFirestoreRepository");
const SystemMappers_1 = require("../../mappers/SystemMappers");
const admin = __importStar(require("firebase-admin"));
void admin;
class FirestoreModuleRepository extends BaseFirestoreRepository_1.BaseFirestoreRepository {
    constructor() {
        super(...arguments);
        this.collectionName = 'modules';
        this.toDomain = SystemMappers_1.ModuleMapper.toDomain;
        this.toPersistence = SystemMappers_1.ModuleMapper.toPersistence;
    }
    async findAll() {
        const snapshot = await this.db.collection(this.collectionName).get();
        return snapshot.docs.map(doc => this.toDomain(doc.data()));
    }
    async getEnabledModules(companyId) {
        const snapshot = await this.db.collection(this.collectionName).where('enabled', '==', true).get();
        return snapshot.docs.map(doc => this.toDomain(doc.data()));
    }
    async enableModule(companyId, moduleName) {
        // Simplified logic
    }
    async disableModule(companyId, moduleName) {
        // Simplified logic
    }
}
exports.FirestoreModuleRepository = FirestoreModuleRepository;
class FirestoreRoleRepository extends BaseFirestoreRepository_1.BaseFirestoreRepository {
    constructor() {
        super(...arguments);
        this.collectionName = 'roles';
        this.toDomain = SystemMappers_1.RoleMapper.toDomain;
        this.toPersistence = SystemMappers_1.RoleMapper.toPersistence;
    }
    async createRole(companyId, role) {
        return this.save(role);
    }
    async updateRole(roleId, data) {
        await this.db.collection(this.collectionName).doc(roleId).update(data);
    }
    async getRole(roleId) {
        return this.findById(roleId);
    }
    async getCompanyRoles(companyId) {
        const snapshot = await this.db.collection(this.collectionName).where('companyId', '==', companyId).get();
        return snapshot.docs.map(doc => this.toDomain(doc.data()));
    }
    async listSystemRoleTemplates() {
        const snapshot = await this.db.collection(this.collectionName).get();
        return snapshot.docs.map(doc => this.toDomain(doc.data()));
    }
}
exports.FirestoreRoleRepository = FirestoreRoleRepository;
class FirestorePermissionRepository extends BaseFirestoreRepository_1.BaseFirestoreRepository {
    constructor() {
        super(...arguments);
        this.collectionName = 'permissions';
        this.toDomain = SystemMappers_1.PermissionMapper.toDomain;
        this.toPersistence = SystemMappers_1.PermissionMapper.toPersistence;
    }
    async getPermissionsByRole(roleId) {
        return []; // MVP: Permissions typically stored on Role
    }
    async assignPermissions(roleId, permissions) {
        // MVP: Update Role document
    }
}
exports.FirestorePermissionRepository = FirestorePermissionRepository;
class FirestoreNotificationRepository extends BaseFirestoreRepository_1.BaseFirestoreRepository {
    constructor() {
        super(...arguments);
        this.collectionName = 'notifications';
        this.toDomain = SystemMappers_1.NotificationMapper.toDomain;
        this.toPersistence = SystemMappers_1.NotificationMapper.toPersistence;
    }
    /**
     * Create a notification for multiple recipients
     */
    async create(notification) {
        return this.save(notification);
    }
    /**
     * Legacy method - backward compat
     */
    async sendNotification(notification) {
        return this.save(notification);
    }
    /**
     * Get unread notifications for a specific user
     */
    async getUnreadForUser(companyId, userId) {
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
    async getUserNotifications(companyId, userId, limit = 20) {
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
    async markAsReadByUser(notificationId, userId) {
        const docRef = this.db.collection(this.collectionName).doc(notificationId);
        await docRef.update({
            readBy: admin.firestore.FieldValue.arrayUnion(userId)
        });
    }
    /**
     * Legacy method - backward compat
     */
    async markAsRead(notificationId) {
        await this.db.collection(this.collectionName).doc(notificationId).update({ read: true });
    }
    /**
     * Get unread count for a user
     */
    async getUnreadCount(companyId, userId) {
        const unread = await this.getUnreadForUser(companyId, userId);
        return unread.length;
    }
    /**
     * Delete expired notifications (cleanup job)
     */
    async deleteExpired(companyId) {
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
exports.FirestoreNotificationRepository = FirestoreNotificationRepository;
class FirestoreAuditLogRepository extends BaseFirestoreRepository_1.BaseFirestoreRepository {
    constructor() {
        super(...arguments);
        this.collectionName = 'audit_logs';
        this.toDomain = SystemMappers_1.AuditLogMapper.toDomain;
        this.toPersistence = SystemMappers_1.AuditLogMapper.toPersistence;
    }
    async log(entry) {
        return this.save(entry);
    }
    async getLogs(companyId, filters) {
        const snapshot = await this.db.collection(this.collectionName).limit(50).get();
        return snapshot.docs.map(doc => this.toDomain(doc.data()));
    }
}
exports.FirestoreAuditLogRepository = FirestoreAuditLogRepository;
//# sourceMappingURL=FirestoreSystemRepositories.js.map