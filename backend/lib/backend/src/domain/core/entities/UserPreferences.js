"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserPreferences = void 0;
class UserPreferences {
    constructor(userId, language = 'en', uiMode = 'windows', theme = 'light', sidebarMode = 'classic', sidebarPinned = true, createdAt = new Date(), updatedAt = new Date()) {
        this.userId = userId;
        this.language = language;
        this.uiMode = uiMode;
        this.theme = theme;
        this.sidebarMode = sidebarMode;
        this.sidebarPinned = sidebarPinned;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }
}
exports.UserPreferences = UserPreferences;
//# sourceMappingURL=UserPreferences.js.map