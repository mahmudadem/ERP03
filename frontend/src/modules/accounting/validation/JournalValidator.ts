/**
 * JournalValidator - For Journal Entry, FX Revaluation, Opening Balance
 * 
 * Layer 1 (Structural):
 * - At least 2 lines with debit/credit
 * - Each line must have accountId + (debit > 0 OR credit > 0)
 * 
 * Layer 2 (Business Rules):
 * - requireBalancedEntries: Debit total must equal Credit total (configurable tolerance)
 * 
 * Layer 3 (System Warnings):
 * - Single-sided entries (all debit or all credit)
 * - Unusual round amounts
 */

import { DocumentValidator } from './DocumentValidator';
import { StructuralResult, BusinessResult, SystemWarningResult, RuleOutcome } from './types';

export class JournalValidator extends DocumentValidator {
  validateStructure(): StructuralResult {
    const errors: string[] = [];
    const lines = this.getLines();

    // Rule 1: Must have at least 2 lines
    if (lines.length < 2) {
      errors.push('Journal entry must have at least 2 lines');
      return { isValid: false, errors };
    }

    // Rule 2: Each line must have an account and an amount
    const validLines = lines.filter((l) => {
      const hasAccount = !!(l.accountId || l.account);
      const hasDebit = Number(l.debit) > 0;
      const hasCredit = Number(l.credit) > 0;
      const hasSideAmount = Number(l.amount) > 0 && ['debit', 'credit'].includes(String(l.side || '').toLowerCase());
      const hasAmount = hasDebit || hasCredit || hasSideAmount;
      return hasAccount && hasAmount;
    });

    if (validLines.length < 2) {
      errors.push('At least 2 lines with account and amount are required');
    }

    return { isValid: errors.length === 0, errors };
  }

  validateBusiness(): BusinessResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const passed: string[] = [];

    // Rule: requireBalancedEntries (Debit = Credit)
    const balanceRule = this.businessRules?.requireBalancedEntries;
    if (balanceRule?.enabled) {
      const { debitTotal, creditTotal, isBalanced } = this.calculateDebitCredit();
      
      if (!isBalanced) {
        const tolerance = (balanceRule as any).tolerance || 0.05;
        const difference = Math.abs(debitTotal - creditTotal);
        
        if (difference > tolerance) {
          const outcome = balanceRule.outcome || RuleOutcome.BLOCK;
          const message = balanceRule.errorMessage || `Journal is not balanced. Difference: ${difference.toFixed(2)}`;
          
          if (outcome === RuleOutcome.BLOCK || outcome === RuleOutcome.BLOCK_AND_WARN) {
            errors.push(message);
          }
          if (outcome === RuleOutcome.ALLOW_WITH_WARN || outcome === RuleOutcome.BLOCK_AND_WARN) {
            warnings.push(message);
          }
        } else {
          passed.push('requireBalancedEntries');
        }
      } else {
        passed.push('requireBalancedEntries');
      }
    }

    return { errors, warnings, passed };
  }

  generateWarnings(): SystemWarningResult {
    const warnings: string[] = [];
    const lines = this.getLines();

    // Warning: Single-sided entry (all debit or all credit)
    const hasDebit = lines.some((l) => Number(l.debit) > 0 || (String(l.side || '').toLowerCase() === 'debit' && Number(l.amount) > 0));
    const hasCredit = lines.some((l) => Number(l.credit) > 0 || (String(l.side || '').toLowerCase() === 'credit' && Number(l.amount) > 0));
    
    if (hasDebit && !hasCredit) {
      warnings.push('All lines are debits - consider adding a credit line');
    } else if (hasCredit && !hasDebit) {
      warnings.push('All lines are credits - consider adding a debit line');
    }

    // Warning: Unusual round amounts (possible data entry error)
    const { debitTotal, creditTotal } = this.calculateDebitCredit();
    const isPerfectlyRound = (amount: number) => amount > 0 && amount === Math.floor(amount);
    
    if (isPerfectlyRound(debitTotal) && debitTotal >= 10000) {
      warnings.push(`Debit total is a round amount (${debitTotal.toLocaleString()}) - please verify`);
    }
    if (isPerfectlyRound(creditTotal) && creditTotal >= 10000) {
      warnings.push(`Credit total is a round amount (${creditTotal.toLocaleString()}) - please verify`);
    }

    return { warnings };
  }

  private calculateDebitCredit(): { debitTotal: number; creditTotal: number; isBalanced: boolean } {
    const lines = this.getLines();
    let debitTotal = 0;
    let creditTotal = 0;

    lines.forEach((l) => {
      const debit = Number(l.debit) || 0;
      const credit = Number(l.credit) || 0;
      const amount = Number(l.amount) || 0;
      const side = String(l.side || '').toLowerCase();

      debitTotal += debit || (side === 'debit' ? amount : 0);
      creditTotal += credit || (side === 'credit' ? amount : 0);
    });

    const tolerance = 0.05;
    const isBalanced = Math.abs(debitTotal - creditTotal) < tolerance;

    return { debitTotal, creditTotal, isBalanced };
  }
}
