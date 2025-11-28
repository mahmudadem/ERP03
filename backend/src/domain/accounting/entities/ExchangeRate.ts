
export class ExchangeRate {
  constructor(
    public id: string,
    public fromCurrency: string,
    public toCurrency: string,
    public rate: number,
    public date: Date
  ) {}
}
