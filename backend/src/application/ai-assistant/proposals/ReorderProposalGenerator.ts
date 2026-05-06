/**
 * ReorderProposalGenerator
 *
 * Suggests reorder quantities for low-stock items.
 * Only active if inventory module structures exist.
 *
 * This is NOT a real purchase order or stock movement.
 * No inventory transactions are created.
 */

import {
  AiProposalGenerator,
  ProposalGeneratorInput,
  ProposalGeneratorOutput,
} from './AiProposalGenerator';

export class ReorderProposalGenerator extends AiProposalGenerator {
  readonly proposalType = 'inventory.reorderProposal' as const;
  readonly moduleId = 'inventory';
  readonly requiredPermissions = ['ai-assistant.proposals.create'];

  async generate(input: ProposalGeneratorInput): Promise<ProposalGeneratorOutput> {
    const warnings: string[] = [];
    const toolData = input.toolResultData || {};

    // Check if inventory data is available
    const lowStockItems = (toolData as any).lowStockItems as any[] | undefined;
    if (!lowStockItems || !Array.isArray(lowStockItems) || lowStockItems.length === 0) {
      warnings.push('No low-stock data available. The inventory module may not be ready or no items are below reorder level.');
    }

    // Build reorder suggestions from tool data
    const reorderList = (lowStockItems || []).map((item: any) => ({
      itemCode: item.code || item.itemCode || '',
      itemName: item.name || item.itemName || '',
      currentStock: item.currentStock ?? item.quantityOnHand ?? 0,
      reorderPoint: item.reorderPoint ?? item.minimumStock ?? 0,
      suggestedReorderQty: this.calculateReorderQty(item),
      unit: item.unit || '',
      reason: `Below reorder point (${item.reorderPoint ?? item.minimumStock ?? 0})`,
    }));

    // Warnings
    if (reorderList.length === 0) {
      warnings.push('No items require reordering based on available data.');
    }
    warnings.push('This is a suggestion only. No purchase order or stock movement has been created.');

    const confidence = reorderList.length > 0 ? 0.7 : 0.2;
    const riskLevel: 'low' | 'medium' | 'high' = reorderList.length > 0 ? 'low' : 'medium';

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

  private calculateReorderQty(item: any): number {
    const current = item.currentStock ?? item.quantityOnHand ?? 0;
    const reorderPoint = item.reorderPoint ?? item.minimumStock ?? 0;
    const maxStock = item.maximumStock ?? item.maxLevel ?? 0;

    // Suggest bringing stock up to max level, or reorder point * 2 if no max defined
    const target = maxStock > 0 ? maxStock : reorderPoint * 2;
    const qty = Math.max(0, target - current);
    return Math.ceil(qty);
  }
}
