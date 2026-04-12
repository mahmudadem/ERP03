"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VoucherPostingStrategyFactory = void 0;
const PaymentVoucherStrategy_1 = require("../strategies/implementations/PaymentVoucherStrategy");
const ReceiptVoucherStrategy_1 = require("../strategies/implementations/ReceiptVoucherStrategy");
const JournalEntryStrategy_1 = require("../strategies/implementations/JournalEntryStrategy");
const OpeningBalanceStrategy_1 = require("../strategies/implementations/OpeningBalanceStrategy");
const FXRevaluationStrategy_1 = require("../strategies/implementations/FXRevaluationStrategy");
const PurchaseInvoiceStrategy_1 = require("../strategies/implementations/PurchaseInvoiceStrategy");
const PurchaseReturnStrategy_1 = require("../strategies/implementations/PurchaseReturnStrategy");
const SalesInvoiceStrategy_1 = require("../strategies/implementations/SalesInvoiceStrategy");
const SalesReturnStrategy_1 = require("../strategies/implementations/SalesReturnStrategy");
/**
 * VoucherPostingStrategyFactory
 *
 * Maps VoucherType enum values to their corresponding posting strategies.
 * Each of the 4 canonical voucher types has exactly one strategy.
 *
 * Contract:
 * - Input: lowercase enum value from VoucherType (e.g., 'payment', 'receipt')
 * - Output: IVoucherPostingStrategy (never null)
 * - Throws error for unknown types
 */
class VoucherPostingStrategyFactory {
    static getStrategy(typeCode) {
        switch (typeCode) {
            case 'purchase_invoice':
                return new PurchaseInvoiceStrategy_1.PurchaseInvoiceStrategy();
            case 'purchase_return':
                return new PurchaseReturnStrategy_1.PurchaseReturnStrategy();
            case 'sales_invoice':
                return new SalesInvoiceStrategy_1.SalesInvoiceStrategy();
            case 'sales_return':
                return new SalesReturnStrategy_1.SalesReturnStrategy();
            case 'payment':
                return new PaymentVoucherStrategy_1.PaymentVoucherStrategy();
            case 'receipt':
                return new ReceiptVoucherStrategy_1.ReceiptVoucherStrategy();
            case 'journal_entry':
                return new JournalEntryStrategy_1.JournalEntryStrategy();
            case 'opening_balance':
                return new OpeningBalanceStrategy_1.OpeningBalanceStrategy();
            case 'fx_revaluation':
                return new FXRevaluationStrategy_1.FXRevaluationStrategy();
            default:
                throw new Error(`Unknown voucher type: ${typeCode}. Valid types: purchase_invoice, purchase_return, sales_invoice, sales_return, payment, receipt, journal_entry, opening_balance, fx_revaluation`);
        }
    }
}
exports.VoucherPostingStrategyFactory = VoucherPostingStrategyFactory;
//# sourceMappingURL=VoucherPostingStrategyFactory.js.map