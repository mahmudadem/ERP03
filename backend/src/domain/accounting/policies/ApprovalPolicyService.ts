import { AccountingPolicyConfig } from './PostingPolicyTypes';
import { AccountClassification } from '../entities/Account';

/**
 * Approval Policy V2 - Smart Gate Evaluation Result
 */
export interface ApprovalGateResult {
  /** If true, FA gate is required for this voucher */
  financialApprovalRequired: boolean;
  
  /** If true, CC gate is required for this voucher */
  custodyConfirmationRequired: boolean;
  
  /** List of custodian user IDs that must confirm (when CC is required) */
  requiredCustodians: string[];
  
  /** List of custodians to notify (but not require confirmation) */
  notifyOnlyCustodians: string[];
  
  /** Current operating mode (A/B/C/D) */
  mode: 'A' | 'B' | 'C' | 'D';
  
  /** Human-readable mode description */
  modeDescription: string;

  /** Accounts needing CC but missing custodian assignment */
  missingCustodianAccounts?: string[];
}

/**
 * Account metadata relevant to approval policy decisions
 * V2: Now includes classification and line context
 */
export interface AccountApprovalMetadata {
  accountId: string;
  classification: AccountClassification;
  requiresApproval: boolean;
  requiresCustodyConfirmation: boolean;
  custodianUserId?: string;
}

/**
 * Voucher line context for Smart CC evaluation
 */
export interface VoucherLineContext {
  accountId: string;
  debitAmount: number;
  creditAmount: number;
}

/**
 * Smart CC Evaluation Context
 */
export interface SmartCCContext {
  creatorUserId: string;
  voucherTotal: number;
  lines: VoucherLineContext[];
  isReversal?: boolean;
}

/**
 * Approval Policy V2 - Smart Gate Evaluation Service
 * 
 * Implements the four operating modes:
 * - Mode A: FA=OFF, CC=OFF → Auto-post (no gates)
 * - Mode B: FA=OFF, CC=ON  → Custody confirmation only
 * - Mode C: FA=ON,  CC=OFF → Financial approval only
 * - Mode D: FA=ON,  CC=ON  → Both gates required
 * 
 * Smart CC Logic (V2):
 * - Only RECEIVING-side (DEBIT) custodians of ASSET accounts require confirmation
 * - Self-admission: If creator is the receiver, no CC needed (configurable)
 * - Third-party vouchers: Optionally require both sides (configurable)
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
   * Evaluate which gates are required for a voucher (Legacy API - delegates to Smart CC)
   * 
   * @param config Company's approval policy configuration
   * @param touchedAccounts List of accounts involved in the voucher
   * @returns Gate evaluation result
   */
  evaluateGates(
    config: AccountingPolicyConfig,
    touchedAccounts: AccountApprovalMetadata[]
  ): ApprovalGateResult {
    // Legacy fallback: Build minimal context and delegate to Smart CC
    const context: SmartCCContext = {
      creatorUserId: '', // Unknown in legacy API
      voucherTotal: 0,
      lines: touchedAccounts.map(acc => ({
        accountId: acc.accountId,
        debitAmount: 1, // Assume all are debit for legacy
        creditAmount: 0
      }))
    };
    return this.evaluateSmartGates(config, touchedAccounts, context);
  }

  /**
   * Evaluate gates using Smart CC logic (V2)
   * 
   * @param config Company's approval policy configuration
   * @param accountsMap Map of account metadata by accountId
   * @param context Voucher context including lines and creator
   * @returns Gate evaluation result
   */
  evaluateSmartGates(
    config: AccountingPolicyConfig,
    accounts: AccountApprovalMetadata[],
    context: SmartCCContext
  ): ApprovalGateResult {
    const mode = this.getOperatingMode(config);
    const accountsMap = new Map(accounts.map(a => [a.accountId, a]));
    
    // === FA Gate Logic ===
    const needsFA = config.financialApprovalEnabled && (
      config.faApplyMode === 'ALL' || 
      accounts.some(acc => acc.requiresApproval)
    );
    
    // === Smart CC Gate Logic ===
    const requiredCustodians = new Set<string>();
    const notifyOnlyCustodians = new Set<string>();
    const missingCustodianAccounts: string[] = [];
    
    // Settings with defaults
    const thirdPartyMode = config.ccThirdPartyMode || 'RECEIVER_ONLY';
    const amountThreshold = config.ccAmountThreshold || 0;
    const allowSelfConfirmation = config.ccAllowSelfConfirmation ?? false;
    const blockIfNoCustodian = config.ccBlockIfNoCustodian ?? true;
    const reversalMode = config.ccReversalMode || 'SAME_AS_ORIGINAL';
    
    // Skip CC if reversal and AUTO_APPROVE mode
    if (context.isReversal && reversalMode === 'AUTO_APPROVE') {
      return this.buildResult(mode, needsFA, false, [], [], []);
    }
    
    // Skip CC if below threshold
    if (amountThreshold > 0 && context.voucherTotal < amountThreshold) {
      return this.buildResult(mode, needsFA, false, [], [], []);
    }
    
    // Skip CC if globally disabled
    if (!config.custodyConfirmationEnabled) {
      return this.buildResult(mode, needsFA, false, [], [], []);
    }
    
    // Process each line
    for (const line of context.lines) {
      const account = accountsMap.get(line.accountId);
      if (!account) continue;
      
      // Rule 1: Only ASSET accounts with CC enabled
      if (account.classification !== 'ASSET') continue;
      if (!account.requiresCustodyConfirmation) continue;
      
      const isReceiving = line.debitAmount > 0;
      const isReleasing = line.creditAmount > 0;
      const custodian = account.custodianUserId;
      // Case-insensitive check to avoid issues with different ID sources
      const isCreatorTheCustodian = custodian?.toLowerCase() === context.creatorUserId.toLowerCase();
      
      // Check for missing custodian
      if (!custodian) {
        if (blockIfNoCustodian) {
          missingCustodianAccounts.push(line.accountId);
        }
        continue;
      }
      
      if (isReceiving) {
        // RECEIVING side (Debit)
        if (isCreatorTheCustodian && !allowSelfConfirmation) {
          // Self-admission: creator admits receiving, no CC needed
          continue;
        }
        requiredCustodians.add(custodian);
      } else if (isReleasing) {
        // RELEASING side (Credit)
        if (thirdPartyMode === 'BOTH' && !isCreatorTheCustodian) {
          // Third-party voucher: require releasing custodian too
          requiredCustodians.add(custodian);
        } else if (!isCreatorTheCustodian) {
          // Notify only (they're not required to confirm)
          notifyOnlyCustodians.add(custodian);
        }
      }
    }
    
    // Remove notify-only if already in required
    for (const custodian of requiredCustodians) {
      notifyOnlyCustodians.delete(custodian);
    }
    
    const needsCC = requiredCustodians.size > 0;
    
    return this.buildResult(
      mode,
      needsFA,
      needsCC,
      [...requiredCustodians],
      [...notifyOnlyCustodians],
      missingCustodianAccounts
    );
  }

  private buildResult(
    mode: 'A' | 'B' | 'C' | 'D',
    needsFA: boolean,
    needsCC: boolean,
    requiredCustodians: string[],
    notifyOnlyCustodians: string[],
    missingCustodianAccounts: string[]
  ): ApprovalGateResult {
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
      notifyOnlyCustodians,
      mode,
      modeDescription: modeDescriptions[mode],
      missingCustodianAccounts: missingCustodianAccounts.length > 0 ? missingCustodianAccounts : undefined
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
