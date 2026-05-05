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
import { normalizeSalesDocument } from '../document-runtime/sales/normalizeSalesDocument';
import type { NormalizedSalesDocument, NormalizedSalesLine } from '../document-runtime/types';
import { StructuralResult, SystemWarningResult } from './types';

export class SalesValidator extends DocumentValidator {
  private runtimeCache?: NormalizedSalesDocument;

  private getRuntime(): NormalizedSalesDocument {
    if (!this.runtimeCache) {
      this.runtimeCache = normalizeSalesDocument(this.definition, this.formData);
    }
    return this.runtimeCache;
  }

  validateStructure(): StructuralResult {
    const errors: string[] = [];
    const runtime = this.getRuntime();
    const { profile, header, activeLines } = runtime;

    if (profile.requiresCustomer && !header.customerId) {
      errors.push('Customer is required');
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

    // Warning: Below cost items (always shown, independent of Layer 2 rule)
    const belowCostLines = activeLines.filter((line) => this.isBelowCost(line));

    if (belowCostLines.length > 0) {
      warnings.push(`${belowCostLines.length} item(s) priced below cost`);
    }

    // Warning: Low margin items (< 5%)
    const lowMarginLines = activeLines.filter((line) => {
      const unitPrice = line.unitPriceDoc;
      const costPrice = line.costPrice;
      if (unitPrice === 0 || costPrice === 0) return false;
      const margin = (unitPrice - costPrice) / unitPrice;
      return margin < 0.05 && margin >= 0; // Positive but less than 5%
    });

    if (lowMarginLines.length > 0) {
      warnings.push(`${lowMarginLines.length} item(s) have margin below 5%`);
    }

    // Warning: Customer inactive (if customerId present and has lastOrderDate)
    const customerId = header.customerId;
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
    const runtime = this.getRuntime();
    if (!runtime.profile.requiresAmount) return false;
    return runtime.totals.amountDoc <= 0;
  }

  protected checkPreventBelowCost(): boolean {
    return this.getRuntime().activeLines.some((line) => this.isBelowCost(line));
  }

  protected checkRequireWarehouse(): boolean {
    return !!this.getWarehouseError(this.getRuntime());
  }

  protected checkCondition(condition: any): boolean {
    const runtime = this.getRuntime();
    const fieldId = String(condition?.fieldId || '');

    const normalizedHeader: Record<string, any> = {
      customerId: runtime.header.customerId,
      partyId: runtime.header.customerId,
      documentDate: runtime.header.documentDate,
      invoiceDate: runtime.header.invoiceDate,
      warehouseId: runtime.header.warehouseId,
      warehouse: runtime.header.warehouseId,
      currency: runtime.header.currency,
      exchangeRate: runtime.header.exchangeRate,
      salesOrderId: runtime.header.salesOrderId,
      deliveryNoteId: runtime.header.deliveryNoteId,
      salesInvoiceId: runtime.header.salesInvoiceId,
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

  private getSourceError(runtime: NormalizedSalesDocument): string | null {
    if (runtime.profile.sourcePolicy !== 'REQUIRED') return null;

    const hasHeaderSource = !!runtime.header.sourceDocumentId;
    const hasLineSource = runtime.activeLines.some((line) =>
      !!line.sourceLineId || !!line.salesOrderId || !!line.deliveryNoteId || !!line.salesInvoiceId
    );

    return hasHeaderSource || hasLineSource
      ? null
      : `${runtime.profile.label} requires a source document`;
  }

  private getWarehouseError(runtime: NormalizedSalesDocument): string | null {
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

  private isBelowCost(line: NormalizedSalesLine): boolean {
    return line.unitPriceDoc > 0 && line.costPrice > 0 && line.unitPriceDoc < line.costPrice;
  }

  private getNormalizedLineValue(line: NormalizedSalesLine, fieldId: string): any {
    const values: Record<string, any> = {
      itemId: line.itemId,
      item: line.itemId,
      productId: line.itemId,
      serviceId: line.serviceId,
      description: line.description,
      quantity: line.quantity,
      qty: line.quantity,
      orderedQty: line.quantity,
      deliveredQty: line.quantity,
      invoicedQty: line.quantity,
      returnQty: line.quantity,
      unitPrice: line.unitPriceDoc,
      unitPriceDoc: line.unitPriceDoc,
      price: line.unitPriceDoc,
      amount: line.amountDoc,
      lineTotal: line.amountDoc,
      lineTotalDoc: line.amountDoc,
      warehouseId: line.warehouseId,
      warehouse: line.warehouseId,
      sourceLineId: line.sourceLineId,
      soLineId: line.sourceLineId,
      dnLineId: line.sourceLineId,
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
