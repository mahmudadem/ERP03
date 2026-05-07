"use strict";
/**
 * ReorderProposalGenerator
 *
 * Suggests reorder quantities for low-stock items.
 * Only active if inventory module structures exist.
 *
 * This is NOT a real purchase order or stock movement.
 * No inventory transactions are created.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReorderProposalGenerator = void 0;
const AiProposalGenerator_1 = require("./AiProposalGenerator");
class ReorderProposalGenerator extends AiProposalGenerator_1.AiProposalGenerator {
    constructor() {
        super(...arguments);
        this.proposalType = 'inventory.reorderProposal';
        this.moduleId = 'inventory';
        this.requiredPermissions = ['ai-assistant.proposals.create'];
    }
    async generate(input) {
        const warnings = [];
        const toolData = input.toolResultData || {};
        // Check if inventory data is available
        const lowStockItems = toolData.lowStockItems;
        if (!lowStockItems || !Array.isArray(lowStockItems) || lowStockItems.length === 0) {
            warnings.push('No low-stock data available. The inventory module may not be ready or no items are below reorder level.');
        }
        // Build reorder suggestions from tool data
        const reorderList = (lowStockItems || []).map((item) => {
            var _a, _b, _c, _d, _e, _f;
            return ({
                itemCode: item.code || item.itemCode || '',
                itemName: item.name || item.itemName || '',
                currentStock: (_b = (_a = item.currentStock) !== null && _a !== void 0 ? _a : item.quantityOnHand) !== null && _b !== void 0 ? _b : 0,
                reorderPoint: (_d = (_c = item.reorderPoint) !== null && _c !== void 0 ? _c : item.minimumStock) !== null && _d !== void 0 ? _d : 0,
                suggestedReorderQty: this.calculateReorderQty(item),
                unit: item.unit || '',
                reason: `Below reorder point (${(_f = (_e = item.reorderPoint) !== null && _e !== void 0 ? _e : item.minimumStock) !== null && _f !== void 0 ? _f : 0})`,
            });
        });
        // Warnings
        if (reorderList.length === 0) {
            warnings.push('No items require reordering based on available data.');
        }
        warnings.push('This is a suggestion only. No purchase order or stock movement has been created.');
        const confidence = reorderList.length > 0 ? 0.7 : 0.2;
        const riskLevel = reorderList.length > 0 ? 'low' : 'medium';
        return {
            type: this.proposalType,
            title: reorderList.length > 0
                ? `Reorder Proposal — ${reorderList.length} item(s)`
                : 'Reorder Proposal (No Items to Reorder)',
            summary: reorderList.length > 0
                ? `${reorderList.length} item(s) are below their reorder point and may need restocking.`
                : 'No items currently need reordering based on available inventory data.',
            rationale: 'Items below their reorder point should be restocked to prevent stockouts. This proposal suggests reorder quantities based on the difference between current stock and reorder point, with a safety buffer.',
            inputContextSummary: input.userMessage.substring(0, 200),
            proposedData: {
                reorderList,
                totalItems: reorderList.length,
                note: 'This is a reorder suggestion. No purchase order has been created.',
            },
            warnings,
            riskLevel,
            moduleId: this.moduleId,
            requiredPermissions: this.requiredPermissions,
            missingInfo: [],
            confidence,
        };
    }
    calculateReorderQty(item) {
        var _a, _b, _c, _d, _e, _f;
        const current = (_b = (_a = item.currentStock) !== null && _a !== void 0 ? _a : item.quantityOnHand) !== null && _b !== void 0 ? _b : 0;
        const reorderPoint = (_d = (_c = item.reorderPoint) !== null && _c !== void 0 ? _c : item.minimumStock) !== null && _d !== void 0 ? _d : 0;
        const maxStock = (_f = (_e = item.maximumStock) !== null && _e !== void 0 ? _e : item.maxLevel) !== null && _f !== void 0 ? _f : 0;
        // Suggest bringing stock up to max level, or reorder point * 2 if no max defined
        const target = maxStock > 0 ? maxStock : reorderPoint * 2;
        const qty = Math.max(0, target - current);
        return Math.ceil(qty);
    }
}
exports.ReorderProposalGenerator = ReorderProposalGenerator;
//# sourceMappingURL=ReorderProposalGenerator.js.map