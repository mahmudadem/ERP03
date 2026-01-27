import { ICompanyModuleRepository } from '../../../repository/interfaces/company/ICompanyModuleRepository';
import { IAccountRepository } from '../../../repository/interfaces/accounting/IAccountRepository';
import { ISystemMetadataRepository } from '../../../infrastructure/repositories/FirestoreSystemMetadataRepository';
import { ICompanyModuleSettingsRepository } from '../../../repository/interfaces/system/ICompanyModuleSettingsRepository';
import { ICompanySettingsRepository } from '../../../repository/interfaces/core/ICompanySettingsRepository';
import { ICurrencyRepository } from '../../../repository/interfaces/company-wizard/ICurrencyRepository';
import { ICompanyRepository } from '../../../repository/interfaces/core/ICompanyRepository';

import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { randomUUID } from 'crypto';

interface InitializeAccountingRequest {
  companyId: string;
  config: {
    fiscalYearStart: string;
    fiscalYearEnd: string;
    baseCurrency: string;
    coaTemplate: string;
    selectedVoucherTypes?: string[]; // Optional: IDs of voucher types to copy
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
    private companyRepo: ICompanyRepository
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

    // Mirror fiscal periods to main company document
    await this.companyRepo.update(companyId, {
      fiscalYearStart: config.fiscalYearStart ? new Date(config.fiscalYearStart) : undefined,
      fiscalYearEnd: config.fiscalYearEnd ? new Date(config.fiscalYearEnd) : undefined,
    });

    console.log(`[InitializeAccountingUseCase] Promoted base currency ${config.baseCurrency} and fiscal periods to Global Tier`);

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
    const db = admin.firestore();
    
    // If no vouchers selected, skip copying
    if (!selectedVoucherTypeIds || selectedVoucherTypeIds.length === 0) {
      console.log(`[InitializeAccountingUseCase] No voucher types selected, skipping copy`);
      return;
    }
    
    // Load default voucher types from system_metadata/voucher_types/items
    const defaultVouchersRef = db
      .collection('system_metadata')
      .doc('voucher_types')
      .collection('items');
    
    const snapshot = await defaultVouchersRef.get();
    
    if (snapshot.empty) {
      console.warn(`[InitializeAccountingUseCase] No default voucher types found in system_metadata`);
      return;
    }

    const batch = db.batch();
    let count = 0;
    const copiedTypes: { id: string; data: any }[] = [];

    snapshot.forEach(doc => {
      // Only copy if this voucher type was selected
      if (!selectedVoucherTypeIds.includes(doc.id)) {
        return; // Skip this one
      }
      
      const voucherType = doc.data();
      
      // Create a copy for this company in modular path: accounting/Settings/voucher_types
      const companyVoucherRef = db
        .collection('companies')
        .doc(companyId)
        .collection('accounting')
        .doc('Settings')
        .collection('voucher_types')
        .doc(doc.id);
      
      // Add company-specific metadata
      const companyVoucher = {
        ...voucherType,
        companyId,
        isSystemDefault: true,  // Mark as system default (immutable)
        isLocked: true,         // Lock for editing
        enabled: true,          // Enable by default
        inUse: false,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };
      
      batch.set(companyVoucherRef, companyVoucher);
      copiedTypes.push({ id: doc.id, data: companyVoucher });
      count++;
    });

    await batch.commit();
    console.log(`[InitializeAccountingUseCase] Copied ${count} default voucher types to company ${companyId}`);

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
    types: { id: string; data: any }[]
  ): Promise<void> {
    const db = admin.firestore();
    const batch = db.batch();

    for (const type of types) {
      // Use same ID as type for the default form (simpler)
      const formId = type.id;
      
      const formRef = db
        .collection('companies')
        .doc(companyId)
        .collection('accounting')
        .doc('Settings')
        .collection('voucherForms')
        .doc(formId);

      // Extract UI layout from the type definition
      const form = {
        id: formId,
        companyId,
        typeId: type.id,
        name: type.data.name || type.id, // Use original name, no suffix
        code: type.data.code || type.id,
        description: `Default form for ${type.data.name || type.id}`,
        prefix: type.data.prefix || type.data.code?.slice(0, 3).toUpperCase() || 'V',
        isDefault: true,
        isSystemGenerated: true,
        isLocked: true, // System-generated forms are locked
        enabled: true,
        // Copy layout from type definition
        headerFields: type.data.headerFields || type.data.fields?.filter((f: any) => f.section === 'header') || [],
        tableColumns: type.data.tableColumns || type.data.fields?.filter((f: any) => f.section === 'table') || [],
        layout: type.data.layout || {
          theme: 'default',
          showTotals: true
        },
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        createdBy: 'system'
      };

      batch.set(formRef, form);
    }

    await batch.commit();
    console.log(`[InitializeAccountingUseCase] Created ${types.length} default forms in voucherForms collection`);
  }
}

