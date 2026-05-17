/**
 * AiCreditLedger - Domain Entity
 *
 * Tracks the AI credit balance for a company (tenant).
 * Credits are the currency for the CREDITS runtime mode:
 * - Tenants purchase credits or receive them from Super Admin grants
 * - Each successful AI request debits 1 credit (or token-based amount)
 * - When credits are exhausted, the tenant must purchase more or switch to BYOK mode
 *
 * Business rules:
 * - A company always has exactly one ledger (singleton per tenant)
 * - Debit throws if balance is insufficient
 * - Credit adds to both balance and totalPurchased
 * - Debit adds to totalConsumed
 * - No negative amounts allowed
 */

export interface AiCreditLedgerProps {
  id: string;
  companyId: string;
  balance: number;
  totalPurchased: number;
  totalConsumed: number;
  lastDebitAt?: Date;
  lastCreditAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class AiCreditLedger implements AiCreditLedgerProps {
  constructor(
    public id: string,
    public companyId: string,
    public balance: number,
    public totalPurchased: number,
    public totalConsumed: number,
    public lastDebitAt: Date | undefined,
    public lastCreditAt: Date | undefined,
    public createdAt: Date,
    public updatedAt: Date,
  ) {}

  /**
   * Factory method to create a new credit ledger for a company.
   */
  static create(companyId: string, initialCredits: number): AiCreditLedger {
    if (initialCredits < 0) {
      throw new Error('AiCreditLedger: initialCredits cannot be negative');
    }

    const now = new Date();
    const id = `credit_ledger_${companyId}`;

    return new AiCreditLedger(
      id,
      companyId,
      initialCredits,
      initialCredits,  // totalPurchased starts at initialCredits
      0,               // totalConsumed starts at 0
      undefined,       // lastDebitAt
      initialCredits > 0 ? now : undefined, // lastCreditAt if credits were granted
      now,
      now,
    );
  }

  /**
   * Debit (consume) credits from the ledger.
   * Throws if insufficient balance or invalid amount.
   */
  debit(amount: number, _reason: string): void {
    if (amount <= 0) {
      throw new Error('AiCreditLedger: debit amount must be positive');
    }
    if (this.balance < amount) {
      throw new Error('Insufficient AI credits. Please purchase more credits or switch to BYOK mode.');
    }

    this.balance -= amount;
    this.totalConsumed += amount;
    this.lastDebitAt = new Date();
    this.updatedAt = new Date();
  }

  /**
   * Credit (add) credits to the ledger.
   * Used when Super Admin grants credits or tenant purchases credits.
   */
  credit(amount: number, _reason: string): void {
    if (amount <= 0) {
      throw new Error('AiCreditLedger: credit amount must be positive');
    }

    this.balance += amount;
    this.totalPurchased += amount;
    this.lastCreditAt = new Date();
    this.updatedAt = new Date();
  }

  /**
   * Check if the ledger has any remaining credits.
   */
  hasCredits(): boolean {
    return this.balance > 0;
  }

  /**
   * Check if the ledger can cover a debit of the given amount.
   * Use this when the per-request cost is known (e.g. model creditCost).
   */
  canAfford(amount: number): boolean {
    if (!Number.isFinite(amount) || amount < 0) return false;
    if (amount === 0) return true;
    return this.balance >= amount;
  }

  /**
   * Serialize to JSON for API responses and persistence.
   * Never includes mutation history — only current state.
   */
  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      companyId: this.companyId,
      balance: this.balance,
      totalPurchased: this.totalPurchased,
      totalConsumed: this.totalConsumed,
      lastDebitAt: this.lastDebitAt?.toISOString() || null,
      lastCreditAt: this.lastCreditAt?.toISOString() || null,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }

  /**
   * Deserialize from JSON (Firestore document, API response, etc.)
   */
  static fromJSON(data: Record<string, any>): AiCreditLedger {
    return new AiCreditLedger(
      data.id,
      data.companyId,
      data.balance ?? 0,
      data.totalPurchased ?? 0,
      data.totalConsumed ?? 0,
      data.lastDebitAt?.toDate?.() || (data.lastDebitAt ? new Date(data.lastDebitAt) : undefined),
      data.lastCreditAt?.toDate?.() || (data.lastCreditAt ? new Date(data.lastCreditAt) : undefined),
      data.createdAt?.toDate?.() || new Date(data.createdAt),
      data.updatedAt?.toDate?.() || new Date(data.updatedAt),
    );
  }
}