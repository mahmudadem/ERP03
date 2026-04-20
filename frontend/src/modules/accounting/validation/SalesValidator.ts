/**
 * SalesValidator - For Sales Invoice, Sales Order, Sales Return, Delivery Note
 * 
 * Layer 1 (Structural):
 * - Must have partyId/customerId
 * - Must have at least 1 line item
 * - Each line must have item/service + quantity or amount
 * 
 * Layer 2 (Business Rules):
 * - requirePositiveTotal: Total must be > 0
 * - preventBelowCost: Items cannot be priced below cost
 * - enforceCreditLimit: Customer credit limit check
 * - requireWarehouse: Warehouse is required for line items
 * 
 * Layer 3 (System Warnings):
 * - Below cost items (always shown, regardless of Layer 2 setting)
 * - Low margin items (< 5% margin)
 * - Customer inactive for 90+ days
 */

import { DocumentValidator } from './DocumentValidator';
import { StructuralResult, BusinessResult, SystemWarningResult } from './types';

export class SalesValidator extends DocumentValidator {
  validateStructure(): StructuralResult {
    const errors: string[] = [];
    const lines = this.getLines();
    const formData = this.formData;

    // Rule 1: Must have a customer/party (check multiple possible field names)
    const hasCustomer = 
      this.hasField('customerId') || 
      this.hasField('partyId') ||
      this.hasField('customer') ||
      this.hasField('customerName') ||
      !!formData?.accountId ||
      !!formData?.account;
    
    if (!hasCustomer) {
      errors.push('Customer is required');
    }

    // Rule 2: Must have at least 1 line item WITH AMOUNT
    // Check all possible amount field names used in sales forms
    const linesWithAmount = lines.filter((l) => {
      // Direct amount fields
      const directAmount = Number(l.amount) > 0 || 
                           Number(l.total) > 0 || 
                           Number(l.lineTotal) > 0 ||
                           Number(l.lineTotalDoc) > 0 ||
                           Number(l.rowTotal) > 0;
      
      // Computed amount: quantity × unitPrice (for sales forms where lineTotal is derived)
      const computedAmount = Number(l.quantity) > 0 && Number(l.unitPrice) > 0;
      
      return directAmount || computedAmount;
    });

    if (linesWithAmount.length === 0) {
      errors.push('At least 1 line with amount > 0 is required');
    }

    return { isValid: errors.length === 0, errors };
  }

  generateWarnings(): SystemWarningResult {
    const warnings: string[] = [];
    const lines = this.getLines();

    // Warning: Below cost items (always shown, independent of Layer 2 rule)
    const belowCostLines = lines.filter((l) => {
      const unitPrice = Number(l.unitPrice || l.price || 0);
      const costPrice = Number(l.costPrice || l.cost || 0);
      return unitPrice > 0 && costPrice > 0 && unitPrice < costPrice;
    });

    if (belowCostLines.length > 0) {
      warnings.push(`${belowCostLines.length} item(s) priced below cost`);
    }

    // Warning: Low margin items (< 5%)
    const lowMarginLines = lines.filter((l) => {
      const unitPrice = Number(l.unitPrice || l.price || 0);
      const costPrice = Number(l.costPrice || l.cost || 0);
      if (unitPrice === 0 || costPrice === 0) return false;
      const margin = (unitPrice - costPrice) / unitPrice;
      return margin < 0.05 && margin >= 0; // Positive but less than 5%
    });

    if (lowMarginLines.length > 0) {
      warnings.push(`${lowMarginLines.length} item(s) have margin below 5%`);
    }

    // Warning: Customer inactive (if customerId present and has lastOrderDate)
    const customerId = this.formData?.customerId || this.formData?.partyId;
    const lastOrderDate = this.formData?.customerLastOrderDate;
    
    if (customerId && lastOrderDate) {
      const daysSinceLastOrder = this.getDaysSince(lastOrderDate);
      if (daysSinceLastOrder > 90) {
        warnings.push(`Customer inactive for ${daysSinceLastOrder} days`);
      }
    }

    return { warnings };
  }

  protected checkRequirePositiveTotal(): boolean {
    const total = this.calculateTotal();
    return total <= 0;
  }

  protected checkRequireWarehouse(): boolean {
    const lines = this.getLines();
    const linesWithoutWarehouse = lines.filter(
      (l) => !l.warehouseId && !l.warehouse
    ).length;
    return linesWithoutWarehouse > 0;
  }

  private getDaysSince(dateString: string): number {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }
}
