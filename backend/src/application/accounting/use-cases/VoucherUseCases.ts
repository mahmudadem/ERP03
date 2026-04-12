import { randomUUID } from 'crypto';
import { VoucherEntity } from '../../../domain/accounting/entities/VoucherEntity';
import { VoucherLineEntity, roundMoney } from '../../../domain/accounting/entities/VoucherLineEntity';
import { IVoucherRepository } from '../../../domain/accounting/repositories/IVoucherRepository';
import { IAccountRepository, ILedgerRepository } from '../../../repository/interfaces/accounting';
import { ICompanyModuleSettingsRepository } from '../../../repository/interfaces/system/ICompanyModuleSettingsRepository';
import { ITransactionManager } from '../../../repository/interfaces/shared/ITransactionManager';
import { PermissionChecker } from '../../rbac/PermissionChecker';
import { VoucherPostingStrategyFactory } from '../../../domain/accounting/factories/VoucherPostingStrategyFactory';
import { PostingFieldExtractor } from '../../../domain/accounting/services/PostingFieldExtractor';
import { IVoucherTypeDefinitionRepository } from '../../../repository/interfaces/designer/IVoucherTypeDefinitionRepository';
import { VoucherStatus, VoucherType, PostingLockPolicy } from '../../../domain/accounting/types/VoucherTypes';
import { VoucherValidationService } from '../../../domain/accounting/services/VoucherValidationService';
import { BusinessError } from '../../../errors/AppError';
import { ErrorCode } from '../../../errors/ErrorCodes';
import { IAccountingPolicyConfigProvider } from '../../../infrastructure/accounting/config/IAccountingPolicyConfigProvider';
import { ICompanyCurrencyRepository } from '../../../repository/interfaces/accounting/ICompanyCurrencyRepository';
import { AccountValidationService } from '../services/AccountValidationService';
import { IVoucherSequenceRepository } from '../../../repository/interfaces/accounting/IVoucherSequenceRepository';

const UI_ONLY_VOUCHER_KEYS = new Set([
  'voucherConfig',
  'headerFields',
  'tableColumns',
  'uiModeOverrides',
  'tableStyle',
  'actions',
  'rules',
  '_isForm',
  '_rowId'
]);

const LEGACY_SOURCE_KEYS = new Set(['sourceVoucher', 'sourcePayload']);
const SYSTEM_MANAGED_SOURCE_FIELDS = new Set([
  'id',
  'voucherNo',
  'voucherNumber',
  'status',
  'createdBy',
  'createdAt',
  'updatedBy',
  'updatedAt',
  'approvedBy',
  'approvedAt',
  'rejectedBy',
  'rejectedAt',
  'postedBy',
  'postedAt',
  'postingLockPolicy'
]);
const SYSTEM_MANAGED_SOURCE_FIELDS_LOWER = new Set(
  Array.from(SYSTEM_MANAGED_SOURCE_FIELDS).map((key) => key.toLowerCase())
);

const isPlainObject = (value: any): value is Record<string, any> => {
  return !!value && typeof value === 'object' && !Array.isArray(value);
};

const sanitizeSnapshotValue = (value: any): any => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (Array.isArray(value)) {
    return value
      .map((entry) => sanitizeSnapshotValue(entry))
      .filter((entry) => entry !== undefined);
  }
  if (!isPlainObject(value)) return value;

  const out: Record<string, any> = {};
  Object.entries(value).forEach(([key, entry]) => {
    if (!key) return;
    if (UI_ONLY_VOUCHER_KEYS.has(key) || LEGACY_SOURCE_KEYS.has(key)) return;
    const sanitized = sanitizeSnapshotValue(entry);
    if (sanitized === undefined) return;
    out[key] = sanitized;
  });
  return out;
};

const normalizeVoucherTypeCode = (rawType: any, fallback: VoucherType = VoucherType.JOURNAL_ENTRY): VoucherType => {
  const normalized = String(rawType || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

  if (!normalized) return fallback;
  if (normalized === 'jv' || normalized === 'journal') return VoucherType.JOURNAL_ENTRY;
  if (normalized === 'journal_entry') return VoucherType.JOURNAL_ENTRY;
  if (normalized === 'purchase_invoice' || normalized === 'pi' || normalized === 'ap_invoice') return VoucherType.PURCHASE_INVOICE;
  if (normalized === 'purchase_return' || normalized === 'pr' || normalized === 'ap_return') return VoucherType.PURCHASE_RETURN;
  if (normalized === 'sales_invoice' || normalized === 'si' || normalized === 'ar_invoice') return VoucherType.SALES_INVOICE;
  if (normalized === 'sales_return' || normalized === 'sr' || normalized === 'ar_return') return VoucherType.SALES_RETURN;
  if (normalized === 'receipt') return VoucherType.RECEIPT;
  if (normalized === 'payment') return VoucherType.PAYMENT;
  if (normalized === 'opening' || normalized === 'opening_balance') return VoucherType.OPENING_BALANCE;
  if (normalized === 'fx_revaluation' || normalized === 'revaluation' || normalized === 'fx') return VoucherType.FX_REVALUATION;
  return fallback;
};

const sanitizeSnapshotObject = (value: any): Record<string, any> => {
  const sanitized = sanitizeSnapshotValue(value);
  if (!isPlainObject(sanitized)) return {};
  return sanitized;
};

const stripSystemManagedSourceFields = (snapshot: Record<string, any>): Record<string, any> => {
  const out: Record<string, any> = {};
  Object.entries(snapshot || {}).forEach(([key, value]) => {
    if (SYSTEM_MANAGED_SOURCE_FIELDS_LOWER.has(String(key).toLowerCase())) {
      return;
    }
    out[key] = value;
  });
  return out;
};

const deepMergeObjects = (base: Record<string, any>, override: Record<string, any>): Record<string, any> => {
  const merged: Record<string, any> = { ...base };
  Object.entries(override || {}).forEach(([key, value]) => {
    const baseValue = merged[key];
    if (isPlainObject(baseValue) && isPlainObject(value)) {
      merged[key] = deepMergeObjects(baseValue, value);
    } else {
      merged[key] = value;
    }
  });
  return merged;
};

const removeLegacySourceKeys = (metadata: any): Record<string, any> => {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return {};
  const out: Record<string, any> = {};
  Object.entries(metadata).forEach(([key, entry]) => {
    if (LEGACY_SOURCE_KEYS.has(key)) return;
    if (entry === undefined) return;
    out[key] = entry;
  });
  return out;
};

const buildSourcePayload = (payload: any, existing?: any): Record<string, any> | undefined => {
  const previousSnapshot = sanitizeSnapshotObject(existing);
  const explicitSourceSnapshot = sanitizeSnapshotObject(payload?.sourcePayload);

  const fallbackPayloadSnapshot = sanitizeSnapshotObject(payload);
  delete fallbackPayloadSnapshot.sourcePayload;
  if (isPlainObject(fallbackPayloadSnapshot.metadata)) {
    fallbackPayloadSnapshot.metadata = removeLegacySourceKeys(fallbackPayloadSnapshot.metadata);
  }

  const incomingSnapshot = Object.keys(explicitSourceSnapshot).length > 0
    ? explicitSourceSnapshot
    : fallbackPayloadSnapshot;

  const mergedSnapshot = deepMergeObjects(previousSnapshot, incomingSnapshot);
  if (isPlainObject(mergedSnapshot.metadata)) {
    mergedSnapshot.metadata = removeLegacySourceKeys(mergedSnapshot.metadata);
  }

  const cleanedSnapshot = sanitizeSnapshotObject(mergedSnapshot);
  if (Object.keys(cleanedSnapshot).length === 0) {
    return undefined;
  }
  const strippedSnapshot = stripSystemManagedSourceFields(cleanedSnapshot);
  return Object.keys(strippedSnapshot).length > 0 ? strippedSnapshot : undefined;
};

/**
 * Build structured formData from the incoming payload.
 * formData is the frontend form's intent — the fields the user actually filled in.
 * Unlike sourcePayload (a raw opaque dump), formData is explicitly structured:
 *   { formId, headerFields, detailLines }
 * This is the authoritative source for reopen, so the frontend never needs
 * to reverse-engineer accounting lines.
 */
const FORM_DATA_EXCLUDED_KEYS = new Set([
  // Core accounting/system fields — belong to VoucherEntity directly
  'id', 'companyId', 'voucherNo', 'voucherNumber', 'type', 'date', 'description',
  'currency', 'baseCurrency', 'exchangeRate', 'lines', 'status',
  'createdBy', 'createdAt', 'updatedBy', 'updatedAt',
  'approvedBy', 'approvedAt', 'rejectedBy', 'rejectedAt',
  'postedBy', 'postedAt', 'postingLockPolicy',
  'metadata', 'reference', 'postingPeriodNo', 'prefix',
  // Legacy snapshot keys — not needed in formData
  'sourcePayload', 'sourceVoucher', 'formData',
  // UI-only noise
  'voucherConfig', 'uiMode', '_rowId',
]);

const buildFormData = (payload: any, existingFormData?: Record<string, any> | null): Record<string, any> | null => {
  if (!payload || typeof payload !== 'object') return existingFormData || null;

  // Explicit formData in payload takes priority (frontend already shaped it)
  if (payload.formData && typeof payload.formData === 'object' && !Array.isArray(payload.formData)) {
    const merged = { ...(existingFormData || {}), ...payload.formData };
    return sanitizeSnapshotObject(merged) || null;
  }

  // Auto-extract: pick all non-core, non-system top-level fields as headerFields
  // and treat `lines` as detailLines (preserving original form line shapes)
  const headerFields: Record<string, any> = {};
  Object.entries(payload).forEach(([key, value]) => {
    if (FORM_DATA_EXCLUDED_KEYS.has(key)) return;
    if (value === undefined || value === null) return;
    headerFields[key] = value;
  });

  const detailLines = Array.isArray(payload.lines)
    ? payload.lines.map((line: any) => {
        // Strip internal accounting fields from detail lines — keep business fields
        const { side, baseAmount, baseCurrency: _bc, debitAmount, creditAmount, ...rest } = line;
        return sanitizeSnapshotValue(rest);
      }).filter(Boolean)
    : [];

  const result: Record<string, any> = {
    formId: payload.formId || payload.metadata?.formId || null,
    headerFields: sanitizeSnapshotObject(headerFields),
    detailLines,
  };

  // Merge with existing formData so partial updates don't erase prior fields
  if (existingFormData) {
    return {
      ...existingFormData,
      ...result,
      headerFields: { ...(existingFormData.headerFields || {}), ...result.headerFields },
    };
  }

  return result;
};

export class CreateVoucherUseCase {
  constructor(
    private voucherRepo: IVoucherRepository,
    private accountRepo: IAccountRepository,
    private settingsRepo: ICompanyModuleSettingsRepository,
    private permissionChecker: PermissionChecker,
    private transactionManager: ITransactionManager,
    private voucherTypeRepo: IVoucherTypeDefinitionRepository,
    private policyConfigProvider?: IAccountingPolicyConfigProvider,
    private ledgerRepo?: ILedgerRepository, // Needed for auto-post
    private policyRegistry?: any, // Needed for auto-post
    private currencyRepo?: ICompanyCurrencyRepository, // NEW: Optional for backward compat in constructor, but required logic
    private sequenceRepo?: IVoucherSequenceRepository
  ) {}
  
  private validationService = new VoucherValidationService();

  async execute(companyId: string, userId: string, payload: any): Promise<VoucherEntity> {
    await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.vouchers.create');
    
    return this.transactionManager.runTransaction(async (transaction) => {
      // Fetch settings for general config (autoNumbering, etc)
      const settings: any = await this.settingsRepo.getSettings(companyId, 'accounting');

      // Resolve Base Currency Strategy:
      // 1. Try Shared Currency Registry (Source of Truth) via currencyRepo
      // 2. Fallback to Module Settings (Legacy/Backup)
      
      let baseCurrency: string | null = null;
      
      if (this.currencyRepo) {
          baseCurrency = await this.currencyRepo.getBaseCurrency(companyId);
      }
      
      if (!baseCurrency) {
          // Fallback to legacy settings
          baseCurrency = settings?.baseCurrency;
      }

      baseCurrency = baseCurrency?.toUpperCase(); // Ensure uppercase
      
      if (!baseCurrency) {
        throw new BusinessError(
          ErrorCode.CRITICAL_CONFIG_MISSING,
          'Company base currency is not configured. Please complete accounting module setup through the accounting wizard.',
          { 
            companyId, 
            module: 'accounting', 
            missingField: 'baseCurrency',
            hint: 'Run the accounting initialization wizard to set up base currency'
          }
        );
      }
      
      const autoNumbering = settings?.autoNumbering !== false;
      


      const voucherId = payload.id || randomUUID();
      const resolvedVoucherType = normalizeVoucherTypeCode(
        payload.type || payload.typeId || payload.baseType || payload.metadata?.type || payload.metadata?.typeId
      );
      let voucherNo = payload.voucherNo || '';
      if (autoNumbering && this.sequenceRepo) {
        const prefix = payload.prefix || (resolvedVoucherType || 'V').toString();
        const useYear = settings?.resetVoucherNumbersAnnually ? new Date(payload.date || Date.now()).getFullYear() : undefined;
        const numberFormat = payload.numberFormat || undefined;
        voucherNo = await this.sequenceRepo.getNextNumber(companyId, prefix, useYear, numberFormat);
      } else if (autoNumbering) {
        voucherNo = `V-${Date.now()}`;
      }

      let lines: VoucherLineEntity[] = [];
      const voucherType = resolvedVoucherType;
      const strategy = VoucherPostingStrategyFactory.getStrategy(voucherType);

      if (strategy) {
        const voucherTypeDef = await this.voucherTypeRepo.getByCode(companyId, voucherType);
        let strategyInput = payload;
        
        if (voucherTypeDef && voucherTypeDef.headerFields && voucherTypeDef.headerFields.length > 0) {
          try {
            strategyInput = PostingFieldExtractor.extractPostingFields(payload, voucherTypeDef);
          } catch (error: any) {
            console.warn(`PostingFieldExtractor failed for ${voucherType}:`, error.message);
            strategyInput = payload;
          }
        }
        
        lines = await strategy.generateLines(strategyInput, companyId, baseCurrency);

        // Normalize/validate strategy-produced account refs to persisted UUIDs.
        // Strategies may receive account codes from flexible/cloned forms.
        const accountValidationService = new AccountValidationService(this.accountRepo);
        lines = await Promise.all(lines.map(async (line) => {
          const account = await accountValidationService.validateAccountById(
            companyId,
            userId,
            line.accountId,
            voucherType,
            {
              lineCurrency: line.currency,
              baseCurrency
            }
          );

          if (account.id === line.accountId) {
            return line;
          }

          return new VoucherLineEntity(
            line.id,
            account.id,
            line.side,
            line.baseAmount,
            line.baseCurrency,
            line.amount,
            line.currency,
            line.exchangeRate,
            line.notes,
            line.costCenterId,
            line.metadata
          );
        }));
      } else {
        // Map incoming lines to V2 VoucherLineEntity
        // Strictly V2 format (side, amount, baseAmount)
        const accountValidationService = new AccountValidationService(this.accountRepo);
        
        lines = await Promise.all((payload.lines || []).map(async (l: any, idx: number) => {
          if (!l.side || l.amount === undefined) {
            throw new BusinessError(
              ErrorCode.VAL_REQUIRED_FIELD,
              `Line ${idx + 1}: Missing required V2 fields: side, amount`
            );
          }

          const lineCurrency = (l.currency || l.lineCurrency || payload.currency || baseCurrency).toUpperCase();

          // Resolve Code to UUID for persistence
          const account = await accountValidationService.validateAccountById(
            companyId,
            userId,
            l.accountId,
            undefined,
            {
              lineCurrency,
              baseCurrency
            }
          );

          const amount = Math.abs(Number(l.amount) || 0);
          const lineBaseCurrency = (l.baseCurrency || baseCurrency).toUpperCase();
          
          // MULTI-CURRENCY FIX: Use triangulation formula
          // parity = rate from Line Currency → Voucher Currency (entered by user)
          // headerRate = rate from Voucher Currency → Base Currency (from header)
          // baseAmount = amount × parity × headerRate
          const parity = Number(l.parity || l.exchangeRate || 1);
          const headerRate = Number(payload.exchangeRate || 1);
          
          // The effective exchange rate for storage (Line → Base)
          const effectiveExchangeRate = roundMoney(parity * headerRate);
          
          // CRITICAL: baseAmount calculated using triangulation
          const baseAmount = roundMoney(amount * parity * headerRate);
          
          return new VoucherLineEntity(
            idx + 1,
            account.id,        // Use persistent ID
            l.side,
            baseAmount,        // baseAmount (Calculated via triangulation)
            lineBaseCurrency,  // baseCurrency  
            amount,            // amount (FX)
            lineCurrency,      // currency (FX)
            effectiveExchangeRate,  // exchangeRate (Line → Base, for storage)
            l.notes || l.description,
            l.costCenterId || l.costCenter,
            l.metadata || {}
          );
        }));
      }


      const totalDebit = lines.reduce((s, l) => s + l.debitAmount, 0);
      const totalCredit = lines.reduce((s, l) => s + l.creditAmount, 0);

      // Build metadata including source tracking fields
      // and capturing any unrecognized top-level fields to avoid data loss
      const coreFields = ['id', 'companyId', 'voucherNo', 'voucherNumber', 'type', 'date', 'description', 'currency', 'baseCurrency', 'exchangeRate', 'lines', 'status', 'metadata', 'reference', 'postingPeriodNo', 'prefix', 'formId', 'sourceModule', 'sourcePayload'];
      const extraMetadata: Record<string, any> = {};
      Object.keys(payload).forEach(key => {
        if (!coreFields.includes(key) && payload[key] !== undefined && payload[key] !== null) {
          extraMetadata[key] = payload[key];
        }
      });

      const sourcePayload = buildSourcePayload(payload);
      const cleanedPayloadMetadata = removeLegacySourceKeys(payload.metadata);
      const formData = buildFormData(payload);

      const voucherMetadata = {
        ...extraMetadata,
        ...cleanedPayloadMetadata,
        ...(payload.sourceModule && { sourceModule: payload.sourceModule }),
        ...(payload.formId && { formId: payload.formId }),
        ...(payload.prefix && { prefix: payload.prefix }),
      };

      // Check if Approval is OFF -> Auto-Post
      let approvalRequired = true;
      if (this.policyConfigProvider) {
        try {
          const config = await this.policyConfigProvider.getConfig(companyId);
          approvalRequired = config.approvalRequired;
        } catch (e) {}
      }

      // V3: Inject creationMode for audit transparency and badge logic
      // This ensures that even before posting, the intended governance mode is clear.
      const creationMode = approvalRequired ? 'STRICT' : 'FLEXIBLE';
      
      const voucher = new VoucherEntity(
        voucherId,
        companyId,
        voucherNo,
        voucherType,
        payload.date || (() => {
          const now = new Date();
          return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        })(),
        payload.description || '',
        payload.currency || baseCurrency,
        baseCurrency,
        payload.exchangeRate || 1,
        lines,
        totalDebit,
        totalCredit,
        VoucherStatus.DRAFT,
        { ...voucherMetadata, creationMode }, // Inject creationMode here
        userId,
        new Date(),
        undefined, // approvedBy
        undefined, // approvedAt
        undefined, // rejectedBy
        undefined, // rejectedAt
        undefined, // rejectionReason
        undefined, // lockedBy
        undefined, // lockedAt
        undefined, // postedBy
        undefined, // postedAt
        undefined, // postingLockPolicy
        undefined, // reversalOfVoucherId
        undefined, // reference
        undefined, // updatedAt
        payload.postingPeriodNo, // Special/Adjustment period override
        sourcePayload || null,
        formData || null
      );

      // Mode A/B Cleanup: Even if auto-posting, we MUST validate the voucher first
      // This is the "Bomb Defusal" - no voucher reaches the ledger without validation
      this.validationService.validateCore(voucher);
      await this.validationService.validateAccounts(voucher, this.accountRepo);

      await this.voucherRepo.save(voucher, transaction);

      if (!approvalRequired && this.ledgerRepo) {
        // Flexible Mode (Mode A): Auto-approve, then post inline
        // Capturing ledgerRepo to satisfy TypeScript strict null checks across async calls
        const ledgerRepo = this.ledgerRepo; 
        const registry = this.policyRegistry;

        // Security: Ensure user has post permission (since we bypassed PostVoucherUseCase)
        await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.vouchers.post');

        // 1. Approve the voucher
        const approvedVoucher = voucher.approve(userId, new Date());
        
        // 2. Determine lock policy based on current config
        let lockPolicy = PostingLockPolicy.FLEXIBLE_LOCKED;
        if (registry) {
          try {
            const config = await registry.getConfig(companyId);
            
            // Align with PostVoucherUseCase: Check for strict gates (FA/CC)
            const isStrictNow = config.financialApprovalEnabled || config.custodyConfirmationEnabled;
            
            if (isStrictNow) {
              lockPolicy = PostingLockPolicy.STRICT_LOCKED; // AUDIT LOCK
            } else if (config.allowEditDeletePosted) {
              lockPolicy = PostingLockPolicy.FLEXIBLE_EDITABLE;
            } else {
              lockPolicy = PostingLockPolicy.FLEXIBLE_LOCKED;
            }
          } catch (e) {}
        }
        
        // 3. Post the approved voucher directly (don't re-fetch)
        const postedVoucher = approvedVoucher.post(userId, new Date(), lockPolicy);
        
        // NEW 3.5: Policy Validation before auto-post
        if (registry) {
           const policies = await registry.getEnabledPolicies(companyId);
           if (policies.length > 0) {
              const context = {
                companyId: postedVoucher.companyId,
                voucherId: postedVoucher.id,
                userId: userId,
                voucherType: postedVoucher.type,
                voucherDate: postedVoucher.date,
                voucherNo: postedVoucher.voucherNo,
                baseCurrency: postedVoucher.baseCurrency,
                totalDebit: postedVoucher.totalDebit,
                totalCredit: postedVoucher.totalCredit,
                status: postedVoucher.status,
                isApproved: postedVoucher.isApproved,
                lines: postedVoucher.lines,
                metadata: postedVoucher.metadata,
                postingPeriodNo: postedVoucher.postingPeriodNo
              };
              
              const valService = this.validationService || new VoucherValidationService();
              await valService.validatePolicies(context, policies, 'FAIL_FAST');
           }
        }

        // 4. Record to ledger using captured repo
        await ledgerRepo.recordForVoucher(postedVoucher, transaction);
        
        // 5. Persist the posted voucher
        await this.voucherRepo.save(postedVoucher, transaction);
        
        return postedVoucher;
      }

      return voucher;
    });
  }
}

/**
 * UpdateVoucherUseCase
 * 
 * Updates a voucher while in DRAFT/REJECTED status.
 */
export class UpdateVoucherUseCase {
  constructor(
    private voucherRepo: IVoucherRepository,
    private accountRepo: IAccountRepository,
    private permissionChecker: PermissionChecker,
    private transactionManager: ITransactionManager,
    private policyConfigProvider?: IAccountingPolicyConfigProvider,
    private ledgerRepo?: ILedgerRepository,
    private policyRegistry?: any,
    private validationService: any = null
  ) {}

  async execute(companyId: string, userId: string, voucherId: string, payload: any): Promise<void> {
    const voucher = await this.voucherRepo.findById(companyId, voucherId);
    if (!voucher) throw new BusinessError(ErrorCode.VOUCH_NOT_FOUND, 'Voucher not found');
    
    await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.vouchers.edit');
    
    // Check approval settings to determine allowed status transitions
    let approvalRequired = true; // Default to requiring approval
    if (this.policyConfigProvider) {
      try {
        const config = await this.policyConfigProvider.getConfig(companyId);
        approvalRequired = config.approvalRequired;
      } catch (e) {}
    }

    // V3: Governance Guard for Editing Posted Vouchers
    // Determine mode and toggle from config
    let isStrictMode = true; // Default to strict
    let allowEditDeletePosted = false;
    if (this.policyConfigProvider) {
      try {
        const config = await this.policyConfigProvider.getConfig(companyId);
        console.log('[UpdateVoucherUseCase] Loaded Policy Config:', JSON.stringify(config, null, 2));
        
        isStrictMode = (config.strictApprovalMode || config.financialApprovalEnabled || config.approvalRequired) ?? true;
        allowEditDeletePosted = config.allowEditDeletePosted ?? false;
        
        console.log('[UpdateVoucherUseCase] Policy Decision:', { isStrictMode, allowEditDeletePosted });
      } catch (e) {
        console.error('[UpdateVoucherUseCase] Failed to load config:', e);
      }
    }

    try {
      voucher.assertCanEdit(isStrictMode, allowEditDeletePosted);
    } catch (error: any) {
      const isStrictForever = error.message.includes('VOUCHER_STRICT_LOCK_FOREVER');
      const isEditForbidden = error.message.includes('VOUCHER_POSTED_EDIT_FORBIDDEN');
      
      let errorCode = ErrorCode.VOUCH_LOCKED;
      if (isStrictForever) errorCode = ErrorCode.VOUCHER_STRICT_LOCK_FOREVER;
      else if (isEditForbidden) errorCode = ErrorCode.VOUCHER_POSTED_EDIT_FORBIDDEN;
      
      throw new BusinessError(
        errorCode,
        error.message,
        { 
          status: voucher.status, 
          isPosted: voucher.isPosted,
          postingLockPolicy: voucher.postingLockPolicy,
          httpStatus: 423 
        }
      );
    }

    // Track if voucher was posted before update (for ledger resync)
    const wasPosted = voucher.isPosted;

    // Simplified update logic: create new entity with merged data
    const accountValidationService = new AccountValidationService(this.accountRepo);
    
    // CRITICAL: baseCurrency must remain the company's base currency, never from payload
    const baseCurrency = voucher.baseCurrency.toUpperCase(); // Use existing voucher's base currency (company's base)
    const mergedVoucherType = normalizeVoucherTypeCode(
      payload.type || payload.typeId || payload.baseType || payload.metadata?.type || payload.metadata?.typeId,
      voucher.type as VoucherType
    );

    let lines: VoucherLineEntity[] = [];
    let strategy: any = null;
    try {
      strategy = VoucherPostingStrategyFactory.getStrategy(mergedVoucherType);
    } catch {
      strategy = null;
    }

    if (strategy) {
      const strategyInput = {
        ...payload,
        type: mergedVoucherType
      };

      lines = await strategy.generateLines(strategyInput, companyId, baseCurrency);

      // Normalize/validate strategy-produced account refs to persisted UUIDs.
      lines = await Promise.all(lines.map(async (line, idx) => {
        const account = await accountValidationService.validateAccountById(
          companyId,
          userId,
          line.accountId,
          mergedVoucherType,
          {
            lineCurrency: line.currency,
            baseCurrency
          }
        );

        if (account.id === line.accountId) return line;

        return new VoucherLineEntity(
          idx + 1,
          account.id,
          line.side,
          line.baseAmount,
          line.baseCurrency,
          line.amount,
          line.currency,
          line.exchangeRate,
          line.notes,
          line.costCenterId,
          line.metadata
        );
      }));
    } else {
      const rawLines = payload.lines || voucher.lines;

      lines = await Promise.all(rawLines.map(async (l: any, idx: number) => {
        const originalLine = voucher.lines[idx];
        const currency = (l.currency ?? l.lineCurrency ?? originalLine?.currency ?? baseCurrency).toUpperCase();

        // 1. Resolve Account ID (UUID)
        const inputAccountId = l.accountId ?? originalLine?.accountId;
        const account = await accountValidationService.validateAccountById(
          companyId,
          userId,
          inputAccountId,
          undefined,
          {
            lineCurrency: currency,
            baseCurrency
          }
        );

        // 2. Resolve side and amounts (Handle 0 and field variations correctly)
        const side = l.side ?? originalLine?.side;
        const amount = Number(l.amount ?? originalLine?.amount ?? 0);

        // 3. MULTI-CURRENCY FIX: Use triangulation formula
        // parity = rate from Line Currency → Voucher Currency
        // headerRate = rate from Voucher Currency → Base Currency
        const parity = Number(l.parity ?? l.exchangeRate ?? originalLine?.exchangeRate ?? 1);
        const headerRate = Number(payload.exchangeRate ?? voucher.exchangeRate ?? 1);

        // The effective exchange rate for storage (Line → Base)
        const effectiveExchangeRate = roundMoney(parity * headerRate);

        // CRITICAL: baseAmount calculated using triangulation
        const baseAmount = roundMoney(amount * parity * headerRate);

        return new VoucherLineEntity(
          idx + 1,
          account.id,
          side,
          baseAmount,
          baseCurrency,
          amount,
          currency,
          effectiveExchangeRate,
          l.notes ?? originalLine?.notes,
          l.costCenterId ?? l.costCenter ?? originalLine?.costCenterId,
          { ...originalLine?.metadata, ...l.metadata }
        );
      }));
    }

    const totalDebit = lines.reduce((s: number, l: any) => s + l.debitAmount, 0);
    const totalCredit = lines.reduce((s: number, l: any) => s + l.creditAmount, 0);

    // Capture any unrecognized top-level fields into metadata to avoid data loss
    const coreFields = ['id', 'companyId', 'voucherNo', 'voucherNumber', 'type', 'date', 'description', 'currency', 'baseCurrency', 'exchangeRate', 'lines', 'status', 'metadata', 'reference', 'postingPeriodNo', 'prefix', 'formId', 'sourceModule', 'sourcePayload'];
    const extraMetadata: Record<string, any> = {};
    Object.keys(payload).forEach(key => {
      if (!coreFields.includes(key) && payload[key] !== undefined && payload[key] !== null) {
        extraMetadata[key] = payload[key];
      }
    });

    const sourcePayload = buildSourcePayload(
      payload,
      (voucher as any).sourcePayload || voucher.metadata?.sourceVoucher
    );
    const formData = buildFormData(payload, (voucher as any).formData);
    const cleanedPayloadMetadata = removeLegacySourceKeys(payload.metadata);

    let updatedVoucher = new VoucherEntity(
      voucherId,
      companyId,
      payload.voucherNo || voucher.voucherNo,
      mergedVoucherType,
      payload.date || voucher.date,
      payload.description ?? voucher.description,
      payload.currency || voucher.currency,
      baseCurrency,
      payload.exchangeRate || voucher.exchangeRate,
      lines,
      totalDebit,
      totalCredit,
      // Allow status update only for valid transitions (respects approvalRequired setting)
      this.resolveStatus(voucher.status, payload.status, approvalRequired),
      { ...voucher.metadata, ...extraMetadata, ...cleanedPayloadMetadata },
      voucher.createdBy,
      voucher.createdAt,
      voucher.approvedBy,
      voucher.approvedAt,
      voucher.rejectedBy,
      voucher.rejectedAt,
      voucher.rejectionReason,
      voucher.lockedBy,
      voucher.lockedAt,
      voucher.postedBy,
      voucher.postedAt,
      voucher.postingLockPolicy,
      voucher.reversalOfVoucherId,
      payload.reference || voucher.reference,
      new Date(),
      payload.postingPeriodNo !== undefined ? payload.postingPeriodNo : voucher.postingPeriodNo,
      sourcePayload || (voucher as any).sourcePayload || null,
      formData || (voucher as any).formData || null
    );

    // NEW Step: Policy Validation if auto-approving
    // If the update transitions the voucher to APPROVED, check the date!
    if (updatedVoucher.isApproved && this.ledgerRepo && !voucher.isApproved) {
       // This check is mainly for Flexible Mode auto-approval during update
       // If the voucher was already approved, we rely on the state guard in assertCanEdit
    }
    
    // Actually, if status is moving to APPROVED, we check policies.
    if (updatedVoucher.isApproved && !voucher.isApproved && this.policyRegistry) {
        const policies = await this.policyRegistry.getEnabledPolicies(companyId);
        if (policies.length > 0) {
           const context = {
             companyId: updatedVoucher.companyId,
             voucherId: updatedVoucher.id,
             userId: userId,
             voucherType: updatedVoucher.type,
             voucherDate: updatedVoucher.date,
             voucherNo: updatedVoucher.voucherNo,
             baseCurrency: updatedVoucher.baseCurrency,
             totalDebit: updatedVoucher.totalDebit,
             totalCredit: updatedVoucher.totalCredit,
             status: updatedVoucher.status,
             isApproved: updatedVoucher.isApproved,
             lines: updatedVoucher.lines,
             metadata: updatedVoucher.metadata,
             postingPeriodNo: updatedVoucher.postingPeriodNo
           };
           
           const valService = this.validationService || new VoucherValidationService();
           await valService.validatePolicies(context, policies, 'FAIL_FAST');
        }
    }

    // If PENDING, mark as edited (Audit badge)
    if (updatedVoucher.isPending) {
       updatedVoucher = updatedVoucher.markAsEdited();
    }

    return this.transactionManager.runTransaction(async (transaction) => {
      // If the voucher was already POSTED, we must refresh ledger entries to reflect new changes
      if (voucher.isPosted) {
        if (!this.ledgerRepo) throw new Error('Ledger repository required for updating posted vouchers');
        
        // 1. Delete old ledger records
        await this.ledgerRepo.deleteForVoucher(companyId, voucherId, transaction);
        
        // 2. Save updated voucher
        await this.voucherRepo.save(updatedVoucher, transaction);
        
        // 3. Re-record to ledger
        await this.ledgerRepo.recordForVoucher(updatedVoucher, transaction);
      } else {
        // Standard save
        await this.voucherRepo.save(updatedVoucher, transaction);
      }
    });
  }

  /**
   * Resolve status transition with validation.
   * Only allows valid transitions during update:
   * - If approvalRequired=true: DRAFT → PENDING (submit for approval)
   * - If approvalRequired=false: DRAFT → APPROVED (skip pending, auto-approve)
   * - REJECTED → PENDING (resubmit after rejection)
   */
  private resolveStatus(currentStatus: VoucherStatus, requestedStatus?: string, approvalRequired: boolean = true): VoucherStatus {
    if (!requestedStatus) {
      return currentStatus;
    }

    // When requesting 'pending' (submit for approval)
    if (requestedStatus === 'pending') {
      if (currentStatus === VoucherStatus.DRAFT || currentStatus === VoucherStatus.REJECTED) {
        // If approval is required, go to PENDING. Otherwise, skip to APPROVED.
        return approvalRequired ? VoucherStatus.PENDING : VoucherStatus.APPROVED;
      }
    }

    // For other cases, keep current status (invalid transitions ignored)
    return currentStatus;
  }
}

/**
 * ApproveVoucherUseCase
 * 
 * Satisfies the Financial Approval (FA) gate. 
 * If no other gates (like CC) are pending, transitions status to APPROVED.
 */
export class ApproveVoucherUseCase {
  constructor(
    private voucherRepo: IVoucherRepository,
    private permissionChecker: PermissionChecker,
    private policyRegistry?: any, // AccountingPolicyRegistry
    private validationService: any = null // VoucherValidationService
  ) {}

  async execute(companyId: string, userId: string, voucherId: string): Promise<void> {
    const voucher = await this.voucherRepo.findById(companyId, voucherId);
    if (!voucher) throw new Error('Voucher not found');
    
    await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.vouchers.approve');
    
    if (voucher.status !== VoucherStatus.PENDING) {
      throw new Error(`Cannot approve voucher with status: ${voucher.status}. Voucher must be in PENDING status.`);
    }

    // 1. Check if FA is required and pending
    const isFARequired = !!voucher.metadata?.financialApprovalRequired;
    const isFAPending = !!voucher.metadata?.pendingFinancialApproval;

    if (!isFAPending && isFARequired) {
       // Already satisfied
       return;
    }

    // 2. Determine if this satisfies ALL gates
    // CC is satisfied if the list is empty
    const pendingCC = voucher.metadata?.pendingCustodyConfirmations || [];
    const isFullySatisfied = pendingCC.length === 0;

    // NEW 2.5: Policy Validation Gate
    // If this satisfies all gates and will move to APPROVED, check if the period is locked!
    if (isFullySatisfied && this.policyRegistry && this.validationService) {
       const policies = await this.policyRegistry.getEnabledPolicies(companyId);
       if (policies.length > 0) {
          const context = {
            companyId: voucher.companyId,
            voucherId: voucher.id,
            userId: userId,
            voucherType: voucher.type,
            voucherDate: voucher.date,
            voucherNo: voucher.voucherNo,
            baseCurrency: voucher.baseCurrency,
            totalDebit: voucher.totalDebit,
            totalCredit: voucher.totalCredit,
            status: VoucherStatus.APPROVED,
            isApproved: true,
            lines: voucher.lines,
            metadata: voucher.metadata,
            postingPeriodNo: voucher.postingPeriodNo
          };
          
          await this.validationService.validatePolicies(context, policies, 'FAIL_FAST');
       }
    }

    // 3. Transition
    const approvedVoucher = voucher.satisfyFinancialApproval(userId, new Date(), isFullySatisfied);
    await this.voucherRepo.save(approvedVoucher);
  }
}

/**
 * PostVoucherUseCase
 * 
 * THE SINGLE PATH FOR FINANCIAL IMPACT.
 * Freezes lines, records ledger, and sets POSTED status.
 * 
 * Now includes policy validation gate:
 * 1. Core invariants (always)
 * 2. Optional policies (conditional by config)
 * 3. Then atomic post + ledger record
 */
export class PostVoucherUseCase {
  private validationService = new VoucherValidationService();

  constructor(
    private voucherRepo: IVoucherRepository,
    private ledgerRepo: ILedgerRepository,
    private permissionChecker: PermissionChecker,
    private transactionManager: ITransactionManager,
    private accountValidationService: AccountValidationService,
    private policyRegistry?: any // AccountingPolicyRegistry - optional for backward compatibility
  ) {}

  async execute(companyId: string, userId: string, voucherId: string, correlationId?: string): Promise<void> {
    // Import logger and uuid here to avoid circular deps
    const { logger } = await import('../../../infrastructure/logging/StructuredLogger');
    const { v4: uuidv4 } = await import('uuid');
    const { PostingError } = await import('../../../domain/shared/errors/AppError');
    
    // Generate correlationId if not provided
    const corrId = correlationId || uuidv4();
    
    await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.vouchers.post');
    
    return this.transactionManager.runTransaction(async (transaction) => {
      const voucher = await this.voucherRepo.findById(companyId, voucherId);
      if (!voucher) throw new Error('Voucher not found');

      // IDEMPOTENCY FIX: If already posted, return safely.
      // This allows controllers to blindly request "Post this approved voucher" without error.
      if (voucher.isPosted) {
        logger.info('POST_SKIPPED_ALREADY_POSTED', {
            voucherId: voucher.id,
            correlationId: corrId
        });
        return;
      }

      // Log posting attempt
      logger.info('POST_ATTEMPT', {
        voucherId: voucher.id,
        companyId,
        userId,
        voucherType: voucher.type,
        voucherDate: voucher.date,
        correlationId: corrId
      });

      try {
        // 1. Core Invariants (Always enforced)
        try {
          this.validationService.validateCore(voucher, corrId);
          
          // Validate and Resolve all accounts used in lines (existence, status, role, currency policy)
          const distinctAccountRawIds = [...new Set(voucher.lines.map(l => l.accountId))];
          const resolvedAccountsMap = new Map<string, string>();
          
          await Promise.all(distinctAccountRawIds.map(async (accId) => {
             const account = await this.accountValidationService.validateAccountById(
               companyId, 
               userId, 
               accId, 
               voucher.type
             );
             resolvedAccountsMap.set(accId, account.id);
          }));

          // NORMALIZATION: If any accountId in the voucher lines is a code, we must re-create the voucher
          // with actual IDs before posting to the ledger.
          const needsNormalization = voucher.lines.some(l => resolvedAccountsMap.get(l.accountId) !== l.accountId);
          
          if (needsNormalization) {
            const normalizedLines = voucher.lines.map(l => new VoucherLineEntity(
              l.id,
              resolvedAccountsMap.get(l.accountId)!,
              l.side,
              l.baseAmount,
              l.baseCurrency,
              l.amount,
              l.currency,
              l.exchangeRate,
              l.notes,
              l.costCenterId,
              l.metadata
            ));
            
            // Re-instantiate voucher with normalized lines
            // We can't mutate VoucherEntity (immutable), but we can create a projected copy for posting
            // However, voucher.post() returns a new entity, so we can just use the normalized lines there.
             (voucher as any).lines = normalizedLines; // TEMPORARY mutation for posting logic if needed, 
             // but cleaner is to pass it to post. 
             // Looking at VoucherEntity.post, it uses this.lines.
          }
        } catch (error: any) {
          // Log core rejection
          logger.error('POST_REJECTED_CORE', {
            code: error.appError?.code || 'UNKNOWN',
            message: error.message,
            correlationId: corrId
          });
          throw error;
        }
        
        // 2. Optional Policies (Conditional by config)
        if (this.policyRegistry) {
          // Load config to get policyErrorMode
          const config = await this.policyRegistry.getConfig(companyId);
          const policyErrorMode = config.policyErrorMode || 'FAIL_FAST';
          
          // Get enabled policies for this company
          const policies = await this.policyRegistry.getEnabledPolicies(companyId);
          
          if (policies.length > 0) {
            // Build policy context from voucher
            const context = {
              companyId: voucher.companyId,
              voucherId: voucher.id,
              userId: userId, // For AccountAccessPolicy user scope lookup
              voucherType: voucher.type,
              voucherDate: voucher.date,
              voucherNo: voucher.voucherNo,
              baseCurrency: voucher.baseCurrency,
              totalDebit: voucher.totalDebit,
              totalCredit: voucher.totalCredit,
              status: voucher.status,
              isApproved: voucher.isApproved,
              lines: voucher.lines,
              metadata: voucher.metadata,
              postingPeriodNo: voucher.postingPeriodNo
            };
            
            // Run policy validation with mode
            try {
              await this.validationService.validatePolicies(context, policies, policyErrorMode, corrId);
            } catch (error: any) {
              // Log policy rejection
              if (error instanceof PostingError) {
                logger.error('POST_REJECTED_POLICY', {
                  violationCount: error.appError.details.violations.length,
                  violations: error.appError.details.violations,
                  correlationId: corrId
                });
              }
              throw error;
            }
          }
        }
        
        // 3. State Transition (Freezes lines + Mode Snapshotting)
        let lockPolicy = PostingLockPolicy.FLEXIBLE_LOCKED;
        if (this.policyRegistry) {
          try {
            const config = await this.policyRegistry.getConfig(companyId);
            const isStrictNow = config.financialApprovalEnabled || config.custodyConfirmationEnabled;
            
            if (isStrictNow) {
              lockPolicy = PostingLockPolicy.STRICT_LOCKED; // AUDIT LOCK
            } else if (config.allowEditDeletePosted) {
              lockPolicy = PostingLockPolicy.FLEXIBLE_EDITABLE;
            } else {
              lockPolicy = PostingLockPolicy.FLEXIBLE_LOCKED;
            }
          } catch (e) {}
        }

        const postedVoucher = voucher.post(userId, new Date(), lockPolicy);
        
        // 4. Single Source of Truth: Record to Ledger
        await this.ledgerRepo.recordForVoucher(postedVoucher, transaction);

        // 5. Finalizing persistence
        await this.voucherRepo.save(postedVoucher, transaction);

        // EXTRA: If this is a reversal, officially mark the original as reversed
        if (postedVoucher.reversalOfVoucherId) {
          const originalVoucher = await this.voucherRepo.findById(companyId, postedVoucher.reversalOfVoucherId);
          if (originalVoucher) {
            const reversedOriginal = originalVoucher.markAsReversed(postedVoucher.id);
            await this.voucherRepo.save(reversedOriginal, transaction);
          }
        }

        // Log success
        logger.info('POST_SUCCESS', {
          postedVoucherId: postedVoucher.id,
          correlationId: corrId
        });
        
      } catch (error) {
        // Error already logged in specific catch blocks
        throw error;
      }
    });
  }
}

export class CancelVoucherUseCase {
  constructor(
    private voucherRepo: IVoucherRepository,
    private ledgerRepo: ILedgerRepository,
    private permissionChecker: PermissionChecker,
    private policyConfigProvider?: IAccountingPolicyConfigProvider
  ) {}

  async execute(companyId: string, userId: string, voucherId: string): Promise<void> {
    const voucher = await this.voucherRepo.findById(companyId, voucherId);
    if (!voucher) throw new Error('Voucher not found');
    
    await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.vouchers.delete');
    
    // V3: Governance Guard for Deleting Posted Vouchers
    let isStrictMode = true; // Default to strict
    let allowEditDeletePosted = false;
    if (this.policyConfigProvider) {
      try {
        const config = await this.policyConfigProvider.getConfig(companyId);
        isStrictMode = (config.strictApprovalMode || config.financialApprovalEnabled || config.approvalRequired) ?? true;
        allowEditDeletePosted = config.allowEditDeletePosted ?? false;
      } catch (e) {}
    }
    
    try {
      voucher.assertCanDelete(isStrictMode, allowEditDeletePosted);
    } catch (error: any) {
      const isStrictForever = error.message.includes('VOUCHER_STRICT_LOCK_FOREVER');
      const isDeleteForbidden = error.message.includes('VOUCHER_POSTED_DELETE_FORBIDDEN');
      
      let errorCode = ErrorCode.VOUCH_LOCKED;
      if (isStrictForever) errorCode = ErrorCode.VOUCHER_STRICT_LOCK_FOREVER;
      else if (isDeleteForbidden) errorCode = ErrorCode.VOUCHER_POSTED_DELETE_FORBIDDEN;
      
      throw new BusinessError(
        errorCode,
        `Cannot delete voucher: ${error.message}`,
        { 
          status: voucher.status, 
          isPosted: voucher.isPosted, 
          postingLockPolicy: voucher.postingLockPolicy,
          httpStatus: 423 
        }
      );
    }
    
    // V1: If voucher was posted, delete ledger entries
    if (voucher.isPosted) {
       await this.ledgerRepo.deleteForVoucher(companyId, voucherId);
    }
    
    const cancelledVoucher = voucher.cancel(userId, new Date(), 'Deleted by user', voucher.isPosted);
    await this.voucherRepo.save(cancelledVoucher);
  }
}

export class DeleteVoucherUseCase {
  constructor(
    private voucherRepo: IVoucherRepository,
    private ledgerRepo: ILedgerRepository,
    private permissionChecker: PermissionChecker,
    private configProvider: IAccountingPolicyConfigProvider
  ) {}

  async execute(companyId: string, userId: string, voucherId: string) {
    const voucher = await this.voucherRepo.findById(companyId, voucherId);
    if (!voucher) throw new Error('Voucher not found');
    
    // Explicit DELETE permission check (distinct from CANCEL)
    await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.vouchers.delete');

    // Load policy
    let config;
    try {
      config = await this.configProvider.getConfig(companyId);
    } catch (e) {
      config = {} as any;
    }

    // Policy Check - Align with PostVoucherUseCase & UpdateVoucherUseCase
    const isStrictMode = (config.strictApprovalMode || config.financialApprovalEnabled || config.approvalRequired) ?? true;
    const allowEditDeletePosted = config.allowEditDeletePosted ?? false;
    
    try {
      voucher.assertCanDelete(isStrictMode, allowEditDeletePosted);
    } catch (error: any) {
      const isStrictForever = error.message.includes('VOUCHER_STRICT_LOCK_FOREVER');
      const isDeleteForbidden = error.message.includes('VOUCHER_POSTED_DELETE_FORBIDDEN');
      
      let errorCode = ErrorCode.VOUCH_LOCKED;
      if (isStrictForever) errorCode = ErrorCode.VOUCHER_STRICT_LOCK_FOREVER;
      else if (isDeleteForbidden) errorCode = ErrorCode.VOUCHER_POSTED_DELETE_FORBIDDEN;
      
      throw new BusinessError(
        errorCode,
        `Cannot delete voucher: ${error.message}`,
        { httpStatus: 423 }
      );
    }
    
    // Clean up ledger entries if posted
    if (voucher.isPosted) {
       await this.ledgerRepo.deleteForVoucher(companyId, voucherId);
    }
    
    // HARD DELETE the voucher record
    await this.voucherRepo.delete(companyId, voucherId);
  }
}

export class GetVoucherUseCase {
  constructor(
    private voucherRepo: IVoucherRepository,
    private permissionChecker: PermissionChecker
  ) {}

  async execute(companyId: string, userId: string, voucherId: string): Promise<VoucherEntity> {
    const voucher = await this.voucherRepo.findById(companyId, voucherId);
    if (!voucher) throw new Error('Voucher not found');
    await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.vouchers.view');
    return voucher;
  }
}

export class ListVouchersUseCase {
  constructor(
    private voucherRepo: IVoucherRepository,
    private permissionChecker: PermissionChecker
  ) {}

  async execute(
    companyId: string, 
    userId: string, 
    limit?: number,
    filters?: {
      from?: string;
      to?: string;
      type?: string;
      status?: string;
      search?: string;
      formId?: string;
    },
    offset?: number
  ): Promise<VoucherEntity[]> {
    await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.vouchers.view');
    return this.voucherRepo.findByCompany(companyId, limit, filters, offset);
  }
}
