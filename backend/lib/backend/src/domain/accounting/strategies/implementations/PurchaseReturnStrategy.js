"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PurchaseReturnStrategy = void 0;
const SubledgerDocumentStrategyHelper_1 = require("./SubledgerDocumentStrategyHelper");
class PurchaseReturnStrategy {
    async generateLines(header, companyId, baseCurrency) {
        return (0, SubledgerDocumentStrategyHelper_1.generateSubledgerDocumentLines)(header, baseCurrency);
    }
}
exports.PurchaseReturnStrategy = PurchaseReturnStrategy;
//# sourceMappingURL=PurchaseReturnStrategy.js.map