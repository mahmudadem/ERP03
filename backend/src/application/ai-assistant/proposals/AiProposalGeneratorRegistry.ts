/**
 * AiProposalGeneratorRegistry
 *
 * Routes proposal generation requests to the appropriate generator.
 * Enforces that only registered, controlled generators can create proposals.
 * The AI cannot create arbitrary JSON — only registered generators produce proposedData.
 */

import { AiProposalType } from '../../../domain/ai-assistant/entities/AiProposal';
import {
  AiProposalGenerator,
  ProposalGeneratorInput,
  ProposalGeneratorOutput,
} from './AiProposalGenerator';
import { JournalEntryProposalGenerator } from './JournalEntryProposalGenerator';
import { CorrectionEntryProposalGenerator } from './CorrectionEntryProposalGenerator';
import { AccountMappingProposalGenerator } from './AccountMappingProposalGenerator';
import { ReorderProposalGenerator } from './ReorderProposalGenerator';
import { CollectionFollowUpProposalGenerator } from './CollectionFollowUpProposalGenerator';
import { VoucherDraftProposalGenerator } from './VoucherDraftProposalGenerator';
import { ManagementInsightProposalGenerator } from './ManagementInsightProposalGenerator';

export class AiProposalGeneratorRegistry {
  private generators: Map<AiProposalType, AiProposalGenerator> = new Map();

  constructor() {
    // Register all proposal generators
    this.register(new JournalEntryProposalGenerator());
    this.register(new CorrectionEntryProposalGenerator());
    this.register(new AccountMappingProposalGenerator());
    this.register(new ReorderProposalGenerator());
    this.register(new CollectionFollowUpProposalGenerator());
    this.register(new VoucherDraftProposalGenerator());
    this.register(new ManagementInsightProposalGenerator());
  }

  private register(generator: AiProposalGenerator): void {
    this.generators.set(generator.proposalType, generator);
  }

  /**
   * Get a generator by proposal type.
   */
  getGenerator(type: AiProposalType): AiProposalGenerator | undefined {
    return this.generators.get(type);
  }

  /**
   * Generate a proposal using the appropriate generator.
   */
  async generate(type: AiProposalType, input: ProposalGeneratorInput): Promise<ProposalGeneratorOutput> {
    const generator = this.generators.get(type);
    if (!generator) {
      throw new Error(`No generator registered for proposal type '${type}'`);
    }
    return generator.generate(input);
  }

  /**
   * List all registered proposal types.
   */
  getRegisteredTypes(): AiProposalType[] {
    return Array.from(this.generators.keys());
  }

  /**
   * Check if a proposal type is registered.
   */
  isRegistered(type: string): boolean {
    return this.generators.has(type as AiProposalType);
  }

  /**
   * Detect proposal type from user message.
   * Returns the most likely proposal type or null if no match.
   */
  detectProposalIntent(message: string): AiProposalType | null {
    const lower = message.toLowerCase();

    // Arabic and English intent detection for proposals
    if (this.matchesAny(lower, ['اقترح قيد', 'propose journal', 'suggest journal entry', 'مسودة قيد', 'draft journal', 'قيد مقترح'])) {
      return 'accounting.journalEntryProposal';
    }
    if (this.matchesAny(lower, ['اقترح تصحيح', 'propose correction', 'correction entry', 'قيد تصحيح'])) {
      return 'accounting.correctionEntryProposal';
    }
    if (this.matchesAny(lower, ['اقترح حساب', 'suggest account', 'propose account mapping', 'حساب مناسب', 'أي حساب'])) {
      return 'accounting.accountMappingProposal';
    }
    if (this.matchesAny(lower, ['مسودة سند', 'draft voucher', 'propose voucher', 'اقترح سند'])) {
      return 'accounting.voucherDraft';
    }
    if (this.matchesAny(lower, ['اقترح إعادة طلب', 'suggest reorder', 'propose reorder', 'إعادة طلب المخزون', 'reorder proposal'])) {
      return 'inventory.reorderProposal';
    }
    if (this.matchesAny(lower, ['اقترح متابعة تحصيل', 'follow up collection', 'collection follow', 'متابعة تحصيل'])) {
      return 'sales.collectionFollowUpProposal';
    }
    if (this.matchesAny(lower, ['insight', 'management insight', 'توصية', 'رؤية إدارية'])) {
      return 'reports.managementInsightProposal';
    }

    return null;
  }

  private matchesAny(message: string, patterns: string[]): boolean {
    return patterns.some(p => message.includes(p));
  }
}
