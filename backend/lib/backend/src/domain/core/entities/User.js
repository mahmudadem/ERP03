"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.User = void 0;
class User {
    constructor(id, email, name, globalRole, createdAt, pictureUrl) {
        this.id = id;
        this.email = email;
        this.name = name;
        this.globalRole = globalRole;
        this.createdAt = createdAt;
        this.pictureUrl = pictureUrl;
    }
    isAdmin() {
        return this.globalRole === 'SUPER_ADMIN';
    }
}
exports.User = User;
//# sourceMappingURL=User.js.map