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
import { normalizePurchaseDocument } from '../document-runtime/purchases/normalizePurchaseDocument';
import type { NormalizedPurchaseDocument } from '../document-runtime/types';
import { StructuralResult, SystemWarningResult } from './types';

export class PurchaseValidator extends DocumentValidator {
  private runtimeCache?: NormalizedPurchaseDocument;

  private getRuntime(): NormalizedPurchaseDocument {
    if (!this.runtimeCache) {
      this.runtimeCache = normalizePurchaseDocument(this.definition, this.formData);
    }
    return this.runtimeCache;
  }

  validateStructure(): StructuralResult {
    const errors: string[] = [];
    const runtime = this.getRuntime();
    const { profile, header, activeLines } = runtime;

    if (profile.requiresVendor && !header.vendorId) {
      errors.push('Vendor is required');
    }

    if (profile.requiresDate && !header.documentDate) {
      errors.push('Document date is required');
    }

    if (activeLines.length === 0) {
      errors.push('At least 1 line item is required');
    }

    if (profile.requiresLineItem && activeLines.length > 0 && !activeLines.some((line) => !!line.itemId)) {
      errors.push('At least 1 line item is required');
    }

    if (profile.requiresQuantity && activeLines.length > 0 && !activeLines.some((line) => line.quantity > 0)) {
      errors.push('At least 1 line quantity is required');
    }

    if (profile.requiresAmount && activeLines.length > 0 && !activeLines.some((line) => line.amountDoc > 0)) {
      errors.push('At least 1 line with amount > 0 is required');
    }

    const sourceError = this.getSourceError(runtime);
    if (sourceError) errors.push(sourceError);

    const warehouseError = this.getWarehouseError(runtime);
    if (warehouseError) errors.push(warehouseError);

    return { isValid: errors.length === 0, errors };
  }

  generateWarnings(): SystemWarningResult {
    const warnings: string[] = [];
    const { activeLines, header } = this.getRuntime();

    // Warning: Vendor inactive (if vendorId present and has lastOrderDate)
    const vendorId = header.vendorId;
    const lastOrderDate = this.formData?.vendorLastOrderDate;
    
    if (vendorId && lastOrderDate) {
      const daysSinceLastOrder = this.getDaysSince(lastOrderDate);
      if (daysSinceLastOrder > 90) {
        warnings.push(`Vendor inactive for ${daysSinceLastOrder} days`);
      }
    }

    // Warning: Price higher than last purchase (if metadata contains comparison data)
    const priceIncreases = activeLines.filter((l) => {
      const currentPrice = l.unitPriceDoc || l.unitCostDoc;
      const lastPrice = l.lastPurchasePrice || Number(l.raw?.metadata?.lastPurchasePrice || 0);
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
    const runtime = this.getRuntime();
    if (!runtime.profile.requiresAmount) return false;
    return runtime.totals.amountDoc <= 0;
  }

  protected checkRequireWarehouse(): boolean {
    return !!this.getWarehouseError(this.getRuntime());
  }

  protected checkCondition(condition: any): boolean {
    const runtime = this.getRuntime();
    const fieldId = String(condition?.fieldId || '');

    const normalizedHeader: Record<string, any> = {
      vendorId: runtime.header.vendorId,
      supplierId: runtime.header.vendorId,
      partyId: runtime.header.vendorId,
      documentDate: runtime.header.documentDate,
      invoiceDate: runtime.header.invoiceDate,
      warehouseId: runtime.header.warehouseId,
      warehouse: runtime.header.warehouseId,
      currency: runtime.header.currency,
      exchangeRate: runtime.header.exchangeRate,
      purchaseOrderId: runtime.header.purchaseOrderId,
      goodsReceiptId: runtime.header.goodsReceiptId,
      purchaseInvoiceId: runtime.header.purchaseInvoiceId,
      sourceDocumentId: runtime.header.sourceDocumentId,
      totalAmount: runtime.totals.amountDoc || runtime.header.totalAmount,
      amount: runtime.totals.amountDoc,
    };

    if (Object.prototype.hasOwnProperty.call(normalizedHeader, fieldId)) {
      return this.matchesConditionValue(normalizedHeader[fieldId], condition);
    }

    const lineValues = runtime.activeLines
      .map((line) => this.getNormalizedLineValue(line, fieldId))
      .filter((value) => value !== undefined);

    if (lineValues.length > 0) {
      return lineValues.some((value) => this.matchesConditionValue(value, condition));
    }

    return super.checkCondition(condition);
  }

  private getSourceError(runtime: NormalizedPurchaseDocument): string | null {
    if (runtime.profile.sourcePolicy !== 'REQUIRED') return null;

    const hasHeaderSource = !!runtime.header.sourceDocumentId;
    const hasLineSource = runtime.activeLines.some((line) =>
      !!line.sourceLineId || !!line.purchaseOrderId || !!line.goodsReceiptId || !!line.purchaseInvoiceId
    );

    return hasHeaderSource || hasLineSource
      ? null
      : `${runtime.profile.label} requires a source document`;
  }

  private getWarehouseError(runtime: NormalizedPurchaseDocument): string | null {
    const { profile, header, activeLines } = runtime;

    if (profile.warehousePolicy === 'NOT_REQUIRED') return null;

    if (profile.warehousePolicy === 'HEADER_REQUIRED') {
      return header.warehouseId ? null : `Warehouse is required for ${profile.label}`;
    }

    if (profile.warehousePolicy === 'LINE_REQUIRED') {
      const missingCount = activeLines.filter((line) => !line.warehouseId).length;
      return missingCount > 0 ? `${missingCount} line(s) require a warehouse` : null;
    }

    if (profile.warehousePolicy === 'LINE_OR_SOURCE') {
      const missingCount = activeLines.filter((line) => !line.warehouseId && !line.sourceLineId).length;
      return missingCount > 0 ? `${missingCount} line(s) require a warehouse or source line` : null;
    }

    return null;
  }

  private getNormalizedLineValue(line: NormalizedPurchaseDocument['activeLines'][number], fieldId: string): any {
    const values: Record<string, any> = {
      itemId: line.itemId,
      item: line.itemId,
      productId: line.itemId,
      serviceId: line.serviceId,
      description: line.description,
      quantity: line.quantity,
      qty: line.quantity,
      orderedQty: line.quantity,
      receivedQty: line.quantity,
      invoicedQty: line.quantity,
      returnQty: line.quantity,
      unitPrice: line.unitPriceDoc,
      unitPriceDoc: line.unitPriceDoc,
      unitCost: line.unitCostDoc,
      unitCostDoc: line.unitCostDoc,
      price: line.unitPriceDoc,
      amount: line.amountDoc,
      lineTotal: line.amountDoc,
      lineTotalDoc: line.amountDoc,
      warehouseId: line.warehouseId,
      warehouse: line.warehouseId,
      sourceLineId: line.sourceLineId,
      poLineId: line.sourceLineId,
      grnLineId: line.sourceLineId,
      piLineId: line.sourceLineId,
    };

    return Object.prototype.hasOwnProperty.call(values, fieldId) ? values[fieldId] : undefined;
  }

  private matchesConditionValue(fieldValue: any, condition: any): boolean {
    const targetValue = condition.value;
    const operator = condition.operator;

    switch (operator) {
      case 'EQUALS':
        return fieldValue == targetValue;
      case 'NOT_EQUALS':
        return fieldValue != targetValue;
      case 'CONTAINS':
        return String(fieldValue || '').includes(String(targetValue));
      case 'IS_EMPTY':
        return fieldValue === null || fieldValue === undefined || fieldValue === '';
      case 'IS_NOT_EMPTY':
        return fieldValue !== null && fieldValue !== undefined && fieldValue !== '';
      case 'GREATER_THAN':
        return Number(fieldValue) > Number(targetValue);
      case 'LESS_THAN':
        return Number(fieldValue) < Number(targetValue);
      default:
        return false;
    }
  }

  private getDaysSince(dateString: string): number {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }
}
