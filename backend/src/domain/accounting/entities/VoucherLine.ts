
export class VoucherLine {
  constructor(
    public id: string,
    public voucherId: string,
    public accountId: string,
    public description: string,
    public fxAmount: number, // Amount in foreign currency
    public baseAmount: number, // Amount in base currency
    public rateAccToBase: number,
    public costCenterId?: string
  ) {}
}
