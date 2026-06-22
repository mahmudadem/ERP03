/**
 * PosDTOs.ts — DTO mappers for the POS module.
 * Pure data shape; no business logic.
 */
import { PosRegister } from '../../domain/pos/entities/PosRegister';
import { PosSettings } from '../../domain/pos/entities/PosSettings';
import { PosShift } from '../../domain/pos/entities/PosShift';
import { PosCashMovement } from '../../domain/pos/entities/PosCashMovement';
import { PosReceipt, PosReceiptLineSnapshot } from '../../domain/pos/entities/PosReceipt';
import { PosPayment } from '../../domain/pos/entities/PosPayment';
import { PosReturn, PosReturnLine } from '../../domain/pos/entities/PosReturn';
import { PosHeldCart, PosHeldCartLine } from '../../domain/pos/entities/PosHeldCart';
import { PosCashMovementTotals } from '../../repository/interfaces/pos/IPosCashMovementRepository';

export interface PosRegisterDTO {
  id: string;
  companyId: string;
  code: string;
  name: string;
  branchId?: string;
  warehouseId: string;
  defaultPriceListId?: string;
  allowedCashierUserIds: string[];
  hardwareProfileId?: string;
  cashDrawerAccountId: string;
  settlementAccountIds?: Partial<Record<'CASH' | 'CARD' | 'BANK_TRANSFER' | 'CUSTOM', string>>;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  updatedAt: string;
}

export interface PosPaymentMethodDTO {
  code: 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'CUSTOM';
  settlementAccountId: string;
  label?: string;
  requiresReference: boolean;
  allowsChange: boolean;
  isEnabled: boolean;
}

export interface PosSettingsDTO {
  companyId: string;
  requireOpenShift: boolean;
  walkInCustomerId?: string;
  cashOverAccountId?: string;
  cashShortAccountId?: string;
  receiptPrefix: string;
  receiptNextSeq: number;
  cashRounding: 'none' | 'nearest_05' | 'nearest_1';
  allowPosDirectSales: boolean;
  negativeStockPolicy: 'BLOCK' | 'ALLOW';
  paymentMethods: PosPaymentMethodDTO[];
}

export interface PosShiftDTO {
  id: string;
  companyId: string;
  registerId: string;
  cashierUserId: string;
  status: 'OPEN' | 'CLOSED' | 'RECONCILED' | 'FORCE_CLOSED' | 'CANCELLED';
  openedAt: string;
  openingFloat: number;
  closedAt?: string;
  expectedCash?: number;
  countedCash?: number;
  expectedPaymentTotals?: Record<string, number>;
  countedPaymentTotals?: Record<string, number>;
  overShortPaymentTotals?: Record<string, number>;
  overShortAmount?: number;
  overShortVoucherId?: string;
  reconciledAt?: string;
  reconciledBy?: string;
  createdAt: string;
  updatedAt: string;
}

export class PosDTOMapper {
  static toRegisterDTO(register: PosRegister): PosRegisterDTO {
    return {
      id: register.id,
      companyId: register.companyId,
      code: register.code,
      name: register.name,
      branchId: register.branchId,
      warehouseId: register.warehouseId,
      defaultPriceListId: register.defaultPriceListId,
      allowedCashierUserIds: register.allowedCashierUserIds,
      hardwareProfileId: register.hardwareProfileId,
      cashDrawerAccountId: register.cashDrawerAccountId,
      settlementAccountIds: register.settlementAccountIds,
      status: register.status,
      createdAt: register.createdAt.toISOString(),
      updatedAt: register.updatedAt.toISOString(),
    };
  }

  static toSettingsDTO(settings: PosSettings): PosSettingsDTO {
    return {
      companyId: settings.companyId,
      requireOpenShift: settings.requireOpenShift,
      walkInCustomerId: settings.walkInCustomerId,
      cashOverAccountId: settings.cashOverAccountId,
      cashShortAccountId: settings.cashShortAccountId,
      receiptPrefix: settings.receiptPrefix,
      receiptNextSeq: settings.receiptNextSeq,
      cashRounding: settings.cashRounding,
      allowPosDirectSales: settings.allowPosDirectSales,
      negativeStockPolicy: settings.negativeStockPolicy,
      paymentMethods: settings.paymentMethods.map((m) => ({
        code: m.code,
        settlementAccountId: m.settlementAccountId,
        label: m.label,
        requiresReference: m.requiresReference,
        allowsChange: m.allowsChange,
        isEnabled: m.isEnabled,
      })),
    };
  }

  static toShiftDTO(shift: PosShift): PosShiftDTO {
    return {
      id: shift.id,
      companyId: shift.companyId,
      registerId: shift.registerId,
      cashierUserId: shift.cashierUserId,
      status: shift.status,
      openedAt: shift.openedAt.toISOString(),
      openingFloat: shift.openingFloat,
      closedAt: shift.closedAt ? shift.closedAt.toISOString() : undefined,
      expectedCash: shift.expectedCash,
      countedCash: shift.countedCash,
      expectedPaymentTotals: shift.expectedPaymentTotals,
      countedPaymentTotals: shift.countedPaymentTotals,
      overShortPaymentTotals: shift.overShortPaymentTotals,
      overShortAmount: shift.overShortAmount,
      overShortVoucherId: shift.overShortVoucherId,
      reconciledAt: shift.reconciledAt ? shift.reconciledAt.toISOString() : undefined,
      reconciledBy: shift.reconciledBy,
      createdAt: shift.createdAt.toISOString(),
      updatedAt: shift.updatedAt.toISOString(),
    };
  }
}

export interface PosCashMovementDTO {
  id: string;
  companyId: string;
  shiftId: string;
  registerId: string;
  type: 'OPENING_FLOAT' | 'PAYIN' | 'PAYOUT' | 'DROP' | 'SALE_CASH' | 'REFUND_CASH';
  amount: number;
  reason?: string;
  createdBy: string;
  createdAt: string;
}

export const PosCashMovementDTO = {
  fromDomain(m: PosCashMovement): PosCashMovementDTO {
    return {
      id: m.id,
      companyId: m.companyId,
      shiftId: m.shiftId,
      registerId: m.registerId,
      type: m.type,
      amount: m.amount,
      reason: m.reason,
      createdBy: m.createdBy,
      createdAt: m.createdAt.toISOString(),
    };
  },
};

export interface PosCashMovementTotalsDTO {
  OPENING_FLOAT: number;
  PAYIN: number;
  PAYOUT: number;
  DROP: number;
  SALE_CASH: number;
  REFUND_CASH: number;
  expectedCash: number;
}

export interface PosXReportDTO {
  shift: PosShiftDTO;
  totals: PosCashMovementTotalsDTO;
  generatedAt: string;
}

export const PosXReportDTO = {
  fromDomain(report: { shift: PosShift; totals: PosCashMovementTotals; generatedAt: string }): PosXReportDTO {
    return {
      shift: PosDTOMapper.toShiftDTO(report.shift),
      totals: report.totals,
      generatedAt: report.generatedAt,
    };
  },
};

export interface PosReceiptLineSnapshotDTO {
  itemId: string;
  itemCode: string;
  itemName: string;
  qty: number;
  uom: string;
  unitPrice: number;
  discountType?: 'PERCENT' | 'AMOUNT';
  discountValue?: number;
  lineDiscount: number;
  taxCodeId?: string;
  lineTotal: number;
  status?: 'ACTIVE' | 'VOIDED';
  priceOverride?: boolean;
  taxOverride?: boolean;
  voidedBy?: string;
  voidedAt?: string;
  voidReason?: string;
  managerOverrideId?: string;
  salesInvoiceLineId?: string;
}

export interface PosReceiptDTO {
  id: string;
  companyId: string;
  shiftId: string;
  registerId: string;
  receiptNumber: string;
  status: 'COMPLETED' | 'VOIDED';
  customerId: string;
  customerName?: string;
  lines: PosReceiptLineSnapshotDTO[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
  salesInvoiceId?: string;
  salesInvoiceNumber?: string;
  exchangeId?: string;
  createdBy: string;
  createdAt: string;
}

export const PosReceiptDTO = {
  fromDomain(r: PosReceipt): PosReceiptDTO {
    return {
      id: r.id,
      companyId: r.companyId,
      shiftId: r.shiftId,
      registerId: r.registerId,
      receiptNumber: r.receiptNumber,
      status: r.status,
      customerId: r.customerId,
      customerName: r.customerName,
      lines: r.lines,
      subtotal: r.subtotal,
      discountTotal: r.discountTotal,
      taxTotal: r.taxTotal,
      grandTotal: r.grandTotal,
      salesInvoiceId: r.salesInvoiceId,
      salesInvoiceNumber: r.salesInvoiceNumber,
      exchangeId: r.exchangeId,
      createdBy: r.createdBy,
      createdAt: r.createdAt.toISOString(),
    };
  },
};

export interface PosPaymentDTO {
  id: string;
  companyId: string;
  receiptId: string;
  method: 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'CUSTOM';
  amount: number;
  changeGiven: number;
  reference?: string;
  createdAt: string;
}

export const PosPaymentDTO = {
  fromDomain(p: PosPayment): PosPaymentDTO {
    return {
      id: p.id,
      companyId: p.companyId,
      receiptId: p.receiptId,
      method: p.method,
      amount: p.amount,
      changeGiven: p.changeGiven,
      reference: p.reference,
      createdAt: p.createdAt.toISOString(),
    };
  },
};

export interface PosReturnLineDTO {
  itemId: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
  originalLineId?: string;
}

export interface PosReturnDTO {
  id: string;
  companyId: string;
  shiftId: string;
  registerId: string;
  returnNumber: string;
  originalReceiptId: string;
  originalReceiptNumber: string;
  salesInvoiceId: string;
  lines: PosReturnLineDTO[];
  refundMethod: 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'CUSTOM';
  refundTotal: number;
  salesReturnId?: string;
  salesReturnNumber?: string;
  exchangeId?: string;
  createdBy: string;
  createdAt: string;
}

export const PosReturnDTO = {
  fromDomain(r: PosReturn): PosReturnDTO {
    return {
      id: r.id,
      companyId: r.companyId,
      shiftId: r.shiftId,
      registerId: r.registerId,
      returnNumber: r.returnNumber,
      originalReceiptId: r.originalReceiptId,
      originalReceiptNumber: r.originalReceiptNumber,
      salesInvoiceId: r.salesInvoiceId,
      lines: r.lines,
      refundMethod: r.refundMethod,
      refundTotal: r.refundTotal,
      salesReturnId: r.salesReturnId,
      salesReturnNumber: r.salesReturnNumber,
      exchangeId: r.exchangeId,
      createdBy: r.createdBy,
      createdAt: r.createdAt.toISOString(),
    };
  },
};

export interface PosHeldCartLineDTO extends PosHeldCartLine {}

export interface PosHeldCartDTO {
  id: string;
  companyId: string;
  registerId: string;
  shiftId: string;
  cashierUserId: string;
  customerId?: string;
  note?: string;
  status: 'HELD' | 'RECALLED' | 'CANCELLED';
  lines: PosHeldCartLineDTO[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  recalledAt?: string;
  recalledBy?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  cancelReason?: string;
}

export const PosHeldCartDTO = {
  fromDomain(cart: PosHeldCart): PosHeldCartDTO {
    return {
      id: cart.id,
      companyId: cart.companyId,
      registerId: cart.registerId,
      shiftId: cart.shiftId,
      cashierUserId: cart.cashierUserId,
      customerId: cart.customerId,
      note: cart.note,
      status: cart.status,
      lines: cart.lines,
      subtotal: cart.subtotal,
      discountTotal: cart.discountTotal,
      taxTotal: cart.taxTotal,
      grandTotal: cart.grandTotal,
      createdBy: cart.createdBy,
      createdAt: cart.createdAt.toISOString(),
      updatedAt: cart.updatedAt.toISOString(),
      recalledAt: cart.recalledAt?.toISOString(),
      recalledBy: cart.recalledBy,
      cancelledAt: cart.cancelledAt?.toISOString(),
      cancelledBy: cart.cancelledBy,
      cancelReason: cart.cancelReason,
    };
  },
};
