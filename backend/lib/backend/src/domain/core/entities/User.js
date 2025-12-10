"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.User = void 0;
class User {
    constructor(id, email, name, globalRole, createdAt, pictureUrl, planId, activeCompanyId) {
        this.id = id;
        this.email = email;
        this.name = name;
        this.globalRole = globalRole;
        this.createdAt = createdAt;
        this.pictureUrl = pictureUrl;
        this.planId = planId;
        this.activeCompanyId = activeCompanyId;
    }
    isAdmin() {
        return this.globalRole === 'SUPER_ADMIN';
    }
    hasPlan() {
        return !!this.planId;
    }
}
exports.User = User;
//# sourceMappingURL=User.js.map