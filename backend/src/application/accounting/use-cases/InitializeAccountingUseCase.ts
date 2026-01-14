import { ICompanyModuleRepository } from '../../../repository/interfaces/company/ICompanyModuleRepository';
import { IAccountRepository } from '../../../repository/interfaces/accounting/IAccountRepository';
import { ISystemMetadataRepository } from '../../../infrastructure/repositories/FirestoreSystemMetadataRepository';

import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

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
    private systemMetadataRepo: ISystemMetadataRepository
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
    
    // 2. Create Accounts - Use CODE as ID (industry standard)
    // Parent references use account codes directly
    const promises = templateAccounts.map((tpl: any) => {
      const input = {
        // No 'id' field - repository will use code as doc ID
        userCode: tpl.code,
        name: tpl.name,
        classification: tpl.type, // Will be normalized by repository
        parentId: tpl.parentId || null,  // parentId is parent's CODE
        fixedCurrencyCode: config.baseCurrency,
        currencyPolicy: 'FIXED' as const,
        createdBy: 'SYSTEM'
      };

      return this.accountRepo.create(companyId, input);
    });
    
    await Promise.all(promises);
    
    console.log(`[InitializeAccountingUseCase] Created ${promises.length} accounts.`);

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

    // 4. Mark Module as Initialized
    await this.companyModuleRepo.update(companyId, 'accounting', {
      initialized: true,
      initializationStatus: 'complete',
      config,
      updatedAt: new Date()
    });
    
    console.log(`[InitializeAccountingUseCase] Module marked as initialized.`);
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
      
      // Create a copy for this company
      const companyVoucherRef = db
        .collection('companies')
        .doc(companyId)
        .collection('voucherTypes')
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

