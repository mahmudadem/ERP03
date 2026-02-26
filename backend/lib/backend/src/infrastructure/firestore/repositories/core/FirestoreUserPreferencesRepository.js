"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirestoreUserPreferencesRepository = void 0;
const BaseFirestoreRepository_1 = require("../BaseFirestoreRepository");
const UserPreferences_1 = require("../../../../domain/core/entities/UserPreferences");
const InfrastructureError_1 = require("../../../errors/InfrastructureError");
class FirestoreUserPreferencesRepository extends BaseFirestoreRepository_1.BaseFirestoreRepository {
    constructor() {
        super(...arguments);
        this.collectionName = 'userPreferences';
    }
    toDomain(data) {
        var _a, _b, _c, _d;
        return new UserPreferences_1.UserPreferences(data.userId, data.language || 'en', data.uiMode || 'windows', data.theme || 'light', data.sidebarMode || 'classic', data.sidebarPinned !== undefined ? data.sidebarPinned : true, data.disabledNotificationCategories || [], data.notificationCategoryOverrides || {}, data.createdAt ? ((_b = (_a = data.createdAt).toDate) === null || _b === void 0 ? void 0 : _b.call(_a)) || data.createdAt : new Date(), data.updatedAt ? ((_d = (_c = data.updatedAt).toDate) === null || _d === void 0 ? void 0 : _d.call(_c)) || data.updatedAt : new Date());
    }
    toPersistence(entity) {
        return {
            userId: entity.userId,
            language: entity.language,
            uiMode: entity.uiMode,
            theme: entity.theme,
            sidebarMode: entity.sidebarMode,
            sidebarPinned: entity.sidebarPinned,
            disabledNotificationCategories: entity.disabledNotificationCategories,
            notificationCategoryOverrides: entity.notificationCategoryOverrides,
            createdAt: entity.createdAt,
            updatedAt: entity.updatedAt
        };
    }
    async getByUserId(userId) {
        const doc = await this.db.collection(this.collectionName).doc(userId).get();
        if (!doc.exists)
            return null;
        return this.toDomain(Object.assign({ userId }, doc.data()));
    }
    async upsert(userId, prefs) {
        try {
            const now = new Date();
            const payload = {
                updatedAt: now,
                userId,
            };
            // Firestore rejects undefined values unless ignoreUndefinedProperties is enabled.
            // Keep only explicitly provided preference keys.
            const allowedKeys = [
                'language',
                'uiMode',
                'theme',
                'sidebarMode',
                'sidebarPinned',
                'disabledNotificationCategories',
                'notificationCategoryOverrides',
                'createdAt',
            ];
            for (const key of allowedKeys) {
                const value = prefs === null || prefs === void 0 ? void 0 : prefs[key];
                if (value !== undefined) {
                    payload[key] = value;
                }
            }
            if (!payload.createdAt) {
                payload.createdAt = now;
            }
            await this.db.collection(this.collectionName).doc(userId).set(payload, { merge: true });
            const saved = await this.getByUserId(userId);
            if (!saved)
                throw new InfrastructureError_1.InfrastructureError('Failed to load saved preferences');
            return saved;
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Error saving user preferences', error);
        }
    }
}
exports.FirestoreUserPreferencesRepository = FirestoreUserPreferencesRepository;
//# sourceMappingURL=FirestoreUserPreferencesRepository.js.map