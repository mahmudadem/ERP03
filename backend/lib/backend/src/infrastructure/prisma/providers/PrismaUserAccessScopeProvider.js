"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaUserAccessScopeProvider = void 0;
class PrismaUserAccessScopeProvider {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getScope(userId, companyId) {
        var _a, _b;
        try {
            const prefs = await this.prisma.userPreferences.findUnique({
                where: { userId },
            });
            if (!prefs) {
                return this.getDefaultScope();
            }
            const data = prefs;
            // Extract allowedUnitIds from notificationCategoryOverrides or other custom fields
            // Since the SQL schema doesn't have a dedicated allowedUnitIds field,
            // we store it in notificationCategoryOverrides as a JSON field
            const overrides = data.notificationCategoryOverrides;
            const allowedUnitIds = (_a = overrides === null || overrides === void 0 ? void 0 : overrides.allowedUnitIds) !== null && _a !== void 0 ? _a : [];
            const isSuper = (_b = overrides === null || overrides === void 0 ? void 0 : overrides.isSuper) !== null && _b !== void 0 ? _b : false;
            return {
                allowedUnitIds: Array.isArray(allowedUnitIds) ? allowedUnitIds : [],
                isSuper: !!isSuper
            };
        }
        catch (error) {
            console.error(`Failed to load user scope for ${userId}:`, error);
            // Fail safe: deny restricted access
            return this.getDefaultScope();
        }
    }
    getDefaultScope() {
        return {
            allowedUnitIds: [],
            isSuper: false
        };
    }
}
exports.PrismaUserAccessScopeProvider = PrismaUserAccessScopeProvider;
//# sourceMappingURL=PrismaUserAccessScopeProvider.js.map