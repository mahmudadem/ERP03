"use strict";
/**
 * DeleteAccountUseCase
 *
 * Deletes an account only if:
 * - Not protected
 * - No children
 * - Not USED (no voucher line references)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeleteAccountUseCase = void 0;
class DeleteAccountUseCase {
    constructor(accountRepo) {
        this.accountRepo = accountRepo;
    }
    async execute(companyId, accountId) {
        // 1. Load existing account
        const account = await this.accountRepo.getById(companyId, accountId);
        if (!account) {
            throw this.createError('Account not found', 404);
        }
        // 2. Check if protected
        if (account.isProtected) {
            throw this.createError('Cannot delete a protected account', 403);
        }
        // 3. Check if has children
        const hasChildren = await this.accountRepo.hasChildren(companyId, accountId);
        if (hasChildren) {
            throw this.createError('Cannot delete an account that has child accounts. Delete children first.', 400);
        }
        // 4. Check if USED (has voucher line references)
        const isUsed = await this.accountRepo.isUsed(companyId, accountId);
        if (isUsed) {
            throw this.createError('Cannot delete an account that has been used in vouchers. Consider setting status to INACTIVE instead.', 400);
        }
        // 5. Delete the account
        await this.accountRepo.delete(companyId, accountId);
    }
    createError(message, statusCode) {
        const err = new Error(message);
        err.statusCode = statusCode;
        return err;
    }
}
exports.DeleteAccountUseCase = DeleteAccountUseCase;
//# sourceMappingURL=DeleteAccountUseCase.js.map