
export type StockDirection = 'IN' | 'OUT';
export type MovementReferenceType = 'VOUCHER' | 'POS_ORDER' | 'ADJUSTMENT' | 'TRANSFER';

export class StockMovement {
  constructor(
    public id: string,
    public companyId: string,
    public itemId: string,
    public warehouseId: string,
    public qty: number,
    public direction: StockDirection,
    public referenceType: MovementReferenceType,
    public referenceId: string,
    public date: Date
  ) {}
}
