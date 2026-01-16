import { VoucherEntity } from '../entities/VoucherEntity';
import { VoucherType, VoucherStatus } from '../types/VoucherTypes';

/**
 * Voucher Repository Interface
 * 
 * ADR-005 Compliant - Simple, Clear Contract
 * 
 * This is the persistence abstraction for vouchers.
 * Implementations can be Firestore, Postgres, or any other storage.
 * 
 * Principles:
 * - Methods are explicit and obvious
 * - No magic queries or dynamic filters
 * - Returns domain entities, not DTOs
 * - Async for all operations (supports any backing store)
 */
export interface IVoucherRepository {
  /**
   * Save a new voucher or update existing
   * 
   * @param voucher Voucher entity to save
   * @returns The saved voucher (with any DB-generated fields)
   */
  save(voucher: VoucherEntity): Promise<VoucherEntity>;

  /**
   * Find voucher by ID
   * 
   * @param companyId Company ID
   * @param voucherId Voucher ID
   * @returns Voucher entity or null if not found
   */
  findById(companyId: string, voucherId: string): Promise<VoucherEntity | null>;

  /**
   * Find vouchers by company and type
   * 
   * @param companyId Company ID
   * @param type Voucher type filter
   * @param limit Maximum results (default: 100)
   * @returns Array of voucher entities
   */
  findByType(companyId: string, type: VoucherType, limit?: number): Promise<VoucherEntity[]>;

  /**
   * Find vouchers by company and status
   * 
   * @param companyId Company ID
   * @param status Status filter
   * @param limit Maximum results (default: 100)
   * @returns Array of voucher entities
   */
  findByStatus(companyId: string, status: VoucherStatus, limit?: number): Promise<VoucherEntity[]>;

  /**
   * Find vouchers by date range
   * 
   * @param companyId Company ID
   * @param startDate Start date (inclusive, ISO format)
   * @param endDate End date (inclusive, ISO format)
   * @param limit Maximum results (default: 100)
   * @returns Array of voucher entities
   */
  findByDateRange(
    companyId: string,
    startDate: string,
    endDate: string,
    limit?: number
  ): Promise<VoucherEntity[]>;

  /**
   * Find all vouchers for a company
   * 
   * Warning: This can return large result sets. Use with caution.
   * Consider adding pagination in future.
   * 
   * @param companyId Company ID
   * @param limit Maximum results (default: 100)
   * @returns Array of voucher entities
   */
  findByCompany(companyId: string, limit?: number): Promise<VoucherEntity[]>;

  /**
   * Delete a voucher
   * 
   * Note: This should only be allowed for DRAFT vouchers.
   * Business logic should prevent deleting approved/locked vouchers.
   * 
   * @param companyId Company ID
   * @param voucherId Voucher ID
   * @returns true if deleted, false if not found
   */
  delete(companyId: string, voucherId: string): Promise<boolean>;

  /**
   * Check if a voucher number already exists
   * 
   * Used to ensure unique voucher numbers.
   * 
   * @param companyId Company ID
   * @param voucherNo Voucher number to check
   * @returns true if exists, false otherwise
   */
  existsByNumber(companyId: string, voucherNo: string): Promise<boolean>;

  /**
   * Count vouchers that use a specific form layout
   * 
   * Used for dependency checks before deleting a form.
   * Implementation should use efficient database counting if available.
   * 
   * @param companyId Company ID
   * @param formId Form ID
   */
  countByFormId(companyId: string, formId: string): Promise<number>;

  /**
   * Find a reversal voucher for a specific original voucher
   * 
   * @param companyId Company ID
   * @param originalVoucherId ID of the original voucher being reversed
   */
  findByReversalOfVoucherId(companyId: string, originalVoucherId: string): Promise<VoucherEntity | null>;

  /**
   * Count vouchers using a specific currency (header or lines)
   * 
   * @param companyId Company ID
   * @param currencyCode Currency code to check
   */
  countByCurrency(companyId: string, currencyCode: string): Promise<number>;

  /**
   * Find vouchers in PENDING status requiring financial approval
   * 
   * @param companyId Company ID
   * @param limit Maximum results
   */
  findPendingFinancialApprovals(companyId: string, limit?: number): Promise<VoucherEntity[]>;

  /**
   * Find vouchers in PENDING status requiring custody confirmation from specific user
   * 
   * @param companyId Company ID
   * @param custodianUserId User ID of custodian
   * @param limit Maximum results
   */
  findPendingCustodyConfirmations(companyId: string, custodianUserId: string, limit?: number): Promise<VoucherEntity[]>;
}
