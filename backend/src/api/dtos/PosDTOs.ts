/**
 * PosDTOs.ts — DTO mappers for the POS module.
 * Pure data shape; no business logic.
 */
import { PosRegister } from '../../domain/pos/entities/PosRegister';
import { PosSettings } from '../../domain/pos/entities/PosSettings';
import { PosShift } from '../../domain/pos/entities/PosShift';

export interface PosRegisterDTO {
  id: string;
  companyId: string;
  code: string;
  name: string;
  branchId?: string;
  warehouseId: string;
  cashDrawerAccountId: string;
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
  paymentMethods: PosPaymentMethodDTO[];
}

export interface PosShiftDTO {
  id: string;
  companyId: string;
  registerId: string;
  cashierUserId: string;
  status: 'OPEN' | 'CLOSED' | 'FORCE_CLOSED' | 'CANCELLED';
  openedAt: string;
  openingFloat: number;
  closedAt?: string;
  expectedCash?: number;
  countedCash?: number;
  overShortAmount?: number;
  overShortVoucherId?: string;
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
      cashDrawerAccountId: register.cashDrawerAccountId,
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
      overShortAmount: shift.overShortAmount,
      overShortVoucherId: shift.overShortVoucherId,
      createdAt: shift.createdAt.toISOString(),
      updatedAt: shift.updatedAt.toISOString(),
    };
  }
}
