"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpsertUserPreferencesUseCase = exports.GetUserPreferencesUseCase = void 0;
class GetUserPreferencesUseCase {
    constructor(repo) {
        this.repo = repo;
    }
    async execute(userId) {
        return this.repo.getByUserId(userId);
    }
}
exports.GetUserPreferencesUseCase = GetUserPreferencesUseCase;
class UpsertUserPreferencesUseCase {
    constructor(repo) {
        this.repo = repo;
    }
    async execute(userId, prefs) {
        return this.repo.upsert(userId, prefs);
    }
}
exports.UpsertUserPreferencesUseCase = UpsertUserPreferencesUseCase;
//# sourceMappingURL=UserPreferencesUseCases.js.map