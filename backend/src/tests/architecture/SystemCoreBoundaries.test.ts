import * as fs from 'fs';
import * as path from 'path';

const SRC = path.resolve(__dirname, '../..');

const collectTsFiles = (dir: string): string[] => {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectTsFiles(full));
    else if (entry.isFile() && full.endsWith('.ts')) out.push(full);
  }
  return out;
};

describe('Architecture guard: system core boundaries', () => {
  it('250d2: POS must not import Sales application or domain internals', () => {
    const posDir = path.resolve(SRC, 'application/pos');
    const offenders: string[] = [];
    for (const file of collectTsFiles(posDir)) {
      const content = fs.readFileSync(file, 'utf8');
      if (importsSalesApplicationOrDomain(content)) {
        offenders.push(path.relative(SRC, file));
      }
    }
    expect(offenders).toEqual([]);
  });

  it('250d: POS sale path must not import Sales application or domain internals', () => {
    const saleFiles = [
      path.resolve(SRC, 'application/pos/use-cases/CompletePosSaleUseCase.ts'),
      path.resolve(SRC, 'application/pos/use-cases/PostPosSaleUseCase.ts'),
    ];
    const offenders = saleFiles
      .filter((file) => fs.existsSync(file))
      .filter((file) => {
        const content = fs.readFileSync(file, 'utf8');
        return importsSalesApplicationOrDomain(content);
      })
      .map((file) => path.relative(SRC, file));
    expect(offenders).toEqual([]);
  });

  it('Phase 0 exposes system-core contracts through the barrel', () => {
    const barrel = fs.readFileSync(path.resolve(SRC, 'application/system-core/index.ts'), 'utf8');
    for (const contract of [
      'IDocumentCore',
      'INumberingEngine',
      'IMoneyCore',
      'ITaxEngine',
      'ICommercialCore',
      'IPolicyEngine',
      'IApprovalEngine',
      'IAccountingBridge',
      'IAuditEngine',
      'IInventoryCore',
      'IFxEngine',
    ]) {
      expect(barrel).toContain(`contracts/${contract}`);
    }
  });

  it('250f: audited money call sites must not define local roundMoney helpers', () => {
    const allowed = new Set([
      path.normalize('application/system-core/money/roundMoney.ts'),
      path.normalize('domain/accounting/entities/VoucherLineEntity.ts'),
    ]);
    const offenders: string[] = [];
    for (const file of collectTsFiles(SRC)) {
      const rel = path.relative(SRC, file);
      if (allowed.has(path.normalize(rel))) continue;
      const content = fs.readFileSync(file, 'utf8');
      if (/\b(?:const|function)\s+roundMoney\b|\bexport\s+(?:const|function)\s+roundMoney\b/.test(content)) {
        offenders.push(rel);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('250g: application modules and controllers must route audit through IAuditEngine', () => {
    const roots = [
      path.resolve(SRC, 'application/sales'),
      path.resolve(SRC, 'application/purchases'),
      path.resolve(SRC, 'application/pos'),
      path.resolve(SRC, 'api/controllers'),
    ];
    const offenders: string[] = [];
    for (const root of roots) {
      for (const file of collectTsFiles(root)) {
        const content = fs.readFileSync(file, 'utf8');
        if (content.includes('RecordChangeService')) {
          offenders.push(path.relative(SRC, file));
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('250k: POS financial events must route through IAccountingBridge', () => {
    const roots = [
      path.resolve(SRC, 'application/pos'),
      path.resolve(SRC, 'api/controllers/pos'),
    ];
    const offenders: string[] = [];
    for (const root of roots) {
      for (const file of collectTsFiles(root)) {
        const content = fs.readFileSync(file, 'utf8');
        if (content.includes('SubledgerVoucherPostingService') || content.includes('.postInTransaction(')) {
          offenders.push(path.relative(SRC, file));
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('251: POS stock movement refs must keep POS document identity', () => {
    const saleFile = path.resolve(SRC, 'application/pos/use-cases/PostPosSaleUseCase.ts');
    const returnFile = path.resolve(SRC, 'application/pos/use-cases/PostPosReturnUseCase.ts');

    // POS posts its stock movements with the pure inventory helpers
    // (computeStockOutMovement / computeStockReturnInMovement), passing
    // `referenceType`. It must NEVER stamp a movement as a Sales document —
    // that would silently convert a POS sale into a sales invoice (gate #8).
    const forbidsSalesIdentity = /referenceType:\s*['"]SALES_(?:INVOICE|RETURN)['"]/;
    const offenders = [saleFile, returnFile]
      .filter((file) => fs.existsSync(file))
      .filter((file) => forbidsSalesIdentity.test(fs.readFileSync(file, 'utf8')))
      .map((file) => path.relative(SRC, file));
    expect(offenders).toEqual([]);

    // POS stock movements keep the POS document identity.
    expect(fs.readFileSync(saleFile, 'utf8')).toContain("referenceType: 'POS_DIRECT_SALE'");
    expect(fs.readFileSync(returnFile, 'utf8')).toContain("referenceType: 'POS_RETURN'");
  });

  it('250h: tax engine contract and adapter must not import Sales calculation internals', () => {
    const files = [
      path.resolve(SRC, 'application/system-core/contracts/ITaxEngine.ts'),
      path.resolve(SRC, 'application/system-core/adapters/LegacyTaxEngineAdapter.ts'),
      path.resolve(SRC, 'application/system-core/tax/TaxEngine.ts'),
    ];
    const offenders = files
      .filter((file) => fs.existsSync(file))
      .filter((file) => fs.readFileSync(file, 'utf8').includes('sales/services/SalesInvoiceCalculationService'))
      .map((file) => path.relative(SRC, file));
    expect(offenders).toEqual([]);
  });

  it('250l-1: commercial core must not import Sales calculation internals', () => {
    const files = [
      path.resolve(SRC, 'application/system-core/contracts/ICommercialCore.ts'),
      path.resolve(SRC, 'application/system-core/adapters/LegacyCommercialCoreAdapter.ts'),
      path.resolve(SRC, 'application/system-core/commercial/CommercialCore.ts'),
    ];
    const offenders = files
      .filter((file) => fs.existsSync(file))
      .filter((file) => fs.readFileSync(file, 'utf8').includes('sales/services/SalesInvoiceCalculationService'))
      .map((file) => path.relative(SRC, file));
    expect(offenders).toEqual([]);
  });

  it('250h: POS must consume ITaxEngine instead of carrying a local line-tax calculator', () => {
    const posFiles = [
      path.resolve(SRC, 'application/pos/use-cases/PreviewPosSaleUseCase.ts'),
      path.resolve(SRC, 'application/pos/use-cases/PostPosSaleUseCase.ts'),
    ];
    const offenders = posFiles
      .filter((file) => fs.existsSync(file))
      .filter((file) => {
        const content = fs.readFileSync(file, 'utf8');
        return /function\s+calculate.*LineAmounts|afterDiscount\s+\*\s*input\.taxRate|1\s*\+\s*input\.taxRate/.test(content);
      })
      .map((file) => path.relative(SRC, file));
    expect(offenders).toEqual([]);
  });

  it('250i: POS sale completion must allocate receipt numbers through INumberingEngine', () => {
    const file = path.resolve(SRC, 'application/pos/use-cases/CompletePosSaleUseCase.ts');
    const content = fs.readFileSync(file, 'utf8');
    expect(content).toContain('numberingEngine.next');
    expect(content).not.toMatch(/receiptPrefix\s*\+\s*['"`-]/);
    expect(content).not.toMatch(/receiptNextSeq\)\.padStart\(6/);
  });

  it('250j: active inventory consumers must use IInventoryCore, not Sales/Purchases-named contracts', () => {
    const allowed = new Set([
      path.normalize('application/inventory/contracts/InventoryIntegrationContracts.ts'),
    ]);
    const offenders: string[] = [];
    for (const root of [
      path.resolve(SRC, 'application/sales'),
      path.resolve(SRC, 'application/purchases'),
      path.resolve(SRC, 'application/pos'),
      path.resolve(SRC, 'application/inventory/services'),
    ]) {
      for (const file of collectTsFiles(root)) {
        const rel = path.normalize(path.relative(SRC, file));
        if (allowed.has(rel)) continue;
        const content = fs.readFileSync(file, 'utf8');
        if (content.includes('ISalesInventoryService') || content.includes('IPurchasesInventoryService')) {
          offenders.push(path.relative(SRC, file));
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('FUP-4: Sales must not construct inventory sub-ledger movements/levels (delegate to inventory core)', () => {
    const salesDir = path.resolve(SRC, 'application/sales');
    const offenders: string[] = [];
    for (const file of collectTsFiles(salesDir)) {
      const content = fs.readFileSync(file, 'utf8');
      if (/new\s+StockMovement\s*\(|new\s+StockLevel\s*\(|StockLevel\.createNew\s*\(|StockLevel\.fromJSON\s*\(/.test(content)) {
        offenders.push(path.relative(SRC, file));
      }
    }
    expect(offenders).toEqual([]);
  });

  it('250j: Sales must delegate COGS account resolution and bucket accumulation to inventory core', () => {
    const salesFiles = [
      path.resolve(SRC, 'application/sales/use-cases/DeliveryNoteUseCases.ts'),
      path.resolve(SRC, 'application/sales/use-cases/SalesInvoiceUseCases.ts'),
      path.resolve(SRC, 'application/sales/use-cases/SalesReturnUseCases.ts'),
    ];
    for (const file of salesFiles) {
      const content = fs.readFileSync(file, 'utf8');
      expect(content).toContain('inventoryService.resolveCOGSAccounts');
      expect(content).toContain('inventoryService.addToCOGSBucket');
      expect(content).not.toContain('resolveCOGSAccountsSync');
      expect(content).not.toContain('interface AccumulatedCOGS');
      expect(content).not.toContain('interface COGSBucketLine');
    }
  });

  /**
   * Task 267-F — the Sales DeliveryNote COGS posting path was migrated from a
   * direct `SubledgerVoucherPostingService` field to `IAccountingBridge`-only.
   * This guard pins that migration: the use case must not import or reference
   * the legacy posting service / gateway, and must route through the bridge
   * helper. If a future change re-introduces the legacy dependency, this guard
   * fails — preventing silent regression of the engine boundary.
   */
  it('267-F: Sales DeliveryNote COGS posting must route through IAccountingBridge, not legacy posting services', () => {
    const file = path.resolve(SRC, 'application/sales/use-cases/DeliveryNoteUseCases.ts');
    expect(fs.existsSync(file)).toBe(true);
    const content = fs.readFileSync(file, 'utf8');
    expect(content).not.toContain('SubledgerVoucherPostingService');
    expect(content).not.toContain('PostingGateway');
    expect(content).toContain('postFinancialEvent');
    expect(content).toContain('IAccountingBridge');
  });

  /**
   * Task 267-F (SI slice) — the Sales Invoice document voucher path (revenue +
   * COGS) was migrated from a direct `SubledgerVoucherPostingService` field to
   * `IAccountingBridge`-only via `SubledgerDocumentPoster(undefined, bridge)`.
   * This guard pins that migration: the use case must not import or reference
   * the legacy posting service for document voucher posting.
   * Note: `PostingGateway` remains for the settlement receipt path (FUP-5
   * sanctioned pattern) and will be migrated in a follow-up slice.
   */
  it('267-F (SI): SalesInvoiceUseCases must not import SubledgerVoucherPostingService for document vouchers', () => {
    const file = path.resolve(SRC, 'application/sales/use-cases/SalesInvoiceUseCases.ts');
    expect(fs.existsSync(file)).toBe(true);
    const content = fs.readFileSync(file, 'utf8');
    expect(content).not.toContain('SubledgerVoucherPostingService');
    expect(content).toContain('SubledgerDocumentPoster');
    expect(content).toContain('IAccountingBridge');
  });

  /**
   * Task 267-F (SR slice) — the Sales Return document voucher path (revenue +
   * COGS) was migrated from a direct `SubledgerVoucherPostingService` field to
   * `IAccountingBridge`-only via `SubledgerDocumentPoster(undefined, bridge)`.
   * This guard pins that migration: the use case must not import or reference
   * the legacy posting service for document voucher posting.
   */
  it('267-F (SR): SalesReturnUseCases must not import SubledgerVoucherPostingService for document vouchers', () => {
    const file = path.resolve(SRC, 'application/sales/use-cases/SalesReturnUseCases.ts');
    expect(fs.existsSync(file)).toBe(true);
    const content = fs.readFileSync(file, 'utf8');
    expect(content).not.toContain('SubledgerVoucherPostingService');
    expect(content).toContain('SubledgerDocumentPoster');
    expect(content).toContain('IAccountingBridge');
  });

  /**
   * Task 267-F (Sales PaymentSync slice) — record-payment receipts are
   * prebuilt vouchers, but the Sales use case must not construct the ledger
   * gateway directly. It must hand the voucher to `IAccountingBridge` and let
   * the bridge choose full vs minimal mode.
   */
  it('267-F (Sales PaymentSync): record-payment receipts must route through IAccountingBridge only', () => {
    const file = path.resolve(SRC, 'application/sales/use-cases/PaymentSyncUseCases.ts');
    expect(fs.existsSync(file)).toBe(true);
    const content = fs.readFileSync(file, 'utf8');
    expect(content).not.toContain('PostingGateway');
    expect(content).toContain('recordPreBuiltVoucher');
    expect(content).toContain('IAccountingBridge');
  });

  /**
   * Task 267-C — non-failing export/structure guard. The Policy Resolution
   * Engine foundation introduces a typed policy config model and resolver.
   * This guard verifies the foundation files exist where the architecture
   * expects them, so a future refactor that drops one is caught immediately.
   * It does not assert behavior (those are pinned in PolicyResolver.test.ts
   * and PolicyEngineTypedResolution.test.ts).
   */
  it('267-C: Policy Resolution Engine foundation files are in place', () => {
    const expected = [
      'domain/system-core/entities/PolicyConfig.ts',
      'repository/interfaces/system-core/IPolicyConfigRepository.ts',
      'application/system-core/contracts/IPolicyEngine.ts',
      'application/system-core/policy/PolicyResolver.ts',
      'application/system-core/PolicyEngine.ts',
    ];
    for (const rel of expected) {
      const abs = path.resolve(SRC, rel);
      expect(fs.existsSync(abs)).toBe(true);
    }
  });

  /**
   * Task 267-D — non-failing export/structure guard. The engine management
   * API doorways introduce a Firestore implementation of
   * `IPolicyConfigRepository` and per-module doorways that write the same
   * `PolicyConfig` document. This guard verifies the new repository file
   * exists where the architecture expects it, so a future refactor that
   * drops it is caught immediately. Behavior is pinned in
   * FirestorePolicyConfigRepository.test.ts and the per-module controller
   * tests.
   */
  it('267-D: Engine management PolicyConfigRepository (Firestore) file is in place', () => {
    const expected = [
      'infrastructure/firestore/repositories/system-core/FirestorePolicyConfigRepository.ts',
    ];
    for (const rel of expected) {
      const abs = path.resolve(SRC, rel);
      expect(fs.existsSync(abs)).toBe(true);
    }
  });
});

function importsSalesApplicationOrDomain(content: string): boolean {
  const imports = content.matchAll(/from\s+['"]([^'"]+)['"]/g);
  for (const match of imports) {
    const specifier = match[1].replace(/\\/g, '/');
    if (
      specifier.includes('/application/sales/') ||
      specifier.includes('/domain/sales/') ||
      specifier.includes('../../sales/') ||
      specifier.includes('../../../domain/sales/')
    ) {
      return true;
    }
  }
  return false;
}
