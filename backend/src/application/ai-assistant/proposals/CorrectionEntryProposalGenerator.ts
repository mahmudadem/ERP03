/**
 * CorrectionEntryProposalGenerator
 *
 * Generates a proposed correction entry based on voucher/account statement
 * or problem description.
 *
 * This is NOT a real correction. It is a sandbox proposal.
 * No ERP data is modified.
 */

import {
  AiProposalGenerator,
  ProposalGeneratorInput,
  ProposalGeneratorOutput,
  ProposalLineItem,
} from './AiProposalGenerator';

export class CorrectionEntryProposalGenerator extends AiProposalGenerator {
  readonly proposalType = 'accounting.correctionEntryProposal' as const;
  readonly moduleId = 'accounting';
  readonly requiredPermissions = ['ai-assistant.proposals.create'];

  async generate(input: ProposalGeneratorInput): Promise<ProposalGeneratorOutput> {
    const warnings: string[] = [];
    const missingInfo: string[] = [];
    const toolData = input.toolResultData || {};

    // Determine what kind of correction
    const correctionType = this.detectCorrectionType(input.userMessage);

    // Extract the voucher or account reference
    const voucherRef = this.extractVoucherRef(input.userMessage);
    if (!voucherRef && correctionType === 'voucher_correction') {
      missingInfo.push('voucher reference number (رقم السند)');
    }

    // Build proposed correction approach
    const approach = this.buildCorrectionApproach(correctionType, input.userMessage, toolData);

    // Build proposed lines if we have enough data
    const lines: ProposalLineItem[] = this.buildCorrectionLines(correctionType, toolData);

    if (lines.length === 0 && correctionType === 'voucher_correction') {
      missingInfo.push('original entry details (تفاصيل القيد الأصلي)');
    }

    // Warnings
    warnings.push('Correction entries require careful review. Verify the proposed lines against the original entry.');
    if (correctionType === 'unknown') {
      warnings.push('Could not determine the correction type. Manual review required.');
    }

    const confidence = lines.length > 0 ? 0.6 : 0.2;
    const riskLevel: 'low' | 'medium' | 'high' = 'medium'; // Corrections are always medium+

    return {
      type: this.proposalType,
      title: missingInfo.length > 0
        ? 'Correction Entry Proposal (Incomplete)'
        : `Correction Entry Proposal — ${correctionType.replace('_', ' ')}`,
      summary: approach.summary,
      rationale: approach.rationale,
      inputContextSummary: input.userMessage.substring(0, 200),
      proposedData: {
        correctionType,
        voucherRef: voucherRef || null,
        approach: approach.description,
        lines,
        totalDebit: lines.reduce((s, l) => s + (l.debit || 0), 0),
        totalCredit: lines.reduce((s, l) => s + (l.credit || 0), 0),
        note: 'This is a correction proposal. No real entry has been created or reversed.',
      },
      warnings,
      riskLevel,
      moduleId: this.moduleId,
      requiredPermissions: this.requiredPermissions,
      missingInfo,
      confidence,
    };
  }

  private detectCorrectionType(message: string): string {
    const lower = message.toLowerCase();
    if (lower.includes('reverse') || lower.includes('عكس') || lower.includes('إلغاء')) {
      return 'reversal';
    }
    if (lower.includes('reclassify') || lower.includes('إعادة تصنيف')) {
      return 'reclassification';
    }
    if (lower.includes('adjust') || lower.includes('تعديل') || lower.includes('تصحيح')) {
      return 'adjustment';
    }
    if (lower.includes('voucher') || lower.includes('سند') || lower.includes('قيد')) {
      return 'voucher_correction';
    }
    return 'unknown';
  }

  private extractVoucherRef(message: string): string | null {
    const match = message.match(/(?:voucher|سند|قيد)\s*#?\s*(\w+)/i);
    return match ? match[1] : null;
  }

  private buildCorrectionApproach(
    type: string,
    message: string,
    toolData: Record<string, unknown>,
  ): { summary: string; rationale: string; description: string } {
    switch (type) {
      case 'reversal':
        return {
          summary: 'Proposed reversal entry for the original transaction',
          rationale: 'A reversal entry mirrors the original with debits/credits swapped to nullify the effect.',
          description: 'Reverse the original entry by swapping debit and credit lines',
        };
      case 'reclassification':
        return {
          summary: 'Proposed reclassification entry to move amounts between accounts',
          rationale: 'A reclassification moves the balance from one account to another without changing totals.',
          description: 'Debit the target account and credit the source account for the reclassified amount',
        };
      case 'adjustment':
        return {
          summary: 'Proposed adjustment entry to correct amounts',
          rationale: 'An adjustment entry increases or decreases specific account balances to reflect the correct amounts.',
          description: 'Adjust the amounts in the relevant accounts to match the correct values',
        };
      default:
        return {
          summary: 'Proposed correction entry — type needs manual classification',
          rationale: 'The correction type could not be automatically determined from your description.',
          description: 'Manual review needed to determine the correct approach',
        };
    }
  }

  private buildCorrectionLines(
    type: string,
    toolData: Record<string, unknown>,
  ): ProposalLineItem[] {
    // If we have original lines from tool data, build correction lines
    const originalLines = (toolData as any).originalLines as any[] | undefined;
    if (!originalLines || !Array.isArray(originalLines)) return [];

    switch (type) {
      case 'reversal':
        return originalLines.map((line: any) => ({
          accountCode: line.accountCode,
          accountName: line.accountName,
          debit: line.credit || 0, // Swap
          credit: line.debit || 0, // Swap
          description: `Reversal of: ${line.description || 'original entry'}`,
        }));
      default:
        return [];
    }
  }
}
