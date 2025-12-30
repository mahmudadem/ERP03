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