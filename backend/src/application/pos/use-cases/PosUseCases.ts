
import { POSShift } from '../../../domain/pos/entities/POSShift';
import { POSOrder } from '../../../domain/pos/entities/POSOrder';
import { IPosShiftRepository, IPosOrderRepository } from '../../../repository/interfaces/pos';

export class OpenPOSShiftUseCase {
  constructor(private shiftRepo: IPosShiftRepository) {}

  async execute(data: { companyId: string; userId: string; openingBalance: number }): Promise<POSShift> {
    const shift = new POSShift(
      `shift_${Date.now()}`,
      data.companyId,
      data.userId,
      new Date(),
      data.openingBalance
    );
    await this.shiftRepo.openShift(shift);
    return shift;
  }
}

export class ClosePOSShiftUseCase {
  constructor(private shiftRepo: IPosShiftRepository) {}
  async execute(id: string, closingBalance: number): Promise<void> {
    await this.shiftRepo.closeShift(id, new Date(), closingBalance);
  }
}

export class CreatePOSOrderUseCase {
  constructor(private orderRepo: IPosOrderRepository) {}

  async execute(data: any): Promise<POSOrder> {
    const order = new POSOrder(
      `ord_${Date.now()}`,
      data.companyId,
      data.shiftId,
      data.items,
      data.total, // Should be calculated in real app
      new Date(),
      'COMPLETED'
    );
    await this.orderRepo.createOrder(order);
    return order;
  }
}
