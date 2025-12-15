import { IVoucherRepository } from '../../src/domain/accounting/repositories/IVoucherRepository';
import { VoucherEntity } from '../../src/domain/accounting/entities/VoucherEntity';
import { VoucherType, VoucherStatus } from '../../src/domain/accounting/types/VoucherTypes';

/**
 * In-Memory Voucher Repository
 * 
 * For testing purposes only.
 * Stores vouchers in memory instead of database.
 */
export class InMemoryVoucherRepository implements IVoucherRepository {
  private vouchers: Map<string, VoucherEntity> = new Map();

  async save(voucher: VoucherEntity): Promise<VoucherEntity> {
    const key = `${voucher.companyId}:${voucher.id}`;
    this.vouchers.set(key, voucher);
    return voucher;
  }

  async findById(companyId: string, voucherId: string): Promise<VoucherEntity | null> {
    const key = `${companyId}:${voucherId}`;
    return this.vouchers.get(key) || null;
  }

  async findByType(
    companyId: string,
    type: VoucherType,
    limit: number = 100
  ): Promise<VoucherEntity[]> {
    return Array.from(this.vouchers.values())
      .filter(v => v.companyId === companyId && v.type === type)
      .slice(0, limit);
  }

  async findByStatus(
    companyId: string,
    status: VoucherStatus,
    limit: number = 100
  ): Promise<VoucherEntity[]> {
    return Array.from(this.vouchers.values())
      .filter(v => v.companyId === companyId && v.status === status)
      .slice(0, limit);
  }

  async findByDateRange(
    companyId: string,
    startDate: string,
    endDate: string,
    limit: number = 100
  ): Promise<VoucherEntity[]> {
    return Array.from(this.vouchers.values())
      .filter(v => 
        v.companyId === companyId &&
        v.date >= startDate &&
        v.date <= endDate
      )
      .slice(0, limit);
  }

  async findByCompany(companyId: string, limit: number = 100): Promise<VoucherEntity[]> {
    return Array.from(this.vouchers.values())
      .filter(v => v.companyId === companyId)
      .slice(0, limit);
  }

  async delete(companyId: string, voucherId: string): Promise<boolean> {
    const key = `${companyId}:${voucherId}`;
    return this.vouchers.delete(key);
  }

  async existsByNumber(companyId: string, voucherNo: string): Promise<boolean> {
    return Array.from(this.vouchers.values())
      .some(v => v.companyId === companyId && v.voucherNo === voucherNo);
  }

  // Test helpers
  clear(): void {
    this.vouchers.clear();
  }

  count(): number {
    return this.vouchers.size;
  }
}
