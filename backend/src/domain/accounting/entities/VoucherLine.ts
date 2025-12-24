export class VoucherLine {
  constructor(
    public id: string,
    public voucherId: string,
    public accountId: string,
    public description: string | null = null,
    public fxAmount: number = 0,
    public baseAmount: number = 0,
    public rateAccToBase: number = 1,
    public costCenterId?: string | null
  ) {}

  // Optional aliases for other parts of the app
  public debitFx?: number;
  public creditFx?: number;
  public debitBase?: number;
  public creditBase?: number;
  public lineCurrency?: string;
  public exchangeRate?: number;
  public metadata: Record<string, any> = {};
}
