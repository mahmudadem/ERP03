
export class POSShift {
  constructor(
    public id: string,
    public companyId: string,
    public userId: string,
    public openedAt: Date,
    public openingBalance: number,
    public closedAt?: Date,
    public closingBalance?: number
  ) {}

  public isOpen(): boolean {
    return !this.closedAt;
  }
}
