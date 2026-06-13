import { IAccountRepository } from '../../../repository/interfaces/accounting/IAccountRepository';
import { IInventorySettingsRepository } from '../../../repository/interfaces/inventory/IInventorySettingsRepository';
import { IItemRepository } from '../../../repository/interfaces/inventory/IItemRepository';
import { IStockLevelRepository } from '../../../repository/interfaces/inventory/IStockLevelRepository';

/**
 * Port for reading GL closing balances, kept inventory-side so this use-case does
 * not depend on the ledger repository directly (accounting-boundary guard). The
 * composition root supplies an implementation backed by the trial balance.
 */
export interface IGLAccountBalanceProvider {
  /** Returns the signed closing balance (debit − credit) per account as of the date. */
  getAccountBalances(companyId: string, asOfDate: string): Promise<Array<{ accountId: string; balanceBase: number }>>;
}

export interface InventoryGLReconciliationLine {
  accountId: string;
  accountCode: string;
  accountName: string;
  /** Inventory sub-ledger value = Σ(qtyOnHand × avgCostBase) for items mapped to this account. */
  stockValueBase: number;
  /** GL closing balance of the inventory asset account (debit-natural). */
  glBalanceBase: number;
  /** glBalance − stockValue. Non-zero = drift between the GL and the stock sub-ledger. */
  differenceBase: number;
  matched: boolean;
}

export interface InventoryGLReconciliationResult {
  asOfDate: string;
  isReconciled: boolean;
  totalStockValueBase: number;
  totalGLBalanceBase: number;
  totalDifferenceBase: number;
  /** Stock value whose item has no Inventory Asset account mapping (cannot be tied to GL). */
  unmappedStockValueBase: number;
  lines: InventoryGLReconciliationLine[];
}

const TOLERANCE = 0.01;
const round2 = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

/**
 * Compares the inventory sub-ledger (stock value = Σ qty × avg cost, grouped by each item's Inventory
 * Asset account) against the General Ledger balance of those same accounts. Any non-zero difference is
 * the drift class that silent costing bugs produce — this is the period-end control that catches it.
 *
 * Read-only: computes from current stock levels + the trial balance. No posting.
 */
export class ReconcileInventoryGLUseCase {
  constructor(
    private readonly stockLevelRepo: IStockLevelRepository,
    private readonly itemRepo: IItemRepository,
    private readonly inventorySettingsRepo: IInventorySettingsRepository,
    private readonly glBalanceProvider: IGLAccountBalanceProvider,
    private readonly accountRepo: IAccountRepository
  ) {}

  async execute(companyId: string, asOfDate?: string): Promise<InventoryGLReconciliationResult> {
    const effectiveDate = asOfDate || new Date().toISOString().split('T')[0];

    const [levels, settings, items, accounts, glBalances] = await Promise.all([
      this.stockLevelRepo.getAllLevels(companyId),
      this.inventorySettingsRepo.getSettings(companyId),
      this.itemRepo.getCompanyItems(companyId, { limit: 100000 }),
      this.accountRepo.list(companyId),
      this.glBalanceProvider.getAccountBalances(companyId, effectiveDate),
    ]);

    const itemById = new Map(items.map((item) => [item.id, item]));
    const accountById = new Map(accounts.map((a: any) => [a.id, a]));
    const fallbackAccountId = settings?.defaultInventoryAssetAccountId;

    // Sub-ledger: group stock value by the item's resolved Inventory Asset account.
    const stockValueByAccount = new Map<string, number>();
    let unmappedStockValueBase = 0;

    for (const level of levels) {
      const value = level.qtyOnHand * level.avgCostBase;
      if (Math.abs(value) < 1e-9) continue;

      const item = itemById.get(level.itemId);
      const accountId = item?.inventoryAssetAccountId || fallbackAccountId;
      if (!accountId) {
        unmappedStockValueBase += value;
        continue;
      }
      stockValueByAccount.set(accountId, (stockValueByAccount.get(accountId) || 0) + value);
    }

    // GL side: closing balance per account (provider returns debit − credit).
    const glBalanceByAccount = new Map<string, number>();
    for (const row of glBalances) {
      glBalanceByAccount.set(row.accountId, row.balanceBase || 0);
    }

    // Reconcile every account that has either stock value or a GL balance, that is an inventory asset account.
    const accountIds = new Set<string>([...stockValueByAccount.keys()]);
    // Include the settings default even if it currently has zero stock (so its GL drift still shows).
    if (fallbackAccountId) accountIds.add(fallbackAccountId);

    const lines: InventoryGLReconciliationLine[] = [];
    for (const accountId of accountIds) {
      const account = accountById.get(accountId);
      const stockValueBase = round2(stockValueByAccount.get(accountId) || 0);
      const glBalanceBase = round2(glBalanceByAccount.get(accountId) || 0);
      const differenceBase = round2(glBalanceBase - stockValueBase);
      lines.push({
        accountId,
        accountCode: account?.userCode || account?.code || accountId,
        accountName: account?.name || '',
        stockValueBase,
        glBalanceBase,
        differenceBase,
        matched: Math.abs(differenceBase) <= TOLERANCE,
      });
    }

    lines.sort((a, b) => a.accountCode.localeCompare(b.accountCode));

    const totalStockValueBase = round2(lines.reduce((s, l) => s + l.stockValueBase, 0) + unmappedStockValueBase);
    const totalGLBalanceBase = round2(lines.reduce((s, l) => s + l.glBalanceBase, 0));
    const totalDifferenceBase = round2(totalGLBalanceBase - (totalStockValueBase - round2(unmappedStockValueBase)));

    return {
      asOfDate: effectiveDate,
      isReconciled: lines.every((l) => l.matched) && Math.abs(unmappedStockValueBase) <= TOLERANCE,
      totalStockValueBase,
      totalGLBalanceBase,
      totalDifferenceBase,
      unmappedStockValueBase: round2(unmappedStockValueBase),
      lines,
    };
  }
}
