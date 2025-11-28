
import { POSShift } from '../../../domain/pos/entities/POSShift';

/**
 * Interface for Point of Sale Shifts.
 */
export interface IPosShiftRepository {
  openShift(shift: POSShift): Promise<void>;
  closeShift(id: string, closedAt: Date, closingBalance: number): Promise<void>;
  getShift(id: string): Promise<POSShift | null>;
  getCompanyShifts(companyId: string): Promise<POSShift[]>;
}
