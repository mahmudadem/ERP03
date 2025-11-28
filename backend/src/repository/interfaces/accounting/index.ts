
import { Account } from '../../../domain/accounting/entities/Account';
import { Voucher } from '../../../domain/accounting/entities/Voucher';
import { CostCenter } from '../../../domain/accounting/entities/CostCenter';
import { ExchangeRate } from '../../../domain/accounting/entities/ExchangeRate';

/**
 * Interface for Chart of Accounts access.
 */
export interface IAccountRepository {
  createAccount(account: Account): Promise<void>;
  updateAccount(id: string, data: Partial<Account>): Promise<void>;
  deactivateAccount(id: string): Promise<void>;
  getAccount(id: string): Promise<Account | null>;
  getAccounts(companyId: string): Promise<Account[]>;
}

/**
 * Interface for Voucher/Transaction access.
 */
export interface IVoucherRepository {
  createVoucher(voucher: Voucher): Promise<void>;
  updateVoucher(id: string, data: Partial<Voucher>): Promise<void>;
  deleteVoucher(id: string): Promise<void>;
  getVoucher(id: string): Promise<Voucher | null>;
  getVouchers(companyId: string, filters?: any): Promise<Voucher[]>;
}

/**
 * Interface for Cost Center access.
 */
export interface ICostCenterRepository {
  createCostCenter(costCenter: CostCenter): Promise<void>;
  updateCostCenter(id: string, data: Partial<CostCenter>): Promise<void>;
  getCostCenter(id: string): Promise<CostCenter | null>;
  getCompanyCostCenters(companyId: string): Promise<CostCenter[]>;
}

/**
 * Interface for Exchange Rate access.
 */
export interface IExchangeRateRepository {
  setRate(rate: ExchangeRate): Promise<void>;
  getRate(fromCurrency: string, toCurrency: string, date: Date): Promise<ExchangeRate | null>;
}
