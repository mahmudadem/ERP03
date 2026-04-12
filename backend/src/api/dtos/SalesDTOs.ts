import { DeliveryNote, DeliveryNoteLine } from '../../domain/sales/entities/DeliveryNote';
import { SalesInvoice, SalesInvoiceLine } from '../../domain/sales/entities/SalesInvoice';
import { SalesOrder, SalesOrderLine } from '../../domain/sales/entities/SalesOrder';
import { SalesReturn, SalesReturnLine } from '../../domain/sales/entities/SalesReturn';
import { SalesSettings } from '../../domain/sales/entities/SalesSettings';

export interface SalesSettingsDTO {
  companyId: string;
  allowDirectInvoicing: boolean;
  requireSOForStockItems: boolean;
  defaultARAccountId?: string;
  defaultRevenueAccountId: string;
  defaultCOGSAccountId?: string;
  defaultInventoryAccountId?: string;
  defaultSalesExpenseAccountId?: string;
  allowOverDelivery: boolean;
  overDeliveryTolerancePct: number;
  overInvoiceTolerancePct: number;
  defaultPaymentTermsDays: number;
  salesVoucherTypeId?: string;
  defaultWarehouseId?: string;
  soNumberPrefix: string;
  soNumberNextSeq: number;
  dnNumberPrefix: string;
  dnNumberNextSeq: number;
  siNumberPrefix: string;
  siNumberNextSeq: number;
  srNumberPrefix: string;
  srNumberNextSeq: number;
}

export interface SalesOrderLineDTO {
  lineId: string;
  lineNo: number;
  itemId: string;
  itemCode: string;
  itemName: string;
  itemType: 'PRODUCT' | 'SERVICE' | 'RAW_MATERIAL';
  trackInventory: boolean;
  orderedQty: number;
  uom: string;
  deliveredQty: number;
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

export interface SalesOrderDTO {
  id: string;
  companyId: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  orderDate: string;
  expectedDeliveryDate?: string;
  currency: string;
  exchangeRate: number;
  lines: SalesOrderLineDTO[];
  subtotalBase: number;
  taxTotalBase: number;
  grandTotalBase: number;
  subtotalDoc: number;
  taxTotalDoc: number;
  grandTotalDoc: number;
  status: 'DRAFT' | 'CONFIRMED' | 'PARTIALLY_DELIVERED' | 'FULLY_DELIVERED' | 'CLOSED' | 'CANCELLED';
  notes?: string;
  internalNotes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  confirmedAt?: string;
  closedAt?: string;
}

export interface DeliveryNoteLineDTO {
  lineId: string;
  lineNo: number;
  soLineId?: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  deliveredQty: number;
  uom: string;
  unitCostBase: number;
  lineCostBase: number;
  moveCurrency: string;
  fxRateMovToBase: number;
  fxRateCCYToBase: number;
  stockMovementId?: string | null;
  description?: string;
}

export interface DeliveryNoteDTO {
  id: string;
  companyId: string;
  dnNumber: string;
  salesOrderId?: string;
  customerId: string;
  customerName: string;
  deliveryDate: string;
  warehouseId: string;
  lines: DeliveryNoteLineDTO[];
  status: 'DRAFT' | 'POSTED' | 'CANCELLED';
  notes?: string;
  cogsVoucherId?: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  postedAt?: string;
}

export interface SalesInvoiceLineDTO {
  lineId: string;
  lineNo: number;
  soLineId?: string;
  dnLineId?: string;
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
  revenueAccountId: string;
  cogsAccountId?: string;
  inventoryAccountId?: string;
  unitCostBase?: number;
  lineCostBase?: number;
  stockMovementId?: string | null;
  description?: string;
}

export interface SalesInvoiceDTO {
  id: string;
  companyId: string;
  invoiceNumber: string;
  customerInvoiceNumber?: string;
  salesOrderId?: string;
  customerId: string;
  customerName: string;
  invoiceDate: string;
  dueDate?: string;
  currency: string;
  exchangeRate: number;
  lines: SalesInvoiceLineDTO[];
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
  cogsVoucherId?: string | null;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  postedAt?: string;
}

export interface SalesReturnLineDTO {
  lineId: string;
  lineNo: number;
  siLineId?: string;
  dnLineId?: string;
  soLineId?: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  returnQty: number;
  uom: string;
  unitPriceDoc?: number;
  unitPriceBase?: number;
  unitCostBase: number;
  fxRateMovToBase: number;
  fxRateCCYToBase: number;
  taxCodeId?: string;
  taxRate: number;
  taxAmountDoc: number;
  taxAmountBase: number;
  revenueAccountId?: string;
  cogsAccountId?: string;
  inventoryAccountId?: string;
  stockMovementId?: string | null;
  description?: string;
}

export interface SalesReturnDTO {
  id: string;
  companyId: string;
  returnNumber: string;
  salesInvoiceId?: string;
  deliveryNoteId?: string;
  salesOrderId?: string;
  customerId: string;
  customerName: string;
  returnContext: 'AFTER_INVOICE' | 'BEFORE_INVOICE';
  returnDate: string;
  warehouseId: string;
  currency: string;
  exchangeRate: number;
  lines: SalesReturnLineDTO[];
  subtotalDoc: number;
  taxTotalDoc: number;
  grandTotalDoc: number;
  subtotalBase: number;
  taxTotalBase: number;
  grandTotalBase: number;
  reason: string;
  notes?: string;
  status: 'DRAFT' | 'POSTED' | 'CANCELLED';
  revenueVoucherId?: string | null;
  cogsVoucherId?: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  postedAt?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
}

export type SalesSettingsResponseDTO = ApiResponse<SalesSettingsDTO | null>;
export type SalesOrderResponseDTO = ApiResponse<SalesOrderDTO>;
export type SalesOrderListResponseDTO = ApiResponse<SalesOrderDTO[]>;
export type DeliveryNoteResponseDTO = ApiResponse<DeliveryNoteDTO>;
export type DeliveryNoteListResponseDTO = ApiResponse<DeliveryNoteDTO[]>;
export type SalesInvoiceResponseDTO = ApiResponse<SalesInvoiceDTO>;
export type SalesInvoiceListResponseDTO = ApiResponse<SalesInvoiceDTO[]>;
export type SalesReturnResponseDTO = ApiResponse<SalesReturnDTO>;
export type SalesReturnListResponseDTO = ApiResponse<SalesReturnDTO[]>;

export class SalesDTOMapper {
  static toSettingsDTO(settings: SalesSettings): SalesSettingsDTO {
    return {
      companyId: settings.companyId,
      allowDirectInvoicing: settings.allowDirectInvoicing,
      requireSOForStockItems: settings.requireSOForStockItems,
      defaultARAccountId: settings.defaultARAccountId,
      defaultRevenueAccountId: settings.defaultRevenueAccountId,
      defaultCOGSAccountId: settings.defaultCOGSAccountId,
      defaultInventoryAccountId: settings.defaultInventoryAccountId,
      defaultSalesExpenseAccountId: settings.defaultSalesExpenseAccountId,
      allowOverDelivery: settings.allowOverDelivery,
      overDeliveryTolerancePct: settings.overDeliveryTolerancePct,
      overInvoiceTolerancePct: settings.overInvoiceTolerancePct,
      defaultPaymentTermsDays: settings.defaultPaymentTermsDays,
      salesVoucherTypeId: settings.salesVoucherTypeId,
      defaultWarehouseId: settings.defaultWarehouseId,
      soNumberPrefix: settings.soNumberPrefix,
      soNumberNextSeq: settings.soNumberNextSeq,
      dnNumberPrefix: settings.dnNumberPrefix,
      dnNumberNextSeq: settings.dnNumberNextSeq,
      siNumberPrefix: settings.siNumberPrefix,
      siNumberNextSeq: settings.siNumberNextSeq,
      srNumberPrefix: settings.srNumberPrefix,
      srNumberNextSeq: settings.srNumberNextSeq,
    };
  }

  static toLineDTO(line: SalesOrderLine): SalesOrderLineDTO {
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
      deliveredQty: line.deliveredQty,
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

  static toOrderDTO(order: SalesOrder): SalesOrderDTO {
    return {
      id: order.id,
      companyId: order.companyId,
      orderNumber: order.orderNumber,
      customerId: order.customerId,
      customerName: order.customerName,
      orderDate: order.orderDate,
      expectedDeliveryDate: order.expectedDeliveryDate,
      currency: order.currency,
      exchangeRate: order.exchangeRate,
      lines: order.lines.map((line) => SalesDTOMapper.toLineDTO(line)),
      subtotalBase: order.subtotalBase,
      taxTotalBase: order.taxTotalBase,
      grandTotalBase: order.grandTotalBase,
      subtotalDoc: order.subtotalDoc,
      taxTotalDoc: order.taxTotalDoc,
      grandTotalDoc: order.grandTotalDoc,
      status: order.status,
      notes: order.notes,
      internalNotes: order.internalNotes,
      createdBy: order.createdBy,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
      confirmedAt: order.confirmedAt?.toISOString(),
      closedAt: order.closedAt?.toISOString(),
    };
  }

  static toDeliveryNoteLineDTO(line: DeliveryNoteLine): DeliveryNoteLineDTO {
    return {
      lineId: line.lineId,
      lineNo: line.lineNo,
      soLineId: line.soLineId,
      itemId: line.itemId,
      itemCode: line.itemCode,
      itemName: line.itemName,
      deliveredQty: line.deliveredQty,
      uom: line.uom,
      unitCostBase: line.unitCostBase,
      lineCostBase: line.lineCostBase,
      moveCurrency: line.moveCurrency,
      fxRateMovToBase: line.fxRateMovToBase,
      fxRateCCYToBase: line.fxRateCCYToBase,
      stockMovementId: line.stockMovementId ?? null,
      description: line.description,
    };
  }

  static toDeliveryNoteDTO(dn: DeliveryNote): DeliveryNoteDTO {
    return {
      id: dn.id,
      companyId: dn.companyId,
      dnNumber: dn.dnNumber,
      salesOrderId: dn.salesOrderId,
      customerId: dn.customerId,
      customerName: dn.customerName,
      deliveryDate: dn.deliveryDate,
      warehouseId: dn.warehouseId,
      lines: dn.lines.map((line) => SalesDTOMapper.toDeliveryNoteLineDTO(line)),
      status: dn.status,
      notes: dn.notes,
      cogsVoucherId: dn.cogsVoucherId ?? null,
      createdBy: dn.createdBy,
      createdAt: dn.createdAt.toISOString(),
      updatedAt: dn.updatedAt.toISOString(),
      postedAt: dn.postedAt?.toISOString(),
    };
  }

  static toSalesInvoiceLineDTO(line: SalesInvoiceLine): SalesInvoiceLineDTO {
    return {
      lineId: line.lineId,
      lineNo: line.lineNo,
      soLineId: line.soLineId,
      dnLineId: line.dnLineId,
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
      revenueAccountId: line.revenueAccountId,
      cogsAccountId: line.cogsAccountId,
      inventoryAccountId: line.inventoryAccountId,
      unitCostBase: line.unitCostBase,
      lineCostBase: line.lineCostBase,
      stockMovementId: line.stockMovementId ?? null,
      description: line.description,
    };
  }

  static toSalesInvoiceDTO(si: SalesInvoice): SalesInvoiceDTO {
    return {
      id: si.id,
      companyId: si.companyId,
      invoiceNumber: si.invoiceNumber,
      customerInvoiceNumber: si.customerInvoiceNumber,
      salesOrderId: si.salesOrderId,
      customerId: si.customerId,
      customerName: si.customerName,
      invoiceDate: si.invoiceDate,
      dueDate: si.dueDate,
      currency: si.currency,
      exchangeRate: si.exchangeRate,
      lines: si.lines.map((line) => SalesDTOMapper.toSalesInvoiceLineDTO(line)),
      subtotalDoc: si.subtotalDoc,
      taxTotalDoc: si.taxTotalDoc,
      grandTotalDoc: si.grandTotalDoc,
      subtotalBase: si.subtotalBase,
      taxTotalBase: si.taxTotalBase,
      grandTotalBase: si.grandTotalBase,
      paymentTermsDays: si.paymentTermsDays,
      paymentStatus: si.paymentStatus,
      paidAmountBase: si.paidAmountBase,
      outstandingAmountBase: si.outstandingAmountBase,
      status: si.status,
      voucherId: si.voucherId ?? null,
      cogsVoucherId: si.cogsVoucherId ?? null,
      notes: si.notes,
      createdBy: si.createdBy,
      createdAt: si.createdAt.toISOString(),
      updatedAt: si.updatedAt.toISOString(),
      postedAt: si.postedAt?.toISOString(),
    };
  }

  static toSalesReturnLineDTO(line: SalesReturnLine): SalesReturnLineDTO {
    return {
      lineId: line.lineId,
      lineNo: line.lineNo,
      siLineId: line.siLineId,
      dnLineId: line.dnLineId,
      soLineId: line.soLineId,
      itemId: line.itemId,
      itemCode: line.itemCode,
      itemName: line.itemName,
      returnQty: line.returnQty,
      uom: line.uom,
      unitPriceDoc: line.unitPriceDoc,
      unitPriceBase: line.unitPriceBase,
      unitCostBase: line.unitCostBase,
      fxRateMovToBase: line.fxRateMovToBase,
      fxRateCCYToBase: line.fxRateCCYToBase,
      taxCodeId: line.taxCodeId,
      taxRate: line.taxRate,
      taxAmountDoc: line.taxAmountDoc,
      taxAmountBase: line.taxAmountBase,
      revenueAccountId: line.revenueAccountId,
      cogsAccountId: line.cogsAccountId,
      inventoryAccountId: line.inventoryAccountId,
      stockMovementId: line.stockMovementId ?? null,
      description: line.description,
    };
  }

  static toSalesReturnDTO(sr: SalesReturn): SalesReturnDTO {
    return {
      id: sr.id,
      companyId: sr.companyId,
      returnNumber: sr.returnNumber,
      salesInvoiceId: sr.salesInvoiceId,
      deliveryNoteId: sr.deliveryNoteId,
      salesOrderId: sr.salesOrderId,
      customerId: sr.customerId,
      customerName: sr.customerName,
      returnContext: sr.returnContext,
      returnDate: sr.returnDate,
      warehouseId: sr.warehouseId,
      currency: sr.currency,
      exchangeRate: sr.exchangeRate,
      lines: sr.lines.map((line) => SalesDTOMapper.toSalesReturnLineDTO(line)),
      subtotalDoc: sr.subtotalDoc,
      taxTotalDoc: sr.taxTotalDoc,
      grandTotalDoc: sr.grandTotalDoc,
      subtotalBase: sr.subtotalBase,
      taxTotalBase: sr.taxTotalBase,
      grandTotalBase: sr.grandTotalBase,
      reason: sr.reason,
      notes: sr.notes,
      status: sr.status,
      revenueVoucherId: sr.revenueVoucherId ?? null,
      cogsVoucherId: sr.cogsVoucherId ?? null,
      createdBy: sr.createdBy,
      createdAt: sr.createdAt.toISOString(),
      updatedAt: sr.updatedAt.toISOString(),
      postedAt: sr.postedAt?.toISOString(),
    };
  }
}
