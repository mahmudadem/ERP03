"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Notification = void 0;
class Notification {
    constructor(id, userId, companyId, type, message, createdAt, read) {
        this.id = id;
        this.userId = userId;
        this.companyId = companyId;
        this.type = type;
        this.message = message;
        this.createdAt = createdAt;
        this.read = read;
    }
    markAsRead() {
        this.read = true;
    }
}
exports.Notification = Notification;
//# sourceMappingURL=Notification.js.map