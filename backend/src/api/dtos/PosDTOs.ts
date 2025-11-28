
/**
 * PosDTOs.ts
 */
import { POSShift } from '../../domain/pos/entities/POSShift';
import { POSOrder } from '../../domain/pos/entities/POSOrder';

export interface POSShiftDTO {
  id: string;
  userId: string;
  openedAt: string;
  closedAt?: string;
  isOpen: boolean;
}

export interface POSOrderDTO {
  id: string;
  totalAmount: number;
  status: string;
  itemCount: number;
}

export class PosDTOMapper {
  static toShiftDTO(shift: POSShift): POSShiftDTO {
    return {
      id: shift.id,
      userId: shift.userId,
      openedAt: shift.openedAt.toISOString(),
      closedAt: shift.closedAt?.toISOString(),
      isOpen: shift.isOpen(),
    };
  }

  static toOrderDTO(order: POSOrder): POSOrderDTO {
    return {
      id: order.id,
      totalAmount: order.totalAmount,
      status: order.status,
      itemCount: order.items.length,
    };
  }
}
