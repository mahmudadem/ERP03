/**
 * Thrown when a customer's projected credit exposure exceeds their creditLimit
 * and the creditHoldPolicy is 'BLOCK'.
 *
 * Carries structured numbers so the API response can surface a rich dialog
 * to the user (showing current exposure, order amount, and the limit).
 */
export interface CreditLimitExceededDetails {
  companyId?: string;
  customerId: string;
  customerName?: string;
  creditLimit: number;
  currentExposure: number;
  orderAmount: number;
  projectedExposure: number;
}

export class CreditLimitExceededError extends Error {
  readonly code = 'CREDIT_LIMIT_EXCEEDED';
  readonly statusCode = 422;
  readonly companyId: string | undefined;
  readonly customerId: string;
  readonly customerName: string | undefined;
  readonly creditLimit: number;
  readonly currentExposure: number;
  readonly orderAmount: number;
  readonly projectedExposure: number;

  constructor(details: CreditLimitExceededDetails) {
    const customerLabel = details.customerName ?? details.customerId;
    const message =
      `Credit limit exceeded for customer ${customerLabel}. ` +
      `Limit: ${details.creditLimit}, current exposure: ${details.currentExposure}, ` +
      `order amount: ${details.orderAmount}, projected exposure: ${details.projectedExposure}.`;
    super(message);
    this.name = 'CreditLimitExceededError';
    this.companyId = details.companyId;
    this.customerId = details.customerId;
    this.customerName = details.customerName;
    this.creditLimit = details.creditLimit;
    this.currentExposure = details.currentExposure;
    this.orderAmount = details.orderAmount;
    this.projectedExposure = details.projectedExposure;
  }
}
