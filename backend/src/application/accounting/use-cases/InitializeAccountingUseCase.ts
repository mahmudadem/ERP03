import { ICompanyModuleRepository } from '../../../repository/interfaces/company/ICompanyModuleRepository';
import { IAccountRepository } from '../../../repository/interfaces/accounting/IAccountRepository';
import { ISystemMetadataRepository } from '../../../infrastructure/repositories/FirestoreSystemMetadataRepository';
import { ICompanyModuleSettingsRepository } from '../../../repository/interfaces/system/ICompanyModuleSettingsRepository';
import { ICompanySettingsRepository } from '../../../repository/interfaces/core/ICompanySettingsRepository';
import { ICurrencyRepository } from '../../../repository/interfaces/company-wizard/ICurrencyRepository';
import { ICompanyRepository } from '../../../repository/interfaces/core/ICompanyRepository';
import { IFiscalYearRepository } from '../../../repository/interfaces/accounting/IFiscalYearRepository';
import { FiscalYear, FiscalYearStatus, PeriodScheme } from '../../../domain/accounting/entities/FiscalYear';
import { FiscalPeriodGenerator } from '../../../domain/accounting/services/FiscalPeriodGenerator';
import { IVoucherTypeDefinitionRepository } from '../../../repository/interfaces/designer/IVoucherTypeDefinitionRepository';
import { IVoucherFormRepository, VoucherFormDefinition } from '../../../repository/interfaces/designer/IVoucherFormRepository';
import { VoucherTypeDefinition } from '../../../domain/designer/entities/VoucherTypeDefinition';
import { randomUUID } from 'crypto';

interface InitializeAccountingRequest {
  companyId: string;
  config: {
    fiscalYearStart: string;
    fiscalYearEnd: string;
    baseCurrency: string;
    coaTemplate: string;
    selectedVoucherTypes?: string[]; // Optional: IDs of voucher types to copy
    periodScheme: string;
  };
}

export class InitializeAccountingUseCase {
  constructor(
    private companyModuleRepo: ICompanyModuleRepository,
    private accountRepo: IAccountRepository,
    private systemMetadataRepo: ISystemMetadataRepository,
    private settingsRepo: ICompanyModuleSettingsRepository,
    private companySettingsRepo: ICompanySettingsRepository,
    private currencyRepo: ICurrencyRepository,
    private companyRepo: ICompanyRepository,
    private fiscalYearRepo: IFiscalYearRepository,
    private voucherTypeRepo: IVoucherTypeDefinitionRepository,
    private voucherFormRepo: IVoucherFormRepository
  ) {}

  async execute(request: InitializeAccountingRequest): Promise<void> {
    const { companyId, config } = request;

    console.log(`[InitializeAccountingUseCase] Initializing for ${companyId} with template ${config.coaTemplate}`);

    // 1. Fetch COA Template from DB
    const templates = await this.systemMetadataRepo.getMetadata('coa_templates');
    const selectedTemplate = templates.find((t: any) => t.id === config.coaTemplate);

    if (!selectedTemplate || !selectedTemplate.accounts) {
      throw new Error(`COA Template '${config.coaTemplate}' not found in system metadata.`);
    }

    const templateAccounts = selectedTemplate.accounts;
    
    // We must generate UUIDs first to correctly map parentIds, as templates use codes for hierarchy
    // First, fetch existing accounts to support re-runs (idempotency)
    const existingAccounts = await this.accountRepo.list(companyId);
    const existingCodeMap = new Map<string, string>();
    // Normalize code function for consistent lookup
    const cleanCode = (c: any) => String(c || '').trim().toUpperCase();
    
    existingAccounts.forEach(acc => existingCodeMap.set(cleanCode(acc.userCode), acc.id));

    const codeToIdMap = new Map<string, string>();
    
    // Map usage:
    // If account exists in DB, use its ID.
    // If not, generate new UUID.
    const preparedAccounts = templateAccounts.map((tpl: any) => {
      const code = cleanCode(tpl.code);
      let id = existingCodeMap.get(code);
      let isNew = false;
      
      if (!id) {
        id = randomUUID();
        isNew = true;
      }
      
      codeToIdMap.set(code, id);
      
      return {
        ...tpl,
        code, // Store normalized code
        id,
        isNew
      };
    });

    // 3. Create Accounts Sequentially
    let createdCount = 0;
    for (const tpl of preparedAccounts) {
      if (!tpl.isNew) {
        // Skip existing accounts to avoid duplicates
        // Note: We don't update existing accounts to avoid overwriting user changes
        continue; 
      }

      // Resolve parentId: from Code to UUID
      let parentId = null;
      const tplParentCode = tpl.parentCode || tpl.parentId;
      if (tplParentCode) {
        const pCode = cleanCode(tplParentCode);
        if (codeToIdMap.has(pCode)) {
          parentId = codeToIdMap.get(pCode);
        }
      }
      
      // Determine Role based on children presence in template
      // If an account is a parent in the template, force it to HEADER
      // Use normalized checks
      const code = tpl.code; // Already normalized
      const isParentInTemplate = templateAccounts.some((other: any) => cleanCode(other.parentCode || other.parentId) === code);
      const forcedRole = isParentInTemplate ? 'HEADER' : (tpl.role || 'POSTING');

      const input = {
        id: tpl.id, 
        userCode: tpl.code,
        name: tpl.name,
        classification: tpl.type, 
        accountRole: forcedRole,
        parentId: parentId, // Use resolved UUID
        fixedCurrencyCode: config.baseCurrency,
        currencyPolicy: 'FIXED' as const,
        createdBy: 'SYSTEM'
      };

      try {
        await this.accountRepo.create(companyId, input);
        createdCount++;
      } catch (err: any) {
        // If system code clash or other error, log but continue? 
        // Better to fail fast or ensuring consistency.
        // For duplicates (if validation checks), we might catch here.
        // But we checked isNew, so mostly safe.
        // If system code unique check fails, that's real error.
        throw err;
      }
    }
    
    console.log(`[InitializeAccountingUseCase] Created ${createdCount} accounts sequentially (Skipped ${existingAccounts.length} existing).`);

    // 3. Copy Default Voucher Types to Company
    try {
      await this.copyDefaultVoucherTypes(
        companyId, 
        config.selectedVoucherTypes || [] // Pass selected voucher type IDs
      );
      console.log(`[InitializeAccountingUseCase] Copied default voucher types to company.`);
    } catch (error) {
      console.warn(`[InitializeAccountingUseCase] Failed to copy voucher types:`, error);
      // Don't fail initialization if voucher copy fails
    }

    // 4. Sync Definitive Settings to Global Tier (Tier 1)
    // The user has chosen these definitive settings during Accounting Init.
    await this.companySettingsRepo.updateSettings(companyId, {
      fiscalYearStart: config.fiscalYearStart,
      fiscalYearEnd: config.fiscalYearEnd,
      strictApprovalMode: false // Explicitly set to Flexible
    });

    // Mirror fiscal periods and base currency to main company document
    await this.companyRepo.update(companyId, {
      baseCurrency: config.baseCurrency,
      fiscalYearStart: config.fiscalYearStart ? new Date(new Date().getFullYear(), parseInt(config.fiscalYearStart.split('-')[0]) - 1, parseInt(config.fiscalYearStart.split('-')[1])) : undefined,
      fiscalYearEnd: config.fiscalYearEnd ? new Date(new Date().getFullYear(), parseInt(config.fiscalYearEnd.split('-')[0]) - 1, parseInt(config.fiscalYearEnd.split('-')[1])) : undefined,
    });

    console.log(`[InitializeAccountingUseCase] Promoted base currency ${config.baseCurrency} and fiscal periods to Global Tier`);

    // 4.5 Create actual Fiscal Year aggregate with periods (Tier 3 Reporting)
    try {
      const currentYear = new Date().getFullYear();
      const startMonth = parseInt(config.fiscalYearStart.split('-')[0]) || 1;
      const scheme = (config.periodScheme as PeriodScheme) || PeriodScheme.MONTHLY;
      
      const startDate = new Date(currentYear, startMonth - 1, 1);
      const endDate = new Date(currentYear, startMonth - 1 + 12, 0);
      
      const iso = (d: Date) => d.toISOString().split('T')[0];
      
      // Check if any fiscal year already exists to be idempotent
      const existingYears = await this.fiscalYearRepo.findByCompany(companyId);
      if (existingYears.length === 0) {
        const periods = FiscalPeriodGenerator.generate(startDate, endDate, scheme, 0);
        const fyId = `FY${endDate.getFullYear()}`;
        
        const fiscalYear = new FiscalYear(
          fyId,
          companyId,
          `Fiscal Year ${endDate.getFullYear()}`,
          iso(startDate),
          iso(endDate),
          FiscalYearStatus.OPEN,
          periods,
          undefined,
          new Date(),
          'SYSTEM',
          scheme,
          0
        );
        
        await this.fiscalYearRepo.save(fiscalYear);
        console.log(`[InitializeAccountingUseCase] Created initial fiscal year ${fyId} with ${scheme} periods`);
      }
    } catch (err) {
      console.warn(`[InitializeAccountingUseCase] Failed to create initial fiscal year:`, err);
    }

    // 5. Promote Base Currency to Shared Tier (Tier 2) - Minimal Seeding
    // We only seed the Base Currency to keep the shared list clean.
    // The frontend can still fetch the full list from system_metadata for "Add Currency".
    try {
      // Create a minimal Currency object for the base currency
      // We don't need to fetch the full list anymore
      const baseCurrencyObj = {
        code: config.baseCurrency,
        name: config.baseCurrency, // Fallback name, will be enriched if needed or we can fetch just this one
        symbol: config.baseCurrency, // Fallback symbol
        decimalPlaces: 2,
        isActive: true
      };
      
      // We use a specific method or just pass this single item as an array
      // The repository expects a list, so we pass a single-item list.
      // Ideally, we should fetch the real metadata for this ONE currency to have correct symbol/name.
      const globalCurr = await this.systemMetadataRepo.getMetadata('currencies');
      const baseMetadata = Array.isArray(globalCurr) 
        ? globalCurr.find((c: any) => c.code === config.baseCurrency)
        : baseCurrencyObj;

      await this.currencyRepo.seedCurrencies(companyId, [baseMetadata || baseCurrencyObj], config.baseCurrency);
      console.log(`[InitializeAccountingUseCase] Seeded ONLY base currency ${config.baseCurrency} in Shared Tier`);
    } catch (err) {
      console.warn(`[InitializeAccountingUseCase] Failed to promote currency to Shared Tier:`, err);
    }

    // 6. Save Accounting Policies to Settings/accounting (Module Tier 3)
    await this.settingsRepo.saveSettings(companyId, 'accounting', {
      coaTemplate: config.coaTemplate, // Reference only
      approvalRequired: false,
      autoPostEnabled: true,
      allowEditDeletePosted: true,
      updatedAt: new Date(),
      updatedBy: 'system'
    }, 'system');
    
    // 7. Mark Module as Initialized
    // CLEANUP: We remove redundant global fields from the module's activation config
    // to prevent the "mess" in companies/{id}/modules/accounting document.
    const cleanConfig = {
      coaTemplate: config.coaTemplate,
      selectedVoucherTypes: config.selectedVoucherTypes
      // EXCLUDED: baseCurrency, fiscalYearStart, fiscalYearEnd as they are in Global Tier
    };

    await this.companyModuleRepo.update(companyId, 'accounting', {
      initialized: true,
      initializationStatus: 'complete',
      config: cleanConfig,
      updatedAt: new Date()
    });
    
    console.log(`[InitializeAccountingUseCase] Module marked as initialized with clean config.`);
  }

  /**
   * Copy default voucher types from system_metadata to company
   * Only copies the voucher types specified in selectedVoucherTypeIds
   */
  private async copyDefaultVoucherTypes(
    companyId: string,
    selectedVoucherTypeIds: string[]
  ): Promise<void> {
    // If no vouchers selected, skip copying
    if (!selectedVoucherTypeIds || selectedVoucherTypeIds.length === 0) {
      console.log(`[InitializeAccountingUseCase] No voucher types selected, skipping copy`);
      return;
    }

    // Load default voucher types from system templates
    const systemTemplates = await this.voucherTypeRepo.getSystemTemplates();
    if (systemTemplates.length === 0) {
      console.warn(`[InitializeAccountingUseCase] No default voucher types found in system templates`);
      return;
    }

    const copiedTypes: { id: string; data: VoucherTypeDefinition }[] = [];

    for (const systemTemplate of systemTemplates) {
      if (!selectedVoucherTypeIds.includes(systemTemplate.id)) {
        continue;
      }

      // Create a copy for this company
      const companyVoucherType = new VoucherTypeDefinition(
        systemTemplate.id,
        companyId,
        systemTemplate.name,
        systemTemplate.code,
        systemTemplate.module,
        systemTemplate.headerFields,
        systemTemplate.tableColumns,
        systemTemplate.layout,
        systemTemplate.schemaVersion,
        systemTemplate.requiredPostingRoles,
        systemTemplate.workflow,
        systemTemplate.uiModeOverrides,
        systemTemplate.isMultiLine,
        systemTemplate.rules,
        systemTemplate.actions,
        systemTemplate.defaultCurrency
      );

      await this.voucherTypeRepo.createVoucherType(companyVoucherType);
      copiedTypes.push({ id: systemTemplate.id, data: companyVoucherType });
    }

    console.log(`[InitializeAccountingUseCase] Copied ${copiedTypes.length} default voucher types to company ${companyId}`);

    // Now create default forms for each copied type
    await this.createDefaultFormsForTypes(companyId, copiedTypes);
  }

  /**
   * Create default VoucherForms for each VoucherType
   * Each type gets one default form that matches its layout
   * Uses the same ID as the type for simplicity
   */
  private async createDefaultFormsForTypes(
    companyId: string,
    types: { id: string; data: VoucherTypeDefinition }[]
  ): Promise<void> {
    for (const type of types) {
      const formId = type.id;
      const code = String(type.data.code || type.id || '').toUpperCase();
      const baseType = String(type.data.module || '').toUpperCase() || (
        code.includes('RECEIPT') ? 'RECEIPT' :
        code.includes('PAYMENT') ? 'PAYMENT' :
        code.includes('JOURNAL') ? 'JOURNAL' :
        code.includes('TRANSFER') ? 'TRANSFER' :
        code.includes('INVOICE') ? 'INVOICE' :
        code
      );

      const headerFields = (type.data.headerFields || []).map((f: any) => ({
        id: f.id || f.fieldId,
        label: f.label || f.name || '',
        type: f.type || 'text',
        required: f.required || false,
        order: f.order || 0,
      }));

      const tableColumns = (type.data.tableColumns || []).map((c: any) => ({
        id: c.fieldId || c.id || '',
        label: c.labelOverride || c.label || '',
        type: c.type || 'text',
        required: c.required || false,
        order: c.order || 0,
      }));

      const form: VoucherFormDefinition = {
        id: formId,
        companyId,
        typeId: baseType || type.id,
        name: type.data.name || type.id,
        code: type.data.code || baseType || type.id,
        description: `Default form for ${type.data.name || type.id}`,
        prefix: type.data.code?.slice(0, 3).toUpperCase() || 'V',
        isDefault: true,
        isSystemGenerated: true,
        isLocked: true,
        enabled: true,
        headerFields,
        tableColumns,
        uiModeOverrides: type.data.uiModeOverrides || null,
        rules: type.data.rules || [],
        actions: type.data.actions || [],
        isMultiLine: type.data.isMultiLine ?? true,
        tableStyle: 'web',
        defaultCurrency: type.data.defaultCurrency || '',
        layout: type.data.layout || {
          theme: 'default',
          showTotals: true
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'system'
      };

      await this.voucherFormRepo.create(form);
    }

    console.log(`[InitializeAccountingUseCase] Created ${types.length} default forms in voucherForms collection`);
  }
}

