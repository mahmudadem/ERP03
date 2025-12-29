"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirestoreUserAccessScopeProvider = void 0;
/**
 * FirestoreUserAccessScopeProvider
 *
 * Loads user access scope from Firestore user profile.
 *
 * Storage location: users/{userId}/profile
 *
 * Safe defaults:
 * - Missing profile → empty allowedUnitIds (denies restricted accounts)
 * - Missing fields → empty allowedUnitIds, isSuper = false
 */
class FirestoreUserAccessScopeProvider {
    constructor(db) {
        this.db = db;
    }
    async getScope(userId, companyId) {
        var _a, _b;
        try {
            const profileRef = this.db
                .collection('users')
                .doc(userId)
                .collection('profile')
                .doc('access');
            const snapshot = await profileRef.get();
            if (!snapshot.exists) {
                // Safe default: no access to restricted accounts
                return this.getDefaultScope();
            }
            const data = snapshot.data();
            if (!data) {
                return this.getDefaultScope();
            }
            return {
                allowedUnitIds: (_a = data.allowedUnitIds) !== null && _a !== void 0 ? _a : [],
                isSuper: (_b = data.isSuper) !== null && _b !== void 0 ? _b : false
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
exports.FirestoreUserAccessScopeProvider = FirestoreUserAccessScopeProvider;
//# sourceMappingURL=FirestoreUserAccessScopeProvider.js.map