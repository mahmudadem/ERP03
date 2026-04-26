"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaUserPreferencesRepository = void 0;
const UserPreferences_1 = require("../../../../domain/core/entities/UserPreferences");
class PrismaUserPreferencesRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    toDomain(data) {
        var _a;
        return new UserPreferences_1.UserPreferences(data.userId, data.language || 'en', data.uiMode || 'windows', data.theme || 'light', data.sidebarMode || 'classic', (_a = data.sidebarPinned) !== null && _a !== void 0 ? _a : true, data.appearanceSettings || {}, data.disabledNotificationCategories || [], data.notificationCategoryOverrides || {}, data.createdAt, data.updatedAt);
    }
    async getByUserId(userId) {
        const data = await this.prisma.userPreferences.findUnique({
            where: { userId },
        });
        if (!data)
            return null;
        return this.toDomain(data);
    }
    async upsert(userId, prefs) {
        const updateData = {};
        if (prefs.language !== undefined)
            updateData.language = prefs.language;
        if (prefs.uiMode !== undefined)
            updateData.uiMode = prefs.uiMode;
        if (prefs.theme !== undefined)
            updateData.theme = prefs.theme;
        if (prefs.sidebarMode !== undefined)
            updateData.sidebarMode = prefs.sidebarMode;
        if (prefs.sidebarPinned !== undefined)
            updateData.sidebarPinned = prefs.sidebarPinned;
        if (prefs.appearanceSettings !== undefined)
            updateData.appearanceSettings = prefs.appearanceSettings;
        if (prefs.disabledNotificationCategories !== undefined)
            updateData.disabledNotificationCategories = prefs.disabledNotificationCategories;
        if (prefs.notificationCategoryOverrides !== undefined)
            updateData.notificationCategoryOverrides = prefs.notificationCategoryOverrides;
        const data = await this.prisma.userPreferences.upsert({
            where: { userId },
            create: Object.assign({ userId }, updateData),
            update: updateData,
        });
        return this.toDomain(data);
    }
}
exports.PrismaUserPreferencesRepository = PrismaUserPreferencesRepository;
//# sourceMappingURL=PrismaUserPreferencesRepository.js.map