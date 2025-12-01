"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Account = void 0;
class Account {
    constructor(companyId, id, code, name, type, currency, isProtected, // System accounts that cannot be deleted
    active, parentId, createdAt, updatedAt) {
        this.companyId = companyId;
        this.id = id;
        this.code = code;
        this.name = name;
        this.type = type;
        this.currency = currency;
        this.isProtected = isProtected;
        this.active = active;
        this.parentId = parentId;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
        this.isActive = active;
    }
}
exports.Account = Account;
//# sourceMappingURL=Account.js.map