"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PurchaseInvoiceStrategy = void 0;
const SubledgerDocumentStrategyHelper_1 = require("./SubledgerDocumentStrategyHelper");
class PurchaseInvoiceStrategy {
    async generateLines(header, companyId, baseCurrency) {
        return (0, SubledgerDocumentStrategyHelper_1.generateSubledgerDocumentLines)(header, baseCurrency);
    }
}
exports.PurchaseInvoiceStrategy = PurchaseInvoiceStrategy;
//# sourceMappingURL=PurchaseInvoiceStrategy.js.map