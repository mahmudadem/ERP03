
export class POSOrderItem {
  constructor(
    public itemId: string,
    public name: string,
    public qty: number,
    public price: number,
    public discount: number = 0
  ) {}

  public get total(): number {
    return (this.price * this.qty) - this.discount;
  }
}

export class POSOrder {
  constructor(
    public id: string,
    public companyId: string,
    public shiftId: string,
    public items: POSOrderItem[],
    public totalAmount: number,
    public createdAt: Date,
    public status: 'COMPLETED' | 'VOIDED' | 'PENDING'
  ) {}
}
