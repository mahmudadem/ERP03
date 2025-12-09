"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VoucherPostingStrategyFactory = void 0;
const PaymentVoucherStrategy_1 = require("../strategies/implementations/PaymentVoucherStrategy");
const ReceiptVoucherStrategy_1 = require("../strategies/implementations/ReceiptVoucherStrategy");
const FxVoucherStrategy_1 = require("../strategies/implementations/FxVoucherStrategy");
const TransferVoucherStrategy_1 = require("../strategies/implementations/TransferVoucherStrategy");
class VoucherPostingStrategyFactory {
    static getStrategy(typeCode) {
        switch (typeCode) {
            case 'PAYMENT':
                return new PaymentVoucherStrategy_1.PaymentVoucherStrategy();
            case 'RECEIPT':
                return new ReceiptVoucherStrategy_1.ReceiptVoucherStrategy();
            case 'FX':
                return new FxVoucherStrategy_1.FxVoucherStrategy();
            case 'TRANSFER':
                return new TransferVoucherStrategy_1.TransferVoucherStrategy();
            default:
                return null; // For manual journals or unknown types
        }
    }
}
exports.VoucherPostingStrategyFactory = VoucherPostingStrategyFactory;
//# sourceMappingURL=VoucherPostingStrategyFactory.js.map