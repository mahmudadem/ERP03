"use strict";
/**
 * AccountingDTOs.ts
 *
 * Data Transfer Objects for the Accounting API.
 * Includes full Account DTO with new specification fields.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccountingDTOMapper = void 0;
// ============================================================================
// DTO MAPPERS
// ============================================================================
class AccountingDTOMapper {
    static toAccountDTO(account) {
        return {
            // Identity
            id: account.id,
            systemCode: account.systemCode,
            userCode: account.userCode,
            name: account.name,
            description: account.description,
            // Accounting semantics
            accountRole: account.accountRole,
            classification: account.classification,
            balanceNature: account.balanceNature,
            balanceEnforcement: account.balanceEnforcement,
            // Hierarchy
            parentId: account.parentId,
            // Currency
            currencyPolicy: account.currencyPolicy,
            fixedCurrencyCode: account.fixedCurrencyCode,
            allowedCurrencyCodes: account.allowedCurrencyCodes,
            // Lifecycle
            status: account.status,
            isProtected: account.isProtected,
            replacedByAccountId: account.replacedByAccountId,
            // Audit
            createdAt: account.createdAt.toISOString(),
            createdBy: account.createdBy,
            updatedAt: account.updatedAt.toISOString(),
            updatedBy: account.updatedBy,
            // Computed flags
            canPost: account.canPost(),
            hasChildren: account.hasChildren,
            isUsed: account.isUsed,
            // Legacy compat
            code: account.userCode,
            type: account.classification,
            currency: account.fixedCurrencyCode || '',
            active: account.status === 'ACTIVE',
            requiresApproval: account.requiresApproval,
            requiresCustodyConfirmation: account.requiresCustodyConfirmation,
            custodianUserId: account.custodianUserId
        };
    }
    static toVoucherDTO(voucher) {
        return {
            id: voucher.id,
            companyId: voucher.companyId,
            voucherNo: voucher.voucherNo,
            type: voucher.type,
            date: voucher.date,
            description: voucher.description,
            currency: voucher.currency,
            baseCurrency: voucher.baseCurrency,
            exchangeRate: voucher.exchangeRate,
            status: voucher.status,
            totalDebit: voucher.totalDebit,
            totalCredit: voucher.totalCredit,
            reference: voucher.reference,
            createdBy: voucher.createdBy,
            createdAt: voucher.createdAt.toISOString(),
            metadata: voucher.metadata,
            sourceModule: voucher.sourceModule,
            formId: voucher.formId,
            prefix: voucher.prefix,
            reversalOfVoucherId: voucher.reversalOfVoucherId,
            lines: voucher.lines.map(line => AccountingDTOMapper.toVoucherLineDTO(line))
        };
    }
    static toVoucherLineDTO(line) {
        return {
            id: line.id,
            accountId: line.accountId,
            side: line.side,
            amount: line.amount,
            baseAmount: line.baseAmount,
            currency: line.currency,
            baseCurrency: line.baseCurrency,
            exchangeRate: line.exchangeRate,
            notes: line.notes,
            costCenterId: line.costCenterId,
            metadata: line.metadata
        };
    }
}
exports.AccountingDTOMapper = AccountingDTOMapper;
//# sourceMappingURL=AccountingDTOs.js.map