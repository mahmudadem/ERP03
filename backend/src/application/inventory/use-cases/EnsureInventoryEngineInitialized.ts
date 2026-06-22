import { ICompanyModuleRepository } from '../../../repository/interfaces/company/ICompanyModuleRepository';
import { ICompanyRepository } from '../../../repository/interfaces/core/ICompanyRepository';
import { InitializeInventoryUseCase } from './InitializeInventoryUseCase';

/**
 * EnsureInventoryEngineInitialized
 *
 * Idempotent guard that guarantees the Inventory / catalog / stock **Engine** is ready before any
 * module that consumes items (Sales, Purchases, POS) starts up. Mirror of
 * `EnsureAccountingEngineInitialized` (see PR1 / done/102) for the engines-vs-modules rule
 * (Task 254): the stock engine is always-on — items, stock levels, and oversell protection must
 * work for any module, gated by *permission*, never by whether the Inventory **module/UI** is
 * enabled.
 *
 * Behavior:
 *   - If the inventory CompanyModule.initialized === true → no-op.
 *   - Otherwise initialize the engine with safe defaults (Main warehouse, base UOM, settings).
 *     No GL account links are required — the engine tracks stock without accounting; posting to
 *     the ledger is a separate concern resolved by the accounting bridge (full vs minimal).
 *
 * The Inventory **module/UI** visibility (`CompanyModule.isEnabled`) is never consulted here.
 */
export class EnsureInventoryEngineInitialized {
  constructor(
    private readonly companyModuleRepo: ICompanyModuleRepository,
    private readonly companyRepo: ICompanyRepository,
    private readonly initializeInventoryUseCase: InitializeInventoryUseCase
  ) {}

  async execute(companyId: string, userId: string = 'SYSTEM'): Promise<void> {
    const inventoryModule = await this.companyModuleRepo.get(companyId, 'inventory');
    if (inventoryModule?.initialized) {
      return;
    }

    const company = await this.companyRepo.findById(companyId);
    if (!company) {
      throw new Error(`Cannot initialize inventory engine: company not found (${companyId})`);
    }

    await this.initializeInventoryUseCase.execute({
      companyId,
      userId,
      defaultCostCurrency: company.baseCurrency || undefined,
    });
  }
}
