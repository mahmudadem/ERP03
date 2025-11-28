
import { POSShift } from '../../../domain/pos/entities/POSShift';
import { POSOrder } from '../../../domain/pos/entities/POSOrder';

/**
 * Interface for Point of Sale Shifts.
 */
export interface IPosShiftRepository {
  openShift(shift: POSShift): Promise<void>;
  closeShift(id: string, closedAt: Date, closingBalance: number): Promise<void>;
  getShift(id: string): Promise<POSShift | null>;
  getCompanyShifts(companyId: string): Promise<POSShift[]>;
}

/**
 * Interface for Point of Sale Orders.
 */
export interface IPosOrderRepository {
  createOrder(order: POSOrder): Promise<void>;
  getOrder(id: string): Promise<POSOrder | null>;
  getCompanyOrders(companyId: string): Promise<POSOrder[]>;
}
