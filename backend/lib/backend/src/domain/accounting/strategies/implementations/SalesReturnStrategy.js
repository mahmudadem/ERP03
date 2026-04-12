"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SalesReturnStrategy = void 0;
const SubledgerDocumentStrategyHelper_1 = require("./SubledgerDocumentStrategyHelper");
class SalesReturnStrategy {
    async generateLines(header, companyId, baseCurrency) {
        return (0, SubledgerDocumentStrategyHelper_1.generateSubledgerDocumentLines)(header, baseCurrency);
    }
}
exports.SalesReturnStrategy = SalesReturnStrategy;
//# sourceMappingURL=SalesReturnStrategy.js.map