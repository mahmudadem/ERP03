"use strict";
/**
 * DeactivateAccountUseCase
 *
 * Sets account status to INACTIVE.
 * Prefer using UpdateAccountUseCase for full audit trail.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeactivateAccountUseCase = void 0;
class DeactivateAccountUseCase {
    constructor(accountRepo) {
        this.accountRepo = accountRepo;
    }
    async execute(companyId, accountId, deactivatedBy) {
        // 1. Load existing account
        const account = await this.accountRepo.getById(companyId, accountId);
        if (!account) {
            throw this.createError('Account not found', 404);
        }
        // 2. Check if protected
        if (account.isProtected) {
            throw this.createError('Cannot deactivate a protected account', 403);
        }
        // 3. Check if has children (optional: could allow deactivating parent)
        const hasChildren = await this.accountRepo.hasChildren(companyId, accountId);
        if (hasChildren) {
            throw this.createError('Cannot deactivate an account with children. Deactivate children first.', 400);
        }
        // 4. Record audit event
        await this.accountRepo.recordAuditEvent(companyId, accountId, {
            type: 'STATUS_CHANGED',
            field: 'status',
            oldValue: account.status,
            newValue: 'INACTIVE',
            changedBy: deactivatedBy || 'SYSTEM',
            changedAt: new Date()
        });
        // 5. Deactivate
        await this.accountRepo.deactivate(companyId, accountId);
    }
    createError(message, statusCode) {
        const err = new Error(message);
        err.statusCode = statusCode;
        return err;
    }
}
exports.DeactivateAccountUseCase = DeactivateAccountUseCase;
//# sourceMappingURL=DeactivateAccountUseCase.js.map