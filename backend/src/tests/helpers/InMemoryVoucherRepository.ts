import { IVoucherRepository } from '../../domain/accounting/repositories/IVoucherRepository';
import { VoucherEntity } from '../../domain/accounting/entities/VoucherEntity';
import { VoucherStatus, VoucherType } from '../../domain/accounting/types/VoucherTypes';

/**
 * Lightweight in‑memory implementation of IVoucherRepository for tests.
 * Stores vouchers in a Map keyed by companyId → voucherId.
 */
export class InMemoryVoucherRepository implements IVoucherRepository {
  private store: Map<string, Map<string, VoucherEntity>> = new Map();

  private getCompanyMap(companyId: string): Map<string, VoucherEntity> {
    if (!this.store.has(companyId)) {
      this.store.set(companyId, new Map());
    }
    return this.store.get(companyId)!;
  }

  async save(voucher: VoucherEntity, transaction?: any): Promise<VoucherEntity> {
    this.getCompanyMap(voucher.companyId).set(voucher.id, voucher);
    return voucher;
  }

  async findById(companyId: string, voucherId: string): Promise<VoucherEntity | null> {
    return this.getCompanyMap(companyId).get(voucherId) || null;
  }

  async findByType(companyId: string, type: VoucherType, limit: number = 100): Promise<VoucherEntity[]> {
    return Array.from(this.getCompanyMap(companyId).values())
      .filter(v => v.type === type)
      .slice(0, limit);
  }

  async findByStatus(companyId: string, status: VoucherStatus, limit: number = 100): Promise<VoucherEntity[]> {
    return Array.from(this.getCompanyMap(companyId).values())
      .filter(v => v.status === status)
      .slice(0, limit);
  }

  async findByDateRange(companyId: string, startDate: string, endDate: string, limit: number = 100): Promise<VoucherEntity[]> {
    return Array.from(this.getCompanyMap(companyId).values())
      .filter(v => v.date >= startDate && v.date <= endDate)
      .slice(0, limit);
  }

  async findByCompany(companyId: string, limit: number = 100): Promise<VoucherEntity[]> {
    return Array.from(this.getCompanyMap(companyId).values()).slice(0, limit);
  }

  async delete(companyId: string, voucherId: string): Promise<boolean> {
    return this.getCompanyMap(companyId).delete(voucherId);
  }

  async existsByNumber(companyId: string, voucherNo: string): Promise<boolean> {
    return Array.from(this.getCompanyMap(companyId).values()).some(v => v.voucherNo === voucherNo);
  }

  async countByFormId(companyId: string, formId: string): Promise<number> {
    return Array.from(this.getCompanyMap(companyId).values()).filter(v => v.metadata?.formId === formId).length;
  }

  async findByReversalOfVoucherId(companyId: string, originalVoucherId: string): Promise<VoucherEntity | null> {
    return Array.from(this.getCompanyMap(companyId).values()).find(v => v.reversalOfVoucherId === originalVoucherId) || null;
  }

  async countByCurrency(companyId: string, currencyCode: string): Promise<number> {
    return Array.from(this.getCompanyMap(companyId).values())
      .filter(v => v.currency === currencyCode || v.baseCurrency === currencyCode).length;
  }

  async findPendingFinancialApprovals(companyId: string, limit: number = 100): Promise<VoucherEntity[]> {
    return Array.from(this.getCompanyMap(companyId).values())
      .filter(v => v.status === VoucherStatus.PENDING)
      .slice(0, limit);
  }

  async findPendingCustodyConfirmations(companyId: string, custodianUserId: string, limit: number = 100): Promise<VoucherEntity[]> {
    return Array.from(this.getCompanyMap(companyId).values())
      .filter(v => v.metadata?.pendingCustodyConfirmations?.includes(custodianUserId))
      .slice(0, limit);
  }

  async getRecent(companyId: string, limit: number): Promise<VoucherEntity[]> {
    return Array.from(this.getCompanyMap(companyId).values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  async getCounts(companyId: string, monthStart: string, monthEnd: string): Promise<{
    total: number;
    draft: number;
    pending: number;
    postedThisMonth: number;
    lastMonthTotal: number;
    unbalancedDrafts: number;
  }> {
    const vouchers = Array.from(this.getCompanyMap(companyId).values());
    const total = vouchers.length;
    const draft = vouchers.filter(v => v.status === VoucherStatus.DRAFT).length;
    const pending = vouchers.filter(v => v.status === VoucherStatus.PENDING).length;
    const postedThisMonth = vouchers.filter(v => v.postedAt && v.date >= monthStart && v.date <= monthEnd).length;
    const lastMonthTotal = 0; // not tracked in memory
    const unbalancedDrafts = vouchers.filter(v => v.status === VoucherStatus.DRAFT && !v.isBalanced).length;
    return { total, draft, pending, postedThisMonth, lastMonthTotal, unbalancedDrafts };
  }
}
