import { Party } from '../../../domain/shared/entities/Party';
import { ISalesInvoiceRepository } from '../../../repository/interfaces/sales/ISalesInvoiceRepository';

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export interface CreditCheckResult {
  /** false when customer has no creditLimit configured — no enforcement applied */
  enforced: boolean;
  creditLimit: number;
  /** Sum of outstandingAmountBase across the customer's POSTED invoices (base currency) */
  currentExposure: number;
  /** The sales order grandTotalBase passed to check() */
  orderAmount: number;
  /** currentExposure + orderAmount */
  projectedExposure: number;
  /** true when projectedExposure <= creditLimit, or when enforced is false */
  withinLimit: boolean;
  policy: 'NONE' | 'WARN' | 'BLOCK';
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * Application service that computes a customer's credit exposure before a
 * sales order is confirmed. Keeps the check logic decoupled from any use case.
 */
export class CreditCheckService {
  constructor(private readonly salesInvoiceRepo: ISalesInvoiceRepository) {}

  /**
   * Compute the credit check result for a given customer and order amount.
   *
   * currentExposure is derived by summing outstandingAmountBase across all
   * POSTED invoices for the customer that are not yet fully paid.
   * (The repo list filter uses status='POSTED'; the SalesInvoice has
   * outstandingAmountBase which already reflects partial payments.)
   */
  async check(
    companyId: string,
    customer: Party,
    orderAmountBase: number
  ): Promise<CreditCheckResult> {
    // No limit configured → not enforced
    if (customer.creditLimit === undefined || customer.creditLimit === null) {
      return {
        enforced: false,
        creditLimit: 0,
        currentExposure: 0,
        orderAmount: orderAmountBase,
        projectedExposure: orderAmountBase,
        withinLimit: true,
        policy: 'NONE',
      };
    }

    // Fetch all POSTED invoices for this customer
    const invoices = await this.salesInvoiceRepo.list(companyId, {
      customerId: customer.id,
      status: 'POSTED',
    });

    const currentExposure = invoices.reduce(
      (sum, inv) => sum + (inv.outstandingAmountBase ?? 0),
      0
    );

    const creditLimit = customer.creditLimit;
    const projectedExposure = currentExposure + orderAmountBase;
    const withinLimit = projectedExposure <= creditLimit;
    const policy = customer.creditHoldPolicy ?? 'NONE';

    return {
      enforced: true,
      creditLimit,
      currentExposure,
      orderAmount: orderAmountBase,
      projectedExposure,
      withinLimit,
      policy,
    };
  }
}
