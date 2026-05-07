"use strict";
/**
 * AiProposalGeneratorRegistry
 *
 * Routes proposal generation requests to the appropriate generator.
 * Enforces that only registered, controlled generators can create proposals.
 * The AI cannot create arbitrary JSON — only registered generators produce proposedData.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiProposalGeneratorRegistry = void 0;
const JournalEntryProposalGenerator_1 = require("./JournalEntryProposalGenerator");
const CorrectionEntryProposalGenerator_1 = require("./CorrectionEntryProposalGenerator");
const AccountMappingProposalGenerator_1 = require("./AccountMappingProposalGenerator");
const ReorderProposalGenerator_1 = require("./ReorderProposalGenerator");
const CollectionFollowUpProposalGenerator_1 = require("./CollectionFollowUpProposalGenerator");
const VoucherDraftProposalGenerator_1 = require("./VoucherDraftProposalGenerator");
const ManagementInsightProposalGenerator_1 = require("./ManagementInsightProposalGenerator");
class AiProposalGeneratorRegistry {
    constructor() {
        this.generators = new Map();
        // Register all proposal generators
        this.register(new JournalEntryProposalGenerator_1.JournalEntryProposalGenerator());
        this.register(new CorrectionEntryProposalGenerator_1.CorrectionEntryProposalGenerator());
        this.register(new AccountMappingProposalGenerator_1.AccountMappingProposalGenerator());
        this.register(new ReorderProposalGenerator_1.ReorderProposalGenerator());
        this.register(new CollectionFollowUpProposalGenerator_1.CollectionFollowUpProposalGenerator());
        this.register(new VoucherDraftProposalGenerator_1.VoucherDraftProposalGenerator());
        this.register(new ManagementInsightProposalGenerator_1.ManagementInsightProposalGenerator());
    }
    register(generator) {
        this.generators.set(generator.proposalType, generator);
    }
    /**
     * Get a generator by proposal type.
     */
    getGenerator(type) {
        return this.generators.get(type);
    }
    /**
     * Generate a proposal using the appropriate generator.
     */
    async generate(type, input) {
        const generator = this.generators.get(type);
        if (!generator) {
            throw new Error(`No generator registered for proposal type '${type}'`);
        }
        return generator.generate(input);
    }
    /**
     * List all registered proposal types.
     */
    getRegisteredTypes() {
        return Array.from(this.generators.keys());
    }
    /**
     * Check if a proposal type is registered.
     */
    isRegistered(type) {
        return this.generators.has(type);
    }
    /**
     * Detect proposal type from user message.
     * Returns the most likely proposal type or null if no match.
     */
    detectProposalIntent(message) {
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
    matchesAny(message, patterns) {
        return patterns.some(p => message.includes(p));
    }
}
exports.AiProposalGeneratorRegistry = AiProposalGeneratorRegistry;
//# sourceMappingURL=AiProposalGeneratorRegistry.js.map