
import { ExchangeRate } from '../../../domain/accounting/entities/ExchangeRate';
import { IExchangeRateRepository } from '../../../repository/interfaces/accounting';

export class SetExchangeRateUseCase {
  constructor(private repo: IExchangeRateRepository) {}

  async execute(from: string, to: string, rate: number, date: Date): Promise<void> {
    const exRate = new ExchangeRate(`er_${Date.now()}`, from, to, rate, date);
    await this.repo.setRate(exRate);
  }
}

export class GetExchangeRateUseCase {
  constructor(private repo: IExchangeRateRepository) {}

  async execute(from: string, to: string, date: Date): Promise<number> {
    const rateEntity = await this.repo.getRate(from, to, date);
    return rateEntity ? rateEntity.rate : 1.0;
  }
}
