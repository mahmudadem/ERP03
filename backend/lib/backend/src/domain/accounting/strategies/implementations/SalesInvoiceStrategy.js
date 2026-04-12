"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SalesInvoiceStrategy = void 0;
const SubledgerDocumentStrategyHelper_1 = require("./SubledgerDocumentStrategyHelper");
class SalesInvoiceStrategy {
    async generateLines(header, companyId, baseCurrency) {
        return (0, SubledgerDocumentStrategyHelper_1.generateSubledgerDocumentLines)(header, baseCurrency);
    }
}
exports.SalesInvoiceStrategy = SalesInvoiceStrategy;
//# sourceMappingURL=SalesInvoiceStrategy.js.map