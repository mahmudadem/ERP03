"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserPreferencesController = void 0;
const bindRepositories_1 = require("../../../infrastructure/di/bindRepositories");
const ApiError_1 = require("../../errors/ApiError");
const UserPreferencesUseCases_1 = require("../../../application/core/use-cases/UserPreferencesUseCases");
const mapDto = (prefs) => {
    var _a;
    return ({
        language: (prefs === null || prefs === void 0 ? void 0 : prefs.language) || 'en',
        uiMode: (prefs === null || prefs === void 0 ? void 0 : prefs.uiMode) || 'windows',
        theme: (prefs === null || prefs === void 0 ? void 0 : prefs.theme) || 'light',
        sidebarMode: (prefs === null || prefs === void 0 ? void 0 : prefs.sidebarMode) || 'classic',
        sidebarPinned: (_a = prefs === null || prefs === void 0 ? void 0 : prefs.sidebarPinned) !== null && _a !== void 0 ? _a : true,
        disabledNotificationCategories: (prefs === null || prefs === void 0 ? void 0 : prefs.disabledNotificationCategories) || [],
        notificationCategoryOverrides: (prefs === null || prefs === void 0 ? void 0 : prefs.notificationCategoryOverrides) || {},
        updatedAt: prefs === null || prefs === void 0 ? void 0 : prefs.updatedAt,
        createdAt: prefs === null || prefs === void 0 ? void 0 : prefs.createdAt,
    });
};
class UserPreferencesController {
    static async getMyPreferences(req, res, next) {
        var _a;
        try {
            const userId = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.uid) || req.userId;
            if (!userId)
                throw ApiError_1.ApiError.unauthorized('Missing user');
            const useCase = new UserPreferencesUseCases_1.GetUserPreferencesUseCase(bindRepositories_1.diContainer.userPreferencesRepository);
            const prefs = await useCase.execute(userId);
            res.status(200).json({ success: true, preferences: mapDto(prefs) });
        }
        catch (error) {
            next(error);
        }
    }
    static async upsertMyPreferences(req, res, next) {
        var _a;
        try {
            const userId = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.uid) || req.userId;
            if (!userId)
                throw ApiError_1.ApiError.unauthorized('Missing user');
            const { language, uiMode, theme, sidebarMode, sidebarPinned, disabledNotificationCategories, notificationCategoryOverrides } = req.body || {};
            const useCase = new UserPreferencesUseCases_1.UpsertUserPreferencesUseCase(bindRepositories_1.diContainer.userPreferencesRepository);
            const prefs = await useCase.execute(userId, {
                language,
                uiMode,
                theme,
                sidebarMode,
                sidebarPinned,
                disabledNotificationCategories,
                notificationCategoryOverrides
            });
            res.status(200).json({ success: true, preferences: mapDto(prefs) });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.UserPreferencesController = UserPreferencesController;
//# sourceMappingURL=UserPreferencesController.js.map