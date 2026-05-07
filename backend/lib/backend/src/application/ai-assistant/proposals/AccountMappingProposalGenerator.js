"use strict";
/**
 * AccountMappingProposalGenerator
 *
 * Suggests an appropriate account code/name for a transaction or imported row.
 * Uses the chart of accounts summary from tool results.
 *
 * This is NOT a real account assignment. It is a sandbox proposal.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccountMappingProposalGenerator = void 0;
const AiProposalGenerator_1 = require("./AiProposalGenerator");
class AccountMappingProposalGenerator extends AiProposalGenerator_1.AiProposalGenerator {
    constructor() {
        super(...arguments);
        this.proposalType = 'accounting.accountMappingProposal';
        this.moduleId = 'accounting';
        this.requiredPermissions = ['ai-assistant.proposals.create'];
    }
    async generate(input) {
        const warnings = [];
        const missingInfo = [];
        const toolData = input.toolResultData || {};
        // Extract the description of the transaction/row
        const description = input.userMessage;
        // Try to find matching accounts from tool data
        const suggestedAccount = this.findSuggestedAccount(description, toolData);
        const alternatives = this.findAlternatives(description, toolData);
        if (!suggestedAccount) {
            missingInfo.push('transaction description for account mapping (وصف العملية)');
            warnings.push('Could not find a matching account. Provide more detail about the transaction type.');
        }
        const confidence = suggestedAccount ? (alternatives.length > 1 ? 0.7 : 0.5) : 0.1;
        const riskLevel = suggestedAccount ? 'low' : 'medium';
        return {
            type: this.proposalType,
            title: suggestedAccount
                ? `Account Mapping: ${suggestedAccount.name}`
                : 'Account Mapping Proposal (No Match Found)',
            summary: suggestedAccount
                ? `Suggested account: ${suggestedAccount.code} — ${suggestedAccount.name} for "${description.substring(0, 50)}"`
                : `No matching account found for "${description.substring(0, 50)}"`,
            rationale: suggestedAccount
                ? `Based on the description "${description.substring(0, 100)}", this account is the most appropriate match from your chart of accounts.`
                : 'No account could be automatically matched. Please review your chart of accounts and select manually.',
            inputContextSummary: description.substring(0, 200),
            proposedData: {
                suggestedAccount: suggestedAccount || null,
                alternatives: alternatives.slice(0, 5),
                description: description.substring(0, 200),
                note: 'This is a suggestion only. No account assignment has been made.',
            },
            warnings,
            riskLevel,
            moduleId: this.moduleId,
            requiredPermissions: this.requiredPermissions,
            missingInfo,
            confidence,
        };
    }
    findSuggestedAccount(description, toolData) {
        const accounts = toolData.accounts;
        if (!accounts || !Array.isArray(accounts) || accounts.length === 0)
            return null;
        const lower = description.toLowerCase();
        // Simple keyword matching against account names
        const keywords = {
            'cash': ['cash', 'نقد', 'صندوق', 'petty cash'],
            'sales': ['sales', 'مبيعات', 'إيراد', 'revenue'],
            'purchases': ['purchases', 'مشتريات', 'مستلزمات'],
            'receivable': ['receivable', 'مدين', 'عملاء', 'customers'],
            'payable': ['payable', 'دائن', 'موردين', 'suppliers'],
            'inventory': ['inventory', 'مخزون', 'بضاعة'],
            'expense': ['expense', 'مصروف', 'مصاريف'],
            'bank': ['bank', 'بنك', 'حساب بنكي'],
        };
        for (const [category, words] of Object.entries(keywords)) {
            if (words.some(w => lower.includes(w))) {
                const match = accounts.find((a) => (a.name || '').toLowerCase().includes(category) ||
                    (a.code || '').startsWith(this.getCategoryPrefix(category)));
                if (match)
                    return { code: match.code, name: match.name, type: match.type || '' };
            }
        }
        // Fallback: first account
        return { code: accounts[0].code || '', name: accounts[0].name || '', type: accounts[0].type || '' };
    }
    findAlternatives(description, toolData) {
        const accounts = toolData.accounts;
        if (!accounts || !Array.isArray(accounts))
            return [];
        return accounts.slice(0, 5).map((a) => ({
            code: a.code || '',
            name: a.name || '',
            type: a.type || '',
        }));
    }
    getCategoryPrefix(category) {
        const prefixes = {
            'cash': '1',
            'receivable': '1',
            'inventory': '1',
            'bank': '1',
            'payable': '2',
            'sales': '4',
            'purchases': '5',
            'expense': '5',
        };
        return prefixes[category] || '';
    }
}
exports.AccountMappingProposalGenerator = AccountMappingProposalGenerator;
//# sourceMappingURL=AccountMappingProposalGenerator.js.map