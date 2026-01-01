"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApprovalPolicyService = void 0;
/**
 * Approval Policy V1 - Static Gate Evaluation Service
 *
 * Implements the four operating modes:
 * - Mode A: FA=OFF, CC=OFF → Auto-post (no gates)
 * - Mode B: FA=OFF, CC=ON  → Custody confirmation only
 * - Mode C: FA=ON,  CC=OFF → Financial approval only
 * - Mode D: FA=ON,  CC=ON  → Both gates required
 *
 * HARD POLICY:
 * - Posting WILL NOT occur until ALL enabled gates are satisfied.
 * - No exceptions. No partial posting.
 */
class ApprovalPolicyService {
    /**
     * Get the current operating mode based on company config
     */
    getOperatingMode(config) {
        const fa = config.financialApprovalEnabled;
        const cc = config.custodyConfirmationEnabled;
        if (!fa && !cc)
            return 'A';
        if (!fa && cc)
            return 'B';
        if (fa && !cc)
            return 'C';
        return 'D';
    }
    /**
     * Evaluate which gates are required for a voucher
     *
     * @param config Company's approval policy configuration
     * @param touchedAccounts List of accounts involved in the voucher
     * @returns Gate evaluation result
     */
    evaluateGates(config, touchedAccounts) {
        const mode = this.getOperatingMode(config);
        // FA gate logic based on faApplyMode:
        // - 'ALL': When FA is ON, ALL vouchers require approval
        // - 'MARKED_ONLY': Only vouchers touching accounts with requiresApproval=true
        const needsFA = config.financialApprovalEnabled && (config.faApplyMode === 'ALL' ||
            touchedAccounts.some(acc => acc.requiresApproval));
        // CC: Only triggered for accounts with requiresCustodyConfirmation=true (account-level)
        const needsCC = config.custodyConfirmationEnabled &&
            touchedAccounts.some(acc => acc.requiresCustodyConfirmation);
        // Collect ALL unique custodians (V1 policy: ALL must confirm)
        const requiredCustodians = config.custodyConfirmationEnabled
            ? [...new Set(touchedAccounts
                    .filter(acc => acc.requiresCustodyConfirmation && acc.custodianUserId)
                    .map(acc => acc.custodianUserId))]
            : [];
        // Mode descriptions for UI
        const modeDescriptions = {
            'A': 'Auto-Post (No gates)',
            'B': 'Custody Confirmation Only',
            'C': 'Financial Approval Only',
            'D': 'Full Dual-Gate (FA + CC)'
        };
        return {
            financialApprovalRequired: needsFA,
            custodyConfirmationRequired: needsCC,
            requiredCustodians,
            mode,
            modeDescription: modeDescriptions[mode]
        };
    }
    /**
     * Check if a voucher should go directly to APPROVED (Mode A or no gates triggered)
     */
    shouldAutoApprove(gateResult) {
        return !gateResult.financialApprovalRequired && !gateResult.custodyConfirmationRequired;
    }
    /**
     * Check if a voucher can be finalized (all gates satisfied)
     *
     * @param pendingFinancialApproval Is FA gate still pending?
     * @param pendingCustodyConfirmations List of custodians who haven't confirmed
     */
    canFinalize(pendingFinancialApproval, pendingCustodyConfirmations) {
        return !pendingFinancialApproval && pendingCustodyConfirmations.length === 0;
    }
    /**
     * Get completion status text for UI
     */
    getCompletionStatus(pendingFinancialApproval, pendingCustodyConfirmations, faRequired, ccRequired) {
        // No gates required
        if (!faRequired && !ccRequired) {
            return 'Ready to Post';
        }
        // FA still pending
        if (faRequired && pendingFinancialApproval) {
            return 'Awaiting Financial Approval';
        }
        // FA done, CC pending
        if (ccRequired && pendingCustodyConfirmations.length > 0) {
            if (faRequired && !pendingFinancialApproval) {
                return `Approved by Management, Awaiting Custody (${pendingCustodyConfirmations.length} pending)`;
            }
            return `Awaiting Custody Confirmation (${pendingCustodyConfirmations.length} pending)`;
        }
        // All gates satisfied
        return 'All Gates Satisfied';
    }
}
exports.ApprovalPolicyService = ApprovalPolicyService;
//# sourceMappingURL=ApprovalPolicyService.js.map