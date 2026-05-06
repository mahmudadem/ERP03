/**
 * VoucherDraftProposalGenerator
 *
 * Generates a proposed voucher draft based on user request.
 * Similar to journal entry but with voucher-specific structure.
 *
 * This is NOT a real voucher. It is a sandbox proposal.
 * No voucher is created in real accounting tables.
 */

import {
  AiProposalGenerator,
  ProposalGeneratorInput,
  ProposalGeneratorOutput,
  ProposalLineItem,
} from './AiProposalGenerator';

export class VoucherDraftProposalGenerator extends AiProposalGenerator {
  readonly proposalType = 'accounting.voucherDraft' as const;
  readonly moduleId = 'accounting';
  readonly requiredPermissions = ['ai-assistant.proposals.create'];

  async generate(input: ProposalGeneratorInput): Promise<ProposalGeneratorOutput> {
    const warnings: string[] = [];
    const missingInfo: string[] = [];
    const toolData = input.toolResultData || {};

    // Detect voucher type from message
    const voucherType = this.detectVoucherType(input.userMessage);

    // Extract amount
    const amount = this.extractAmount(input.userMessage, toolData);
    if (!amount) missingInfo.push('amount (القيمة)');

    // Build proposed lines
    const lines = this.buildVoucherLines(voucherType, amount, toolData);

    if (lines.length === 0) {
      missingInfo.push('account details (تفاصيل الحسابات)');
    }

    // Check balanced
    const totalDebit = lines.reduce((s, l) => s + (l.debit || 0), 0);
    const totalCredit = lines.reduce((s, l) => s + (l.credit || 0), 0);
    const balanced = Math.abs(totalDebit - totalCredit) < 0.01;

    if (!balanced && lines.length > 0) {
      warnings.push('Proposed lines are not balanced. Review the amounts.');
    }

    warnings.push('This is a voucher draft proposal. No real voucher has been created.');

    const confidence = lines.length > 0 && balanced ? 0.7 : lines.length > 0 ? 0.4 : 0.1;
    const riskLevel: 'low' | 'medium' | 'high' = missingInfo.length > 1 ? 'high' : balanced ? 'low' : 'medium';

    return {
      type: this.proposalType,
      title: missingInfo.length > 0
        ? `Voucher Draft — ${voucherType} (Incomplete)`
        : `Voucher Draft — ${voucherType}`,
      summary: amount
        ? `Proposed ${voucherType} voucher for ${amount}`
        : `Proposed ${voucherType} voucher — requires amount and accounts`,
      rationale: `Based on your request "${input.userMessage.substring(0, 100)}", this proposes a ${voucherType} voucher structure. This is a sandbox draft and does NOT create a real voucher.`,
      inputContextSummary: input.userMessage.substring(0, 200),
      proposedData: {
        voucherType,
        lines,
        totalDebit,
        totalCredit,
        balanced,
        currency: (toolData as any).currency || 'SAR',
        date: new Date().toISOString().split('T')[0],
        note: 'This is a voucher draft proposal. No real voucher has been created or posted.',
      },
      warnings,
      riskLevel,
      moduleId: this.moduleId,
      requiredPermissions: this.requiredPermissions,
      missingInfo,
      confidence,
    };
  }

  private detectVoucherType(message: string): string {
    const lower = message.toLowerCase();
    if (lower.includes('payment') || lower.includes('دفع') || lower.includes('سداد')) return 'payment';
    if (lower.includes('receipt') || lower.includes('قبض') || lower.includes('إيراد')) return 'receipt';
    if (lower.includes('journal') || lower.includes('قيد')) return 'journal';
    return 'journal'; // Default
  }

  private extractAmount(message: string, toolData: Record<string, unknown>): number | null {
    const match = message.match(/(\d[\d,]*\.?\d*)/);
    if (match) {
      const num = parseFloat(match[1].replace(/,/g, ''));
      if (num > 0) return num;
    }
    if ((toolData as any).amount) return toolData.amount as number;
    return null;
  }

  private buildVoucherLines(
    voucherType: string,
    amount: number | null,
    toolData: Record<string, unknown>,
  ): ProposalLineItem[] {
    const lines: ProposalLineItem[] = [];
    const amt = amount || 0;

    if (amt > 0) {
      // Build a basic two-line entry based on voucher type
      switch (voucherType) {
        case 'payment':
          lines.push(
            { accountCode: '2XXXX', accountName: 'Accounts Payable (suggested)', debit: amt, credit: 0, description: 'Payment - debit' },
            { accountCode: '1XXXX', accountName: 'Cash/Bank (suggested)', debit: 0, credit: amt, description: 'Payment - credit' },
          );
          break;
        case 'receipt':
          lines.push(
            { accountCode: '1XXXX', accountName: 'Cash/Bank (suggested)', debit: amt, credit: 0, description: 'Receipt - debit' },
            { accountCode: '1XXXX', accountName: 'Accounts Receivable (suggested)', debit: 0, credit: amt, description: 'Receipt - credit' },
          );
          break;
        default:
          lines.push(
            { accountCode: 'XXXX', accountName: 'Debit Account (suggested)', debit: amt, credit: 0, description: 'Journal entry - debit' },
            { accountCode: 'XXXX', accountName: 'Credit Account (suggested)', debit: 0, credit: amt, description: 'Journal entry - credit' },
          );
      }
    }

    return lines;
  }
}
