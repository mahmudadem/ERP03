/**
 * ReceiptPaymentValidator - For Receipt and Payment Vouchers
 * 
 * Layer 1 (Structural):
 * - Must have header account (depositToAccountId for Receipt, payFromAccountId for Payment)
 * - Must have at least 1 line with amount
 * 
 * Layer 2 (Business Rules):
 * - requirePositiveAmount: Amount must be > 0
 * - negativeCashPrevention: Cannot have negative cash balance
 * 
 * Layer 3 (System Warnings):
 * - Large amount threshold exceeded
 * - Unusual payment method
 */

import { DocumentValidator } from './DocumentValidator';
import { StructuralResult, BusinessResult, SystemWarningResult } from './types';

export class ReceiptPaymentValidator extends DocumentValidator {
  private voucherType: 'receipt' | 'payment';

  constructor(
    definition: any,
    formData: any,
    businessRules?: any,
    voucherType?: 'receipt' | 'payment'
  ) {
    super(definition, formData, businessRules);
    this.voucherType = voucherType || this.detectVoucherType();
  }

  private detectVoucherType(): 'receipt' | 'payment' {
    const code = (this.definition.code || '').toLowerCase();
    const baseType = (this.definition.baseType || '').toLowerCase();
    const type = (this.formData?.type || '').toLowerCase();
    
    if (code.includes('receipt') || baseType.includes('receipt') || type.includes('receipt')) {
      return 'receipt';
    }
    return 'payment';
  }

  validateStructure(): StructuralResult {
    const errors: string[] = [];
    const lines = this.getLines();

    // Rule 1: Must have header account
    const headerAccountField = this.voucherType === 'receipt' 
      ? 'depositToAccountId' 
      : 'payFromAccountId';
    
    const hasHeaderAccount = this.hasField(headerAccountField) || this.hasField('accountId');
    if (!hasHeaderAccount) {
      errors.push(
        this.voucherType === 'receipt' 
          ? 'Deposit account is required' 
          : 'Payment account is required'
      );
    }

    // Rule 2: Must have at least 1 line with amount
    if (lines.length === 0) {
      errors.push('At least 1 line item is required');
    }

    // Rule 3: Lines must have amount
    if (lines.length > 0) {
      const validLines = lines.filter((l) => {
        const hasAccount = !!(l.receiveFromAccountId || l.payToAccountId || l.accountId || l.account);
        const hasAmount = Number(l.amount) > 0;
        return hasAccount && hasAmount;
      });

      if (validLines.length === 0) {
        errors.push('Line items must have an account and amount');
      }
    }

    return { isValid: errors.length === 0, errors };
  }

  generateWarnings(): SystemWarningResult {
    const warnings: string[] = [];
    const total = this.calculateTotal();

    // Warning: Large amount threshold (configurable per company)
    const largeAmountThreshold = 100000; // Default threshold
    if (total > largeAmountThreshold) {
      warnings.push(`Large amount: ${total.toLocaleString()} exceeds threshold of ${largeAmountThreshold.toLocaleString()}`);
    }

    // Warning: Unusual payment method (if metadata contains comparison data)
    const paymentMethod = this.formData?.paymentMethod;
    if (paymentMethod && this.formData?.metadata?.isUnusualPaymentMethod) {
      warnings.push(`Unusual payment method: ${paymentMethod}`);
    }

    // Warning: First transaction with this party
    const isFirstTransaction = this.formData?.metadata?.isFirstTransactionWithParty;
    if (isFirstTransaction) {
      warnings.push('First transaction with this party');
    }

    return { warnings };
  }

  protected checkRequirePositiveTotal(): boolean {
    const total = this.calculateTotal();
    return total <= 0;
  }
}
