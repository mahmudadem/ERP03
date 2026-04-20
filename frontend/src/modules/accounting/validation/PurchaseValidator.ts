/**
 * PurchaseValidator - For Purchase Invoice, Purchase Order, Goods Receipt, Purchase Return
 * 
 * Layer 1 (Structural):
 * - Must have partyId/vendorId
 * - Must have at least 1 line item
 * - Each line must have item/service + quantity or amount
 * 
 * Layer 2 (Business Rules):
 * - requirePositiveTotal: Total must be > 0
 * - requireWarehouse: Warehouse is required for line items
 * - vendorApprovalStatus: Vendor must be approved
 * 
 * Layer 3 (System Warnings):
 * - Vendor inactive for 90+ days
 * - Price higher than last purchase
 * - Duplicate invoice number check
 */

import { DocumentValidator } from './DocumentValidator';
import { StructuralResult, BusinessResult, SystemWarningResult } from './types';

export class PurchaseValidator extends DocumentValidator {
  validateStructure(): StructuralResult {
    const errors: string[] = [];
    const lines = this.getLines();

    // Rule 1: Must have a vendor/party
    const hasVendor = this.hasField('vendorId') || this.hasField('partyId');
    if (!hasVendor) {
      errors.push('Vendor is required');
    }

    // Rule 2: Must have at least 1 line item
    if (lines.length === 0) {
      errors.push('At least 1 line item is required');
    }

    // Rule 3: Each line must have an item/service and quantity or amount
    if (lines.length > 0) {
      const validLines = lines.filter((l) => {
        const hasItem = !!(l.itemId || l.serviceId || l.description || l.product);
        const hasQty = Number(l.quantity) > 0;
        const hasAmount = Number(l.amount) > 0 || Number(l.lineTotal) > 0;
        return hasItem && (hasQty || hasAmount);
      });

      if (validLines.length === 0) {
        errors.push('Line items must have an item/service and quantity or amount');
      }
    }

    return { isValid: errors.length === 0, errors };
  }

  generateWarnings(): SystemWarningResult {
    const warnings: string[] = [];
    const lines = this.getLines();

    // Warning: Vendor inactive (if vendorId present and has lastOrderDate)
    const vendorId = this.formData?.vendorId || this.formData?.partyId;
    const lastOrderDate = this.formData?.vendorLastOrderDate;
    
    if (vendorId && lastOrderDate) {
      const daysSinceLastOrder = this.getDaysSince(lastOrderDate);
      if (daysSinceLastOrder > 90) {
        warnings.push(`Vendor inactive for ${daysSinceLastOrder} days`);
      }
    }

    // Warning: Price higher than last purchase (if metadata contains comparison data)
    const priceIncreases = lines.filter((l) => {
      const currentPrice = Number(l.unitPrice || 0);
      const lastPrice = Number(l.lastPurchasePrice || l.metadata?.lastPurchasePrice || 0);
      return currentPrice > 0 && lastPrice > 0 && currentPrice > lastPrice * 1.1; // > 10% increase
    });

    if (priceIncreases.length > 0) {
      warnings.push(`${priceIncreases.length} item(s) priced higher than last purchase`);
    }

    // Warning: Duplicate invoice number check (if invoiceNumber present)
    const invoiceNumber = this.formData?.invoiceNumber || this.formData?.supplierInvoiceNo;
    if (invoiceNumber && this.formData?.metadata?.isDuplicateInvoice) {
      warnings.push(`Invoice number ${invoiceNumber} may be a duplicate`);
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
