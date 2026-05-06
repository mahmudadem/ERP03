/**
 * JournalEntryProposalGenerator
 *
 * Generates a proposed journal entry (debit/credit lines) based on
 * user request, tool results, or account/amount hints.
 *
 * This is NOT a real journal entry. It is a sandbox proposal.
 * No ERP data is created.
 *
 * Deterministic template + AI explanation approach:
 * - The debit/credit structure is computed deterministically from inputs
 * - The rationale/explanation is generated from human readability
 * - If insufficient data, the proposal includes a missingInfo list
 */

import {
  AiProposalGenerator,
  ProposalGeneratorInput,
  ProposalGeneratorOutput,
  ProposalLineItem,
} from './AiProposalGenerator';

export class JournalEntryProposalGenerator extends AiProposalGenerator {
  readonly proposalType = 'accounting.journalEntryProposal' as const;
  readonly moduleId = 'accounting';
  readonly requiredPermissions = ['ai-assistant.proposals.create'];

  async generate(input: ProposalGeneratorInput): Promise<ProposalGeneratorOutput> {
    const warnings: string[] = [];
    const missingInfo: string[] = [];
    const lines: ProposalLineItem[] = [];

    // Extract hints from tool result data or context
    const toolData = input.toolResultData || {};
    const context = input.context || {};

    // Parse amount from user message or tool data
    const amount = this.extractAmount(input.userMessage, toolData);
    if (!amount) {
      missingInfo.push('amount (القيمة)');
    }

    // Parse account hints
    const debitAccount = this.extractAccount(input.userMessage, 'debit', toolData);
    const creditAccount = this.extractAccount(input.userMessage, 'credit', toolData);

    if (!debitAccount) {
      missingInfo.push('debit account (الحساب المدين)');
    }
    if (!creditAccount) {
      missingInfo.push('credit account (الحساب الدائن)');
    }

    // Build proposed lines if we have enough data
    if (amount && debitAccount) {
      lines.push({
        accountCode: debitAccount.code,
        accountName: debitAccount.name,
        debit: amount,
        credit: 0,
        description: `Proposed debit: ${debitAccount.name}`,
      });
    }

    if (amount && creditAccount) {
      lines.push({
        accountCode: creditAccount.code,
        accountName: creditAccount.name,
        debit: 0,
        credit: amount,
        description: `Proposed credit: ${creditAccount.name}`,
      });
    }

    // Validate balanced entry if both lines exist
    if (lines.length >= 2) {
      const totalDebit = lines.reduce((sum, l) => sum + (l.debit || 0), 0);
      const totalCredit = lines.reduce((sum, l) => sum + (l.credit || 0), 0);
      if (Math.abs(totalDebit - totalCredit) > 0.01) {
        warnings.push('Debits and credits are not balanced. Review the proposed amounts.');
      }
    } else if (amount && (debitAccount || creditAccount)) {
      // Only one side provided
      missingInfo.push('counter-account (الحساب المقابل)');
    }

    // Determine confidence
    let confidence = 0.3;
    if (amount) confidence += 0.2;
    if (debitAccount && creditAccount) confidence += 0.3;
    if (lines.length >= 2 && warnings.length === 0) confidence += 0.2;

    // Determine risk level
    let riskLevel: 'low' | 'medium' | 'high' = 'medium';
    if (missingInfo.length > 1) riskLevel = 'high';
    if (missingInfo.length === 0 && warnings.length === 0) riskLevel = 'low';

    return {
      type: this.proposalType,
      title: missingInfo.length > 0
        ? 'Journal Entry Proposal (Incomplete)'
        : 'Journal Entry Proposal',
      summary: amount
        ? `Proposed journal entry for ${amount} with ${lines.length} line(s)`
        : 'Journal entry proposal — requires amount and account information',
      rationale: `Based on your request "${input.userMessage.substring(0, 100)}", this proposal suggests the following journal entry structure. This is a sandbox proposal and does NOT create a real journal entry.`,
      inputContextSummary: input.userMessage.substring(0, 200),
      proposedData: {
        lines,
        totalDebit: lines.reduce((s, l) => s + (l.debit || 0), 0),
        totalCredit: lines.reduce((s, l) => s + (l.credit || 0), 0),
        balanced: lines.length >= 2
          ? Math.abs(lines.reduce((s, l) => s + (l.debit || 0), 0) - lines.reduce((s, l) => s + (l.credit || 0), 0)) < 0.01
          : false,
        currency: (context as any).currency || 'SAR',
        date: new Date().toISOString().split('T')[0],
      },
      warnings,
      riskLevel,
      moduleId: this.moduleId,
      requiredPermissions: this.requiredPermissions,
      missingInfo,
      confidence: Math.min(confidence, 1),
    };
  }

  private extractAmount(message: string, toolData: Record<string, unknown>): number | null {
    // Try to extract amount from message
    const amountMatch = message.match(/(\d[\d,]*\.?\d*)/);
    if (amountMatch) {
      const num = parseFloat(amountMatch[1].replace(/,/g, ''));
      if (num > 0) return num;
    }
    // Try tool data
    if (toolData.amount && typeof toolData.amount === 'number') return toolData.amount;
    if (toolData.totalAmount && typeof toolData.totalAmount === 'number') return toolData.totalAmount;
    return null;
  }

  private extractAccount(
    message: string,
    side: 'debit' | 'credit',
    toolData: Record<string, unknown>,
  ): { code: string; name: string } | null {
    // Try to extract account from tool data
    if (side === 'debit' && toolData.debitAccount) {
      const acc = toolData.debitAccount as any;
      return { code: acc.code || acc.accountCode || '', name: acc.name || acc.accountName || '' };
    }
    if (side === 'credit' && toolData.creditAccount) {
      const acc = toolData.creditAccount as any;
      return { code: acc.code || acc.accountCode || '', name: acc.name || acc.accountName || '' };
    }
    // Try to extract from context
    if (toolData.accounts && Array.isArray(toolData.accounts)) {
      const accounts = toolData.accounts as any[];
      if (side === 'debit' && accounts[0]) {
        return { code: accounts[0].code || '', name: accounts[0].name || '' };
      }
      if (side === 'credit' && accounts[1]) {
        return { code: accounts[1].code || '', name: accounts[1].name || '' };
      }
    }
    return null;
  }
}
