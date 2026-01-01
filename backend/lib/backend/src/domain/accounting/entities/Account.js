"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Account = void 0;
class Account {
    constructor(companyId, id, // id = code (for business operations)
    code, // Account code (same as id)
    name, type, currency, isProtected, // System accounts that cannot be deleted
    active, uuid, // System UUID for error tracing/logs
    parentId, createdAt, updatedAt, 
    // Approval Policy V1 fields
    requiresApproval = false, // Triggers FA gate when voucher touches this account
    requiresCustodyConfirmation = false, // Triggers CC gate when voucher touches this account
    custodianUserId // User who must confirm custody (when CC is required)
    ) {
        this.companyId = companyId;
        this.id = id;
        this.code = code;
        this.name = name;
        this.type = type;
        this.currency = currency;
        this.isProtected = isProtected;
        this.active = active;
        this.uuid = uuid;
        this.parentId = parentId;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
        this.requiresApproval = requiresApproval;
        this.requiresCustodyConfirmation = requiresCustodyConfirmation;
        this.custodianUserId = custodianUserId;
        this.isParent = false; // Set by repository when account has children
        this.hasChildren = false; // Same as isParent, for compatibility
        this.isActive = active;
    }
    /** Mark this account as a parent account (has children) */
    setAsParent(hasChildren) {
        this.isParent = hasChildren;
        this.hasChildren = hasChildren;
    }
}
exports.Account = Account;
//# sourceMappingURL=Account.js.map