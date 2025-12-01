"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccountingDTOMapper = void 0;
class AccountingDTOMapper {
    static toAccountDTO(account) {
        return {
            id: account.id,
            code: account.code,
            name: account.name,
            type: account.type,
            currency: account.currency,
            active: account.active,
        };
    }
    static toVoucherDTO(voucher, lines = []) {
        return {
            id: voucher.id,
            companyId: voucher.companyId,
            type: voucher.type,
            date: new Date(voucher.date).toISOString(),
            currency: voucher.currency,
            exchangeRate: voucher.exchangeRate,
            status: voucher.status,
            totalDebit: voucher.totalDebit,
            totalCredit: voucher.totalCredit,
            reference: voucher.reference,
            createdBy: voucher.createdBy,
            lines: lines.map(line => ({
                id: line.id,
                accountId: line.accountId,
                description: line.description,
                fxAmount: line.fxAmount,
                baseAmount: line.baseAmount,
                costCenterId: line.costCenterId
            }))
        };
    }
}
exports.AccountingDTOMapper = AccountingDTOMapper;
//# sourceMappingURL=AccountingDTOs.js.map