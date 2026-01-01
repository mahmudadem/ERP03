import { AccountingPolicyConfig } from './PostingPolicyTypes';

/**
 * Approval Policy V1 - Gate Evaluation Result
 */
export interface ApprovalGateResult {
  /** If true, FA gate is required for this voucher */
  financialApprovalRequired: boolean;
  
  /** If true, CC gate is required for this voucher */
  custodyConfirmationRequired: boolean;
  
  /** List of custodian user IDs that must confirm (when CC is required) */
  requiredCustodians: string[];
  
  /** Current operating mode (A/B/C/D) */
  mode: 'A' | 'B' | 'C' | 'D';
  
  /** Human-readable mode description */
  modeDescription: string;
}

/**
 * Account metadata relevant to approval policy decisions
 */
export interface AccountApprovalMetadata {
  accountId: string;
  requiresApproval: boolean;
  requiresCustodyConfirmation: boolean;
  custodianUserId?: string;
}

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
export class ApprovalPolicyService {
  
  /**
   * Get the current operating mode based on company config
   */
  getOperatingMode(config: AccountingPolicyConfig): 'A' | 'B' | 'C' | 'D' {
    const fa = config.financialApprovalEnabled;
    const cc = config.custodyConfirmationEnabled;
    
    if (!fa && !cc) return 'A';
    if (!fa && cc) return 'B';
    if (fa && !cc) return 'C';
    return 'D';
  }
  
  /**
   * Evaluate which gates are required for a voucher
   * 
   * @param config Company's approval policy configuration
   * @param touchedAccounts List of accounts involved in the voucher
   * @returns Gate evaluation result
   */
  evaluateGates(
    config: AccountingPolicyConfig,
    touchedAccounts: AccountApprovalMetadata[]
  ): ApprovalGateResult {
    const mode = this.getOperatingMode(config);
    
    // V1 Behavior:
    // - FA: When enabled, ALL vouchers require approval (company-wide enforcement)
    // - CC: Only triggered for accounts with requiresCustodyConfirmation=true (account-level)
    const needsFA = config.financialApprovalEnabled;  // V1: All vouchers when ON
    
    const needsCC = config.custodyConfirmationEnabled &&
      touchedAccounts.some(acc => acc.requiresCustodyConfirmation);
    
    // Collect ALL unique custodians (V1 policy: ALL must confirm)
    const requiredCustodians = config.custodyConfirmationEnabled
      ? [...new Set(
          touchedAccounts
            .filter(acc => acc.requiresCustodyConfirmation && acc.custodianUserId)
            .map(acc => acc.custodianUserId!)
        )]
      : [];
    
    // Mode descriptions for UI
    const modeDescriptions: Record<string, string> = {
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
  shouldAutoApprove(gateResult: ApprovalGateResult): boolean {
    return !gateResult.financialApprovalRequired && !gateResult.custodyConfirmationRequired;
  }
  
  /**
   * Check if a voucher can be finalized (all gates satisfied)
   * 
   * @param pendingFinancialApproval Is FA gate still pending?
   * @param pendingCustodyConfirmations List of custodians who haven't confirmed
   */
  canFinalize(
    pendingFinancialApproval: boolean,
    pendingCustodyConfirmations: string[]
  ): boolean {
    return !pendingFinancialApproval && pendingCustodyConfirmations.length === 0;
  }
  
  /**
   * Get completion status text for UI
   */
  getCompletionStatus(
    pendingFinancialApproval: boolean,
    pendingCustodyConfirmations: string[],
    faRequired: boolean,
    ccRequired: boolean
  ): string {
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
