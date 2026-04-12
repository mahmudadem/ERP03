import { GoodsReceipt, GoodsReceiptLine } from '../../domain/purchases/entities/GoodsReceipt';
import { PurchaseOrder, PurchaseOrderLine } from '../../domain/purchases/entities/PurchaseOrder';
import { PurchaseInvoice, PurchaseInvoiceLine } from '../../domain/purchases/entities/PurchaseInvoice';
import { PurchaseReturn, PurchaseReturnLine } from '../../domain/purchases/entities/PurchaseReturn';
import { PurchaseSettings } from '../../domain/purchases/entities/PurchaseSettings';

export interface PurchaseSettingsDTO {
  companyId: string;
  allowDirectInvoicing: boolean;
  requirePOForStockItems: boolean;
  defaultAPAccountId?: string;
  defaultPurchaseExpenseAccountId?: string;
  allowOverDelivery: boolean;
  overDeliveryTolerancePct: number;
  overInvoiceTolerancePct: number;
  defaultPaymentTermsDays: number;
  purchaseVoucherTypeId?: string;
  defaultWarehouseId?: string;
  poNumberPrefix: string;
  poNumberNextSeq: number;
  grnNumberPrefix: string;
  grnNumberNextSeq: number;
  piNumberPrefix: string;
  piNumberNextSeq: number;
  prNumberPrefix: string;
  prNumberNextSeq: number;
}

export interface PurchaseOrderLineDTO {
  lineId: string;
  lineNo: number;
  itemId: string;
  itemCode: string;
  itemName: string;
  itemType: 'PRODUCT' | 'SERVICE' | 'RAW_MATERIAL';
  trackInventory: boolean;
  orderedQty: number;
  uom: string;
  receivedQty: number;
  invoicedQty: number;
  returnedQty: number;
  unitPriceDoc: number;
  lineTotalDoc: number;
  unitPriceBase: number;
  lineTotalBase: number;
  taxCodeId?: string;
  taxRate: number;
  taxAmountDoc: number;
  taxAmountBase: number;
  warehouseId?: string;
  description?: string;
}

export interface PurchaseOrderDTO {
  id: string;
  companyId: string;
  orderNumber: string;
  vendorId: string;
  vendorName: string;
  orderDate: string;
  expectedDeliveryDate?: string;
  currency: string;
  exchangeRate: number;
  lines: PurchaseOrderLineDTO[];
  subtotalBase: number;
  taxTotalBase: number;
  grandTotalBase: number;
  subtotalDoc: number;
  taxTotalDoc: number;
  grandTotalDoc: number;
  status: 'DRAFT' | 'CONFIRMED' | 'PARTIALLY_RECEIVED' | 'FULLY_RECEIVED' | 'CLOSED' | 'CANCELLED';
  notes?: string;
  internalNotes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  confirmedAt?: string;
  closedAt?: string;
}

export interface GoodsReceiptLineDTO {
  lineId: string;
  lineNo: number;
  poLineId?: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  receivedQty: number;
  uom: string;
  unitCostDoc: number;
  unitCostBase: number;
  moveCurrency: string;
  fxRateMovToBase: number;
  fxRateCCYToBase: number;
  stockMovementId?: string | null;
  description?: string;
}

export interface GoodsReceiptDTO {
  id: string;
  companyId: string;
  grnNumber: string;
  purchaseOrderId?: string;
  vendorId: string;
  vendorName: string;
  receiptDate: string;
  warehouseId: string;
  lines: GoodsReceiptLineDTO[];
  status: 'DRAFT' | 'POSTED' | 'CANCELLED';
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  postedAt?: string;
}

export interface PurchaseInvoiceLineDTO {
  lineId: string;
  lineNo: number;
  poLineId?: string;
  grnLineId?: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  trackInventory: boolean;
  invoicedQty: number;
  uom: string;
  unitPriceDoc: number;
  lineTotalDoc: number;
  unitPriceBase: number;
  lineTotalBase: number;
  taxCodeId?: string;
  taxCode?: string;
  taxRate: number;
  taxAmountDoc: number;
  taxAmountBase: number;
  warehouseId?: string;
  accountId: string;
  stockMovementId?: string | null;
  description?: string;
}

export interface PurchaseInvoiceDTO {
  id: string;
  companyId: string;
  invoiceNumber: string;
  vendorInvoiceNumber?: string;
  purchaseOrderId?: string;
  vendorId: string;
  vendorName: string;
  invoiceDate: string;
  dueDate?: string;
  currency: string;
  exchangeRate: number;
  lines: PurchaseInvoiceLineDTO[];
  subtotalDoc: number;
  taxTotalDoc: number;
  grandTotalDoc: number;
  subtotalBase: number;
  taxTotalBase: number;
  grandTotalBase: number;
  paymentTermsDays: number;
  paymentStatus: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';
  paidAmountBase: number;
  outstandingAmountBase: number;
  status: 'DRAFT' | 'POSTED' | 'CANCELLED';
  voucherId?: string | null;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  postedAt?: string;
}

export interface PurchaseReturnLineDTO {
  lineId: string;
  lineNo: number;
  piLineId?: string;
  grnLineId?: string;
  poLineId?: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  returnQty: number;
  uom: string;
  unitCostDoc: number;
  unitCostBase: number;
  fxRateMovToBase: number;
  fxRateCCYToBase: number;
  taxCodeId?: string;
  taxCode?: string;
  taxRate: number;
  taxAmountDoc: number;
  taxAmountBase: number;
  accountId?: string;
  stockMovementId?: string | null;
  description?: string;
}

export interface PurchaseReturnDTO {
  id: string;
  companyId: string;
  returnNumber: string;
  purchaseInvoiceId?: string;
  goodsReceiptId?: string;
  purchaseOrderId?: string;
  vendorId: string;
  vendorName: string;
  returnContext: 'AFTER_INVOICE' | 'BEFORE_INVOICE' | 'DIRECT';
  returnDate: string;
  warehouseId: string;
  currency: string;
  exchangeRate: number;
  lines: PurchaseReturnLineDTO[];
  subtotalDoc: number;
  taxTotalDoc: number;
  grandTotalDoc: number;
  subtotalBase: number;
  taxTotalBase: number;
  grandTotalBase: number;
  reason: string;
  notes?: string;
  status: 'DRAFT' | 'POSTED' | 'CANCELLED';
  voucherId?: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  postedAt?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
}

export type PurchaseSettingsResponseDTO = ApiResponse<PurchaseSettingsDTO | null>;
export type PurchaseOrderResponseDTO = ApiResponse<PurchaseOrderDTO>;
export type PurchaseOrderListResponseDTO = ApiResponse<PurchaseOrderDTO[]>;
export type GoodsReceiptResponseDTO = ApiResponse<GoodsReceiptDTO>;
export type GoodsReceiptListResponseDTO = ApiResponse<GoodsReceiptDTO[]>;
export type PurchaseInvoiceResponseDTO = ApiResponse<PurchaseInvoiceDTO>;
export type PurchaseInvoiceListResponseDTO = ApiResponse<PurchaseInvoiceDTO[]>;
export type PurchaseReturnResponseDTO = ApiResponse<PurchaseReturnDTO>;
export type PurchaseReturnListResponseDTO = ApiResponse<PurchaseReturnDTO[]>;

export class PurchaseDTOMapper {
  static toSettingsDTO(settings: PurchaseSettings): PurchaseSettingsDTO {
    return {
      companyId: settings.companyId,
      allowDirectInvoicing: settings.allowDirectInvoicing,
      requirePOForStockItems: settings.requirePOForStockItems,
      defaultAPAccountId: settings.defaultAPAccountId,
      defaultPurchaseExpenseAccountId: settings.defaultPurchaseExpenseAccountId,
      allowOverDelivery: settings.allowOverDelivery,
      overDeliveryTolerancePct: settings.overDeliveryTolerancePct,
      overInvoiceTolerancePct: settings.overInvoiceTolerancePct,
      defaultPaymentTermsDays: settings.defaultPaymentTermsDays,
      purchaseVoucherTypeId: settings.purchaseVoucherTypeId,
      defaultWarehouseId: settings.defaultWarehouseId,
      poNumberPrefix: settings.poNumberPrefix,
      poNumberNextSeq: settings.poNumberNextSeq,
      grnNumberPrefix: settings.grnNumberPrefix,
      grnNumberNextSeq: settings.grnNumberNextSeq,
      piNumberPrefix: settings.piNumberPrefix,
      piNumberNextSeq: settings.piNumberNextSeq,
      prNumberPrefix: settings.prNumberPrefix,
      prNumberNextSeq: settings.prNumberNextSeq,
    };
  }

  static toLineDTO(line: PurchaseOrderLine): PurchaseOrderLineDTO {
    return {
      lineId: line.lineId,
      lineNo: line.lineNo,
      itemId: line.itemId,
      itemCode: line.itemCode,
      itemName: line.itemName,
      itemType: line.itemType,
      trackInventory: line.trackInventory,
      orderedQty: line.orderedQty,
      uom: line.uom,
      receivedQty: line.receivedQty,
      invoicedQty: line.invoicedQty,
      returnedQty: line.returnedQty,
      unitPriceDoc: line.unitPriceDoc,
      lineTotalDoc: line.lineTotalDoc,
      unitPriceBase: line.unitPriceBase,
      lineTotalBase: line.lineTotalBase,
      taxCodeId: line.taxCodeId,
      taxRate: line.taxRate,
      taxAmountDoc: line.taxAmountDoc,
      taxAmountBase: line.taxAmountBase,
      warehouseId: line.warehouseId,
      description: line.description,
    };
  }

  static toOrderDTO(po: PurchaseOrder): PurchaseOrderDTO {
    return {
      id: po.id,
      companyId: po.companyId,
      orderNumber: po.orderNumber,
      vendorId: po.vendorId,
      vendorName: po.vendorName,
      orderDate: po.orderDate,
      expectedDeliveryDate: po.expectedDeliveryDate,
      currency: po.currency,
      exchangeRate: po.exchangeRate,
      lines: po.lines.map((line) => PurchaseDTOMapper.toLineDTO(line)),
      subtotalBase: po.subtotalBase,
      taxTotalBase: po.taxTotalBase,
      grandTotalBase: po.grandTotalBase,
      subtotalDoc: po.subtotalDoc,
      taxTotalDoc: po.taxTotalDoc,
      grandTotalDoc: po.grandTotalDoc,
      status: po.status,
      notes: po.notes,
      internalNotes: po.internalNotes,
      createdBy: po.createdBy,
      createdAt: po.createdAt.toISOString(),
      updatedAt: po.updatedAt.toISOString(),
      confirmedAt: po.confirmedAt?.toISOString(),
      closedAt: po.closedAt?.toISOString(),
    };
  }

  static toGoodsReceiptLineDTO(line: GoodsReceiptLine): GoodsReceiptLineDTO {
    return {
      lineId: line.lineId,
      lineNo: line.lineNo,
      poLineId: line.poLineId,
      itemId: line.itemId,
      itemCode: line.itemCode,
      itemName: line.itemName,
      receivedQty: line.receivedQty,
      uom: line.uom,
      unitCostDoc: line.unitCostDoc,
      unitCostBase: line.unitCostBase,
      moveCurrency: line.moveCurrency,
      fxRateMovToBase: line.fxRateMovToBase,
      fxRateCCYToBase: line.fxRateCCYToBase,
      stockMovementId: line.stockMovementId ?? null,
      description: line.description,
    };
  }

  static toGoodsReceiptDTO(grn: GoodsReceipt): GoodsReceiptDTO {
    return {
      id: grn.id,
      companyId: grn.companyId,
      grnNumber: grn.grnNumber,
      purchaseOrderId: grn.purchaseOrderId,
      vendorId: grn.vendorId,
      vendorName: grn.vendorName,
      receiptDate: grn.receiptDate,
      warehouseId: grn.warehouseId,
      lines: grn.lines.map((line) => PurchaseDTOMapper.toGoodsReceiptLineDTO(line)),
      status: grn.status,
      notes: grn.notes,
      createdBy: grn.createdBy,
      createdAt: grn.createdAt.toISOString(),
      updatedAt: grn.updatedAt.toISOString(),
      postedAt: grn.postedAt?.toISOString(),
    };
  }

  static toPurchaseInvoiceLineDTO(line: PurchaseInvoiceLine): PurchaseInvoiceLineDTO {
    return {
      lineId: line.lineId,
      lineNo: line.lineNo,
      poLineId: line.poLineId,
      grnLineId: line.grnLineId,
      itemId: line.itemId,
      itemCode: line.itemCode,
      itemName: line.itemName,
      trackInventory: line.trackInventory,
      invoicedQty: line.invoicedQty,
      uom: line.uom,
      unitPriceDoc: line.unitPriceDoc,
      lineTotalDoc: line.lineTotalDoc,
      unitPriceBase: line.unitPriceBase,
      lineTotalBase: line.lineTotalBase,
      taxCodeId: line.taxCodeId,
      taxCode: line.taxCode,
      taxRate: line.taxRate,
      taxAmountDoc: line.taxAmountDoc,
      taxAmountBase: line.taxAmountBase,
      warehouseId: line.warehouseId,
      accountId: line.accountId,
      stockMovementId: line.stockMovementId ?? null,
      description: line.description,
    };
  }

  static toPurchaseInvoiceDTO(pi: PurchaseInvoice): PurchaseInvoiceDTO {
    return {
      id: pi.id,
      companyId: pi.companyId,
      invoiceNumber: pi.invoiceNumber,
      vendorInvoiceNumber: pi.vendorInvoiceNumber,
      purchaseOrderId: pi.purchaseOrderId,
      vendorId: pi.vendorId,
      vendorName: pi.vendorName,
      invoiceDate: pi.invoiceDate,
      dueDate: pi.dueDate,
      currency: pi.currency,
      exchangeRate: pi.exchangeRate,
      lines: pi.lines.map((line) => PurchaseDTOMapper.toPurchaseInvoiceLineDTO(line)),
      subtotalDoc: pi.subtotalDoc,
      taxTotalDoc: pi.taxTotalDoc,
      grandTotalDoc: pi.grandTotalDoc,
      subtotalBase: pi.subtotalBase,
      taxTotalBase: pi.taxTotalBase,
      grandTotalBase: pi.grandTotalBase,
      paymentTermsDays: pi.paymentTermsDays,
      paymentStatus: pi.paymentStatus,
      paidAmountBase: pi.paidAmountBase,
      outstandingAmountBase: pi.outstandingAmountBase,
      status: pi.status,
      voucherId: pi.voucherId ?? null,
      notes: pi.notes,
      createdBy: pi.createdBy,
      createdAt: pi.createdAt.toISOString(),
      updatedAt: pi.updatedAt.toISOString(),
      postedAt: pi.postedAt?.toISOString(),
    };
  }

  static toPurchaseReturnLineDTO(line: PurchaseReturnLine): PurchaseReturnLineDTO {
    return {
      lineId: line.lineId,
      lineNo: line.lineNo,
      piLineId: line.piLineId,
      grnLineId: line.grnLineId,
      poLineId: line.poLineId,
      itemId: line.itemId,
      itemCode: line.itemCode,
      itemName: line.itemName,
      returnQty: line.returnQty,
      uom: line.uom,
      unitCostDoc: line.unitCostDoc,
      unitCostBase: line.unitCostBase,
      fxRateMovToBase: line.fxRateMovToBase,
      fxRateCCYToBase: line.fxRateCCYToBase,
      taxCodeId: line.taxCodeId,
      taxCode: line.taxCode,
      taxRate: line.taxRate,
      taxAmountDoc: line.taxAmountDoc,
      taxAmountBase: line.taxAmountBase,
      accountId: line.accountId,
      stockMovementId: line.stockMovementId ?? null,
      description: line.description,
    };
  }

  static toPurchaseReturnDTO(purchaseReturn: PurchaseReturn): PurchaseReturnDTO {
    return {
      id: purchaseReturn.id,
      companyId: purchaseReturn.companyId,
      returnNumber: purchaseReturn.returnNumber,
      purchaseInvoiceId: purchaseReturn.purchaseInvoiceId,
      goodsReceiptId: purchaseReturn.goodsReceiptId,
      purchaseOrderId: purchaseReturn.purchaseOrderId,
      vendorId: purchaseReturn.vendorId,
      vendorName: purchaseReturn.vendorName,
      returnContext: purchaseReturn.returnContext,
      returnDate: purchaseReturn.returnDate,
      warehouseId: purchaseReturn.warehouseId,
      currency: purchaseReturn.currency,
      exchangeRate: purchaseReturn.exchangeRate,
      lines: purchaseReturn.lines.map((line) => PurchaseDTOMapper.toPurchaseReturnLineDTO(line)),
      subtotalDoc: purchaseReturn.subtotalDoc,
      taxTotalDoc: purchaseReturn.taxTotalDoc,
      grandTotalDoc: purchaseReturn.grandTotalDoc,
      subtotalBase: purchaseReturn.subtotalBase,
      taxTotalBase: purchaseReturn.taxTotalBase,
      grandTotalBase: purchaseReturn.grandTotalBase,
      reason: purchaseReturn.reason,
      notes: purchaseReturn.notes,
      status: purchaseReturn.status,
      voucherId: purchaseReturn.voucherId ?? null,
      createdBy: purchaseReturn.createdBy,
      createdAt: purchaseReturn.createdAt.toISOString(),
      updatedAt: purchaseReturn.updatedAt.toISOString(),
      postedAt: purchaseReturn.postedAt?.toISOString(),
    };
  }
}
