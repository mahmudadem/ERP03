/**
 * CollectionFollowUpProposalGenerator
 *
 * Suggests follow-up actions for overdue receivables.
 * No sending of email/WhatsApp. No collection transaction.
 *
 * This is NOT a real collection action. It is a sandbox proposal.
 */

import {
  AiProposalGenerator,
  ProposalGeneratorInput,
  ProposalGeneratorOutput,
} from './AiProposalGenerator';

export class CollectionFollowUpProposalGenerator extends AiProposalGenerator {
  readonly proposalType = 'sales.collectionFollowUpProposal' as const;
  readonly moduleId = 'sales';
  readonly requiredPermissions = ['ai-assistant.proposals.create'];

  async generate(input: ProposalGeneratorInput): Promise<ProposalGeneratorOutput> {
    const warnings: string[] = [];
    const toolData = input.toolResultData || {};

    // Extract overdue receivables from tool data
    const overdueItems = (toolData as any).overdueItems as any[] | undefined;
    const customerName = (toolData as any).customerName || this.extractCustomerName(input.userMessage);

    if (!overdueItems || !Array.isArray(overdueItems) || overdueItems.length === 0) {
      warnings.push('No overdue receivable data available. The sales module may not be ready or no invoices are overdue.');
    }

    // Build follow-up suggestions
    const followUpItems = (overdueItems || []).map((item: any) => ({
      invoiceNumber: item.invoiceNumber || item.id || '',
      customerName: item.customerName || customerName || '',
      amountDue: item.amountDue ?? item.balance ?? 0,
      overdueDays: item.overdueDays ?? item.daysOverdue ?? 0,
      suggestedAction: this.determineFollowUpAction(item.overdueDays ?? item.daysOverdue ?? 0),
      suggestedMessage: this.generateFollowUpMessage(
        item.customerName || customerName || 'Customer',
        item.amountDue ?? item.balance ?? 0,
        item.overdueDays ?? item.daysOverdue ?? 0,
      ),
    }));

    if (followUpItems.length === 0) {
      warnings.push('No overdue invoices found. Collection follow-up may not be needed at this time.');
    }

    // Safety warnings
    warnings.push('This is a suggestion only. No email, WhatsApp, or collection transaction has been sent or created.');

    const confidence = followUpItems.length > 0 ? 0.6 : 0.1;
    const riskLevel: 'low' | 'medium' | 'high' = 'low';

    return {
      type: this.proposalType,
      title: followUpItems.length > 0
        ? `Collection Follow-up — ${followUpItems.length} overdue invoice(s)`
        : 'Collection Follow-up Proposal (No Overdue Invoices)',
      summary: followUpItems.length > 0
        ? `${followUpItems.length} invoice(s) are overdue. Suggested follow-up actions provided.`
        : 'No overdue invoices found at this time.',
      rationale: 'Following up on overdue receivables helps maintain healthy cash flow. This proposal suggests appropriate follow-up actions based on how long each invoice has been overdue.',
      inputContextSummary: input.userMessage.substring(0, 200),
      proposedData: {
        followUpItems,
        totalItems: followUpItems.length,
        totalAmountDue: followUpItems.reduce((sum, item) => sum + item.amountDue, 0),
        note: 'This is a follow-up suggestion. No communication or transaction has been created.',
      },
      warnings,
      riskLevel,
      moduleId: this.moduleId,
      requiredPermissions: this.requiredPermissions,
      missingInfo: [],
      confidence,
    };
  }

  private extractCustomerName(message: string): string {
    // Simple extraction — look for customer name patterns
    const match = message.match(/(?:customer|عميل|العميل)\s+['"]?(\w[\w\s]*?)['"]?\s*(?:invoice|فاتورة|balance|رصيد|$)/i);
    return match ? match[1].trim() : '';
  }

  private determineFollowUpAction(overdueDays: number): string {
    if (overdueDays <= 7) return 'friendly_reminder';
    if (overdueDays <= 30) return 'formal_reminder';
    if (overdueDays <= 60) return 'urgent_follow_up';
    return 'escalation';
  }

  private generateFollowUpMessage(customerName: string, amount: number, overdueDays: number): string {
    const action = this.determineFollowUpAction(overdueDays);
    switch (action) {
      case 'friendly_reminder':
        return `Dear ${customerName}, this is a friendly reminder that invoice of ${amount} is ${overdueDays} day(s) overdue. We would appreciate your prompt payment.`;
      case 'formal_reminder':
        return `Dear ${customerName}, our records show that invoice of ${amount} is now ${overdueDays} day(s) overdue. Please arrange payment at your earliest convenience.`;
      case 'urgent_follow_up':
        return `Dear ${customerName}, invoice of ${amount} is ${overdueDays} day(s) overdue. This requires urgent attention. Please contact us to discuss payment arrangements.`;
      case 'escalation':
        return `Dear ${customerName}, invoice of ${amount} is ${overdueDays} day(s) overdue. This matter requires immediate resolution. Please contact us within 48 hours.`;
      default:
        return `Follow-up required for ${customerName} — ${amount} overdue by ${overdueDays} day(s).`;
    }
  }
}
