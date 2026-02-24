import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Settings, Shield, Lock, Building2, DollarSign, AlertTriangle, Globe, Calendar, Layout, Save, Coins, CreditCard, Plus, Trash2, X, CheckCircle2, Info, RefreshCw, Check, Hash, RotateCcw, FileText, ArrowLeftRight, Layers } from 'lucide-react';
import { CompanyCurrencySettings } from './settings/CompanyCurrencySettings';
import FXRevaluationTab from './settings/FXRevaluationTab';
import { AccountSelector } from '../components/shared/AccountSelector';
import { DatePicker } from '../components/shared/DatePicker';
import client from '../../../api/client';
import { AccountsProvider } from '../../../context/AccountsContext';

import { CostCentersPage } from './CostCentersPage';
import { useAuth } from '../../../hooks/useAuth';
import { useCompanyAccess } from '../../../context/CompanyAccessContext';
import { useCompanySettings } from '../../../hooks/useCompanySettings';
import { errorHandler } from '../../../services/errorHandler';
import { accountingApi, FiscalYearDTO } from '../../../api/accountingApi';
import { accountingApi as domainApi } from '../../../api/accounting'; // For createAccount
import { useAccounts } from '../../../context/AccountsContext';
import { 
  InstructionsButton, 
  generalSettingsInstructions,
  currenciesInstructions,
  policiesInstructions,
  paymentMethodsInstructions,
  costCenterInstructions,
  errorModeInstructions,
  fiscalYearInstructions
} from '../../../components/instructions';

interface PolicyConfig {
  // Approval Policy V1 Toggles
  financialApprovalEnabled: boolean;      // FA: Role-based financial approval
  faApplyMode: 'ALL' | 'MARKED_ONLY';     // FA scope: all vouchers or only marked accounts
  custodyConfirmationEnabled: boolean;    // CC: User-bound custody confirmation
  
  // Smart CC Settings (V2)
  ccThirdPartyMode?: 'RECEIVER_ONLY' | 'BOTH';  // Who confirms third-party vouchers
  ccAmountThreshold?: number;                     // Min amount for CC
  ccAllowSelfConfirmation?: boolean;              // Allow creator to confirm own receipt
  ccBlockIfNoCustodian?: boolean;                 // Block if custodian unassigned
  ccReversalMode?: 'SAME_AS_ORIGINAL' | 'AUTO_APPROVE';  // Reversal CC behavior
  
  // Legacy (kept for backward compatibility)
  approvalRequired: boolean;              // Maps to financialApprovalEnabled
  
  // Mode A Controls (V1)
  autoPostEnabled: boolean;               // Auto-post when approved
  allowEditDeletePosted: boolean;         // Allow editing posted vouchers
  
  periodLockEnabled: boolean;
  lockedThroughDate?: string;
  accountAccessEnabled: boolean;
  costCenterPolicy: {
    enabled: boolean;
    requiredFor: {
      accountTypes?: string[];
      accountIds?: string[];
    };
  };
  policyErrorMode: 'FAIL_FAST' | 'AGGREGATE';
  updatedAt?: string;
  updatedBy?: string;
  paymentMethods?: PaymentMethodDefinition[];
}

interface PaymentMethodDefinition {
  id: string;
  name: string;
  isEnabled: boolean;
}

const SectionHeader: React.FC<{ 
  title: string; 
  description: string; 
  onSave: () => void;
  disabled: boolean;
  saving: boolean;
}> = ({ title, description, onSave, disabled, saving }) => {
  const { t } = useTranslation('accounting');
  return (
    <div className="flex flex-col gap-4 mb-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-[var(--color-text-primary)] mb-1">{title}</h2>
          <p className="text-gray-600 dark:text-[var(--color-text-secondary)]">{description}</p>
        </div>
        <button
          onClick={onSave}
          disabled={disabled}
          className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-sm font-bold active:scale-95"
        >
          {saving ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Save size={18} />
          )}
          {saving ? t('settings.saving') : t('settings.saveLabel', { section: title })}
        </button>
      </div>
    </div>
  );
};

const AccountingSettingsPageContent: React.FC = () => {
  const { t, i18n } = useTranslation('accounting');
  const [activeTab, setActiveTab] = useState<'general' | 'currencies' | 'policies' | 'payment-methods' | 'cost-center' | 'cost-centers-manage' | 'error-mode' | 'fiscal' | 'numbering' | 'fx-revaluation'>('general');
  const { user } = useAuth();
  const { companyId } = useCompanyAccess();
  const { settings: coreSettings, updateSettings: updateCoreSettings } = useCompanySettings();
  const { accounts, refreshAccounts } = useAccounts();

  const [config, setConfig] = useState<PolicyConfig>({
    financialApprovalEnabled: false,
    faApplyMode: 'ALL',
    custodyConfirmationEnabled: false,
    approvalRequired: false,  // Legacy sync
    autoPostEnabled: true,                    // V1 Default: auto-post when approved
    allowEditDeletePosted: false,             // V1 Default: posted vouchers are immutable
    periodLockEnabled: false,
    accountAccessEnabled: false,
    costCenterPolicy: {
      enabled: false,
      requiredFor: {}
    },
    policyErrorMode: 'FAIL_FAST',
    paymentMethods: []
  });
  const [originalConfig, setOriginalConfig] = useState<PolicyConfig | null>(null);
  const [localCoreSettings, setLocalCoreSettings] = useState({
    timezone: 'UTC',
    dateFormat: 'DD/MM/YYYY',
    uiMode: 'windows' as 'windows' | 'classic',
    strictApprovalMode: true
  });
  const [originalCoreSettings, setOriginalCoreSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fiscalYears, setFiscalYears] = useState<FiscalYearDTO[]>([]);
  const [fiscalLoading, setFiscalLoading] = useState(false);
  const [fyYear, setFyYear] = useState<number>(new Date().getFullYear());
  const [fyStartMonth, setFyStartMonth] = useState<number>(1);
  const [fyPeriodScheme, setFyPeriodScheme] = useState<'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUAL'>('MONTHLY');
  const [retainedEarningsAccountId, setRetainedEarningsAccountId] = useState<string>('');
  const [specialPeriodData, setSpecialPeriodData] = useState<{
    isOpen: boolean;
    fyId: string;
    existingNames: string[];
    newName: string;
  }>({
    isOpen: false,
    fyId: '',
    existingNames: [],
    newName: ''
  });
  const [closingFyId, setClosingFyId] = useState<string | null>(null);
  const [closingStep, setClosingStep] = useState<'PREVIEW' | 'REVIEW' | 'SUCCESS'>('PREVIEW');
  const [closingSummary, setClosingSummary] = useState<any>(null);
  const [draftClosingVoucher, setDraftClosingVoucher] = useState<any>(null);
  const [pandLClearingAccountId, setPandLClearingAccountId] = useState<string>('');
  const [lastClosingVoucher, setLastClosingVoucher] = useState<any>(null);
  const [reopenVoucherDetails, setReopenVoucherDetails] = useState<any>(null);
  const [sequences, setSequences] = useState<any[]>([]);
  const [seqPrefix, setSeqPrefix] = useState<string>('JE');
  const [seqYear, setSeqYear] = useState<number | ''>('');
  const [seqNext, setSeqNext] = useState<number>(1);
  const [genericConfirm, setGenericConfirm] = useState<{
    isOpen: boolean;
    type: 'CLOSE_PERIOD' | 'REOPEN_PERIOD' | 'REOPEN_YEAR' | 'DELETE_YEAR' | null;
    fyId: string;
    periodId?: string;
    label: string;
  }>({
    isOpen: false,
    type: null,
    fyId: '',
    label: ''
  });

  // Granular tabs as per implementation plan
  const tabs = [
    { id: 'general', label: 'General Settings', icon: Globe },
    { id: 'currencies', label: 'Currencies', icon: Coins },
    { id: 'policies', label: 'Approval Workflow', icon: Shield },
    { id: 'payment-methods', label: 'Payment Methods', icon: CreditCard },
    { id: 'cost-center', label: 'Cost Center Required', icon: DollarSign },
    { id: 'cost-centers-manage', label: 'Cost Centers', icon: Layers },
    { id: 'error-mode', label: 'Policy Error Mode', icon: AlertTriangle },
    { id: 'fiscal', label: 'Accounting Periods', icon: Building2 },
    { id: 'numbering', label: 'Voucher Numbering', icon: Hash },
    { id: 'fx-revaluation', label: 'FX Revaluation', icon: ArrowLeftRight },
  ];

  // Mode A = both Financial Approval AND Custody Confirmation are OFF
  const isModeA = !config.financialApprovalEnabled && !config.custodyConfirmationEnabled;

  useEffect(() => {
    if (coreSettings) {
      const newCore = {
        timezone: coreSettings.timezone || 'UTC',
        dateFormat: coreSettings.dateFormat || 'DD/MM/YYYY',
        uiMode: coreSettings.uiMode || 'windows',
        strictApprovalMode: coreSettings.strictApprovalMode !== false
      };
      setLocalCoreSettings(newCore);
      setOriginalCoreSettings(newCore);
    }
  }, [coreSettings]);

  useEffect(() => {
    loadSettings();
  }, [companyId]);

  useEffect(() => {
    if (activeTab === 'fiscal') {
      loadFiscalYears();
    }
    if (activeTab === 'numbering') {
      loadSequences();
    }
  }, [activeTab]);

  const loadSettings = async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      // Note: client interceptor unwraps { success, data } - returns data directly
      const data = await client.get(`tenant/accounting/policy-config`);
      console.log('[AccountingSettings] Load response:', data);
      
      if (data) {
        console.log('[AccountingSettings] Setting config:', data);
        // Filter out baseCurrency as it's a Global attribute, not a module setting
        const { baseCurrency, ...rest } = data as any;
        const loadedConfig = { 
          ...rest,
          paymentMethods: (data as any).paymentMethods || []
        };
        setConfig(loadedConfig as any);
        setOriginalConfig(loadedConfig as any);
      }
    } catch (error: any) {
      errorHandler.showError(error.response?.data?.error?.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const loadFiscalYears = async () => {
    setFiscalLoading(true);
    try {
      const data = await accountingApi.listFiscalYears();
      setFiscalYears(data as any);
    } catch (error: any) {
      errorHandler.showError(error?.response?.data?.error?.message || 'Failed to load fiscal years');
    } finally {
      setFiscalLoading(false);
    }
  };

  const loadSequences = async () => {
    try {
      const data = await accountingApi.listVoucherSequences();
      setSequences(data || []);
    } catch (error: any) {
      errorHandler.showError(error?.response?.data?.error?.message || 'Failed to load sequences');
    }
  };

  const handleSave = async (section?: string) => {
    if (!companyId) return;
    
    setSaving(true);
    try {
      if (section === 'general') {
        // Save ONLY core settings (timezone, dateFormat, uiMode, strictApprovalMode)
        const settingsToSave = {
          ...localCoreSettings,
          strictApprovalMode: config.financialApprovalEnabled
        };
        await updateCoreSettings(settingsToSave);
        setOriginalCoreSettings(settingsToSave);
        errorHandler.showSuccess(t('settings.messages.generalSaved'));
      } else {
        // Save policy config for the active section
        const { baseCurrency, ...savePayload } = config as any;
        const result = await client.put(`tenant/accounting/policy-config`, savePayload) as any;
        if (result?.success === false) {
          throw new Error(result.error?.message || 'Failed to save policy settings');
        }
        setOriginalConfig(config);

        // If policies tab, also sync strictApprovalMode bidirectionally
        if (section === 'policies') {
          const settingsToSave = {
            ...localCoreSettings,
            strictApprovalMode: config.financialApprovalEnabled
          };
          await updateCoreSettings(settingsToSave);
          setOriginalCoreSettings(settingsToSave);
          const modeText = settingsToSave.strictApprovalMode ? t('settings.messages.strictOn') : t('settings.messages.strictOff');
          errorHandler.showSuccess(t('settings.messages.policiesSaved', { mode: modeText }));
        } else {
          // Validation for Fiscal tab
          if (section === 'fiscal' && config.periodLockEnabled && !config.lockedThroughDate) {
            errorHandler.showError(t('settings.fiscal.dateRequired', 'Locked Through Date is required when period locking is enabled.'));
            setSaving(false);
            return;
          }

          const label = section ? t(`settings.tabs.${section.replace(/-/g, '')}`, { defaultValue: section }) : t('settings.messages.settings');
          errorHandler.showSuccess(t('settings.messages.sectionSaved', { section: label }));
        }
      }
    } catch (error: any) {
      const errorData = error.response?.data?.error;
      if (errorData?.details?.violations) {
        const messages = errorData.details.violations.map((v: any) => v.message).join(', ');
        errorHandler.showError(messages);
      } else {
        errorHandler.showError(errorData?.message || t('settings.messages.saveFailed'));
      }
    } finally {
      setSaving(false);
    }
  };

  // Section-specific change detection
  const hasGeneralChanges = JSON.stringify(localCoreSettings) !== JSON.stringify(originalCoreSettings);
  
  const hasPolicyChanges = originalConfig ? (
    config.financialApprovalEnabled !== originalConfig.financialApprovalEnabled ||
    config.faApplyMode !== originalConfig.faApplyMode ||
    config.custodyConfirmationEnabled !== originalConfig.custodyConfirmationEnabled ||
    config.ccThirdPartyMode !== originalConfig.ccThirdPartyMode ||
    config.ccAmountThreshold !== originalConfig.ccAmountThreshold ||
    config.ccAllowSelfConfirmation !== originalConfig.ccAllowSelfConfirmation ||
    config.ccBlockIfNoCustodian !== originalConfig.ccBlockIfNoCustodian ||
    config.ccReversalMode !== originalConfig.ccReversalMode ||
    config.autoPostEnabled !== originalConfig.autoPostEnabled ||
    config.allowEditDeletePosted !== originalConfig.allowEditDeletePosted
  ) : false;

  const hasMethodChanges = JSON.stringify(config.paymentMethods) !== JSON.stringify(originalConfig?.paymentMethods);
  const hasCostCenterChanges = JSON.stringify(config.costCenterPolicy) !== JSON.stringify(originalConfig?.costCenterPolicy);
  const hasErrorModeChanges = config.policyErrorMode !== originalConfig?.policyErrorMode;
  const hasFiscalChanges = config.periodLockEnabled !== originalConfig?.periodLockEnabled || 
                          config.lockedThroughDate !== originalConfig?.lockedThroughDate;

  // Global change flag (for reference)
  const hasAnyChanges = hasGeneralChanges || hasPolicyChanges || hasMethodChanges || hasCostCenterChanges || hasErrorModeChanges || hasFiscalChanges;

  const handleCreateFiscalYear = async () => {
    // Prevent duplicate years
    const exists = fiscalYears.find(fy => fy.name.includes(fyYear.toString()));
    if (exists) {
      errorHandler.showError(t('settings.messages.fiscalYearExists', { year: fyYear }));
      return;
    }

    try {
      setFiscalLoading(true);
      await accountingApi.createFiscalYear({ 
          year: fyYear, 
          startMonth: fyStartMonth,
          periodScheme: fyPeriodScheme
      });
      await loadFiscalYears();
      errorHandler.showSuccess(t('settings.messages.fiscalYearCreated'));
    } catch (error: any) {
      errorHandler.showError(error?.response?.data?.error?.message || 'Failed to create fiscal year');
    } finally {
      setFiscalLoading(false);
    }
  };

  const handleClosePeriod = async (fyId: string, periodId: string) => {
    const fy = fiscalYears.find(f => f.id === fyId);
    if (fy?.status === 'CLOSED') {
      errorHandler.showError(t('settings.messages.fiscalYearClosedError'));
      return;
    }
    const period = fy?.periods.find(p => p.id === periodId);
    setGenericConfirm({
      isOpen: true,
      type: 'CLOSE_PERIOD',
      fyId,
      periodId,
      label: (period && fy) ? `${t(`budget.months.${period.name.toLowerCase().substring(0,3)}`)} ${fy.name}` : fy?.name || ''
    });
  };

  const handleReopenPeriod = async (fyId: string, periodId: string) => {
    const fy = fiscalYears.find(f => f.id === fyId);
    if (fy?.status === 'CLOSED') {
      errorHandler.showError(t('settings.messages.fiscalYearClosedError'));
      return;
    }
    const period = fy?.periods.find(p => p.id === periodId);
    setGenericConfirm({
      isOpen: true,
      type: 'REOPEN_PERIOD',
      fyId,
      periodId,
      label: (period && fy) ? `${t(`budget.months.${period.name.toLowerCase().substring(0,3)}`)} ${fy.name}` : fy?.name || ''
    });
  };

  const confirmClosePeriod = async () => {
    const { fyId, periodId } = genericConfirm;
    if (!periodId) return;
    try {
      setFiscalLoading(true);
      await accountingApi.closeFiscalPeriod(fyId, periodId);
      await loadFiscalYears();
      errorHandler.showSuccess(t('settings.messages.periodClosed'));
      setGenericConfirm(prev => ({ ...prev, isOpen: false }));
    } catch (error: any) {
      errorHandler.showError(error?.response?.data?.error?.message || 'Failed to close period');
    } finally {
      setFiscalLoading(false);
    }
  };

  const confirmReopenPeriod = async () => {
    const { fyId, periodId } = genericConfirm;
    if (!periodId) return;
    try {
      setFiscalLoading(true);
      await accountingApi.reopenFiscalPeriod(fyId, periodId);
      await loadFiscalYears();
      errorHandler.showSuccess(t('settings.messages.periodReopened'));
      setGenericConfirm(prev => ({ ...prev, isOpen: false }));
    } catch (error: any) {
      errorHandler.showError(error?.response?.data?.error?.message || 'Failed to reopen period');
    } finally {
      setFiscalLoading(false);
    }
  };

  const handlePrepareClosing = async () => {
    if (!closingFyId) return;
    if (!retainedEarningsAccountId) {
      errorHandler.showError(t('settings.messages.retainedRequired'));
      return;
    }
    
    setFiscalLoading(true);
    try {
      // Step 1: Generate the DRAFT closing voucher
      const result = await accountingApi.closeFiscalYear(closingFyId, retainedEarningsAccountId, pandLClearingAccountId || undefined);
      setClosingSummary(result);
      
      // Step 2: Fetch the generated draft voucher to show its lines
      if (result.voucherId) {
        const voucher = await accountingApi.getVoucher(result.voucherId);
        setDraftClosingVoucher(voucher);
      }
      
      setClosingStep('REVIEW');
    } catch (e: any) {
      errorHandler.showError(e?.response?.data?.error?.message || 'Preparation failed');
    } finally {
      setFiscalLoading(false);
    }
  };

  const confirmCloseYear = async () => {
    if (!closingFyId) return;
    try {
      setFiscalLoading(true);
      // Final Step: Commit the generated DRAFT voucher
      const result = await accountingApi.commitFiscalYearClose(closingFyId);
      setClosingStep('SUCCESS');
      await loadFiscalYears();
    } catch (error: any) {
      errorHandler.showError(error?.response?.data?.error?.message || 'Failed to close fiscal year');
    } finally {
      setFiscalLoading(false);
    }
  };

  const handleCloseModalReset = () => {
    setClosingFyId(null);
    setClosingStep('PREVIEW');
    setClosingSummary(null);
    setDraftClosingVoucher(null);
    setLastClosingVoucher(null);
    setRetainedEarningsAccountId('');
    setPandLClearingAccountId('');
  };

  const handleReopenYear = async (fyId: string) => {
    const fy = fiscalYears.find(f => f.id === fyId);
    setGenericConfirm({
      isOpen: true,
      type: 'REOPEN_YEAR',
      fyId,
      label: fy?.name || ''
    });

    if (fy?.closingVoucherId) {
      try {
        const v = await accountingApi.getVoucher(fy.closingVoucherId);
        setReopenVoucherDetails(v);
      } catch (e) {
        console.error('Failed to fetch closing voucher for reopen', e);
        setReopenVoucherDetails(null);
      }
    } else {
      setReopenVoucherDetails(null);
    }
  };

  const confirmReopenYear = async () => {
    const { fyId } = genericConfirm;
    try {
      setFiscalLoading(true);
      await accountingApi.reopenFiscalYear(fyId);
      await loadFiscalYears();
      errorHandler.showSuccess(t('settings.messages.fiscalYearReopened', 'Fiscal year reopened and audit voucher reversed.'));
      setGenericConfirm(prev => ({ ...prev, isOpen: false }));
    } catch (error: any) {
      errorHandler.showError(error?.response?.data?.error?.message || 'Failed to reopen fiscal year');
    } finally {
      setFiscalLoading(false);
    }
  };

  useEffect(() => {
    const fetchLastVoucher = async () => {
      const fy = fiscalYears.find(f => f.id === closingFyId);
      if (fy?.closingVoucherId) {
        try {
          const v = await accountingApi.getVoucher(fy.closingVoucherId);
          setLastClosingVoucher(v);
        } catch (e) {
          console.error('Failed to fetch closing voucher', e);
        }
      } else {
        setLastClosingVoucher(null);
      }
    };
    if (closingFyId && closingStep === 'PREVIEW') {
      fetchLastVoucher();
    }
  }, [closingFyId, closingStep, fiscalYears]);

  const handleDeleteFiscalYear = async (fyId: string) => {
    const fy = fiscalYears.find(f => f.id === fyId);
    setGenericConfirm({
      isOpen: true,
      type: 'DELETE_YEAR',
      fyId,
      label: fy?.name || ''
    });
  };

  const confirmDeleteYear = async () => {
    const { fyId } = genericConfirm;
    try {
      setFiscalLoading(true);
      await accountingApi.deleteFiscalYear(fyId);
      await loadFiscalYears();
      errorHandler.showSuccess(t('settings.messages.fiscalYearDeleted'));
      setGenericConfirm(prev => ({ ...prev, isOpen: false }));
    } catch (error: any) {
      errorHandler.showError(error?.response?.data?.error?.message || 'Failed to delete fiscal year');
    } finally {
      setFiscalLoading(false);
    }
  };

  const handleEnableSpecialPeriods = (fyId: string) => {
    const fy = fiscalYears.find(f => f.id === fyId);
    if (!fy) return;
    
    const existing = fy.periods.filter(p => p.isSpecial).map(p => p.name);
    if (existing.length >= 4) return;

    setSpecialPeriodData({
      isOpen: true,
      fyId,
      existingNames: existing,
      newName: `${t('settings.fiscal.specialPeriod', 'Special Period')} P${13 + existing.length}`
    });
  };

  const confirmAddSpecialPeriod = async () => {
    const { fyId, existingNames, newName } = specialPeriodData;
    if (!newName.trim()) {
      errorHandler.showError(t('settings.fiscal.nameRequired', 'Period name is required'));
      return;
    }

    try {
      setFiscalLoading(true);
      const definitions = [
        ...existingNames.map(name => ({ name })),
        { name: newName.trim() }
      ];
      await accountingApi.enableSpecialPeriods(fyId, definitions);
      await loadFiscalYears();
      errorHandler.showSuccess(t('settings.fiscal.messages.specialPeriodsUpdated', 'Special period added successfully'));
      setSpecialPeriodData(prev => ({ ...prev, isOpen: false }));
    } catch (error: any) {
      errorHandler.showError(error?.response?.data?.error?.message || 'Failed to add special period');
    } finally {
      setFiscalLoading(false);
    }
  };

  const handleAutoCreateRetainedEarnings = async () => {
    setFiscalLoading(true);
    try {
      const result = await accountingApi.autoCreateRetainedEarnings();
      
      // Refresh and Select
      await refreshAccounts();
      if (result.account && result.account.id) {
        setRetainedEarningsAccountId(result.account.id);
      }
      
      if (result.created) {
        errorHandler.showSuccess(result.message);
      } else {
        errorHandler.showSuccess(t('settings.messages.retainedEarningsExists', result.message));
      }

    } catch (error: any) {
      errorHandler.showError(error?.message || 'Failed to auto-create account');
    } finally {
      setFiscalLoading(false);
    }
  };

  const handleSetNextNumber = async () => {
    if (!seqPrefix || !seqNext) {
      errorHandler.showError(t('settings.messages.prefixRequired'));
      return;
    }
    try {
      setSaving(true);
      await accountingApi.setNextVoucherNumber(seqPrefix, seqNext, seqYear === '' ? undefined : Number(seqYear));
      await loadSequences();
      errorHandler.showSuccess(t('settings.messages.nextNumberUpdated'));
    } catch (error: any) {
      errorHandler.showError(error?.response?.data?.error?.message || 'Failed to update sequence');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-500">{t('settings.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-[var(--color-bg-primary)]">
      {/* Header (Simplified - Save buttons moved to sections) */}
      <div className="flex-none px-8 py-6 bg-white dark:bg-[var(--color-bg-secondary)] border-b border-gray-200 dark:border-[var(--color-border)] flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-[var(--color-text-primary)]">{t('settings.title')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-[var(--color-text-secondary)]">
            {t('settings.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <InstructionsButton 
            instructions={
              activeTab === 'general' ? generalSettingsInstructions :
              activeTab === 'currencies' ? currenciesInstructions :
              activeTab === 'policies' ? policiesInstructions :
              activeTab === 'payment-methods' ? paymentMethodsInstructions :
              activeTab === 'cost-center' ? costCenterInstructions :
              activeTab === 'error-mode' ? errorModeInstructions :
              fiscalYearInstructions
            } 
          />
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Vertical Sidebar Navigation */}
        <aside className="w-64 border-r border-gray-200 dark:border-[var(--color-border)] bg-gray-50 dark:bg-[var(--color-bg-primary)] overflow-y-auto block">
          <nav className="p-4 space-y-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
                    ${isActive
                      ? 'bg-white dark:bg-[var(--color-bg-secondary)] text-indigo-700 dark:text-primary-400 shadow-sm ring-1 ring-gray-200 dark:ring-[var(--color-border)]'
                      : 'text-gray-600 dark:text-[var(--color-text-secondary)] hover:bg-gray-100 dark:hover:bg-[var(--color-bg-tertiary)] hover:text-gray-900 dark:hover:text-[var(--color-text-primary)]'
                    }
                  `}
                >
                  <Icon 
                    size={18} 
                    className={isActive ? 'text-indigo-600 dark:text-primary-400' : 'text-gray-400 dark:text-[var(--color-text-muted)]'} 
                  />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto bg-white dark:bg-[var(--color-bg-secondary)]">
          <div className="p-8">


                  {/* General Settings Tab */}
                  {activeTab === 'general' && (
                    <div className="max-w-4xl mx-auto space-y-8">
                      <SectionHeader 
                        title={t('settings.tabs.general')} 
                        description={t('settings.general.description')}
                        onSave={() => handleSave('general')}
                        disabled={!hasGeneralChanges || saving}
                        saving={saving}
                      />
                      
                      <div className="space-y-6">
                  {/* Timezone */}
                  <div className="bg-white dark:bg-[var(--color-bg-tertiary)] border border-gray-200 dark:border-[var(--color-border)] rounded-xl p-6 shadow-sm">
                    <label className="flex items-center gap-2 font-semibold text-gray-900 dark:text-[var(--color-text-primary)] mb-2">
                      <Globe size={20} className="text-blue-500" />
                      {t('settings.general.timezone')}
                    </label>
                    <p className="text-sm text-gray-500 dark:text-[var(--color-text-secondary)] mb-4">
                      {t('settings.general.timezoneDesc')}
                    </p>
                    <select
                      className="block w-full max-w-xs px-3 py-2 border border-gray-300 dark:border-[var(--color-border)] dark:bg-[var(--color-bg-secondary)] dark:text-[var(--color-text-primary)] rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      value={localCoreSettings.timezone}
                      onChange={(e) => setLocalCoreSettings({ ...localCoreSettings, timezone: e.target.value })}
                    >
                      <option value="UTC">UTC (Universal Time)</option>
                      <option value="Europe/Istanbul">Europe/Istanbul (UTC+03:00)</option>
                      <option value="Europe/London">Europe/London (GMT/BST)</option>
                      <option value="America/New_York">America/New_York (EST/EDT)</option>
                      <option value="Asia/Dubai">Asia/Dubai (GST)</option>
                    </select>
                  </div>

                  {/* Date Format */}
                  <div className="bg-white dark:bg-[var(--color-bg-tertiary)] border border-gray-200 dark:border-[var(--color-border)] rounded-xl p-6 shadow-sm">
                    <label className="flex items-center gap-2 font-semibold text-gray-900 dark:text-[var(--color-text-primary)] mb-2">
                      <Calendar size={20} className="text-green-500" />
                      {t('settings.general.dateFormat')}
                    </label>
                    <p className="text-sm text-gray-500 dark:text-[var(--color-text-secondary)] mb-4">
                      {t('settings.general.dateFormatDesc')}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
                      {['DD/MM/YYYY', 'YYYY-MM-DD', 'MM/DD/YYYY', 'DD.MM.YYYY'].map((format) => (
                        <label 
                          key={format}
                          className={`
                            flex items-center p-4 border rounded-xl cursor-pointer transition-all
                            ${localCoreSettings.dateFormat === format 
                              ? 'border-indigo-500 dark:border-primary-500 bg-indigo-50 dark:bg-primary-900/20 ring-2 ring-indigo-100 dark:ring-primary-900/30' 
                              : 'border-gray-200 dark:border-[var(--color-border)] hover:border-gray-300 hover:bg-gray-50 dark:hover:bg-[var(--color-bg-secondary)]'}
                          `}
                        >
                          <input
                            type="radio"
                            className="sr-only"
                            checked={localCoreSettings.dateFormat === format}
                            onChange={() => setLocalCoreSettings({ ...localCoreSettings, dateFormat: format })}
                          />
                          <div className="flex flex-col">
                            <span className="font-bold text-gray-900 dark:text-[var(--color-text-primary)]">{format}</span>
                            <span className="text-xs text-gray-500 dark:text-[var(--color-text-secondary)]">
                              Example: {(() => {
                                const d = new Date();
                                const day = String(d.getDate()).padStart(2, '0');
                                const month = String(d.getMonth() + 1).padStart(2, '0');
                                const year = String(d.getFullYear());
                                if (format === 'DD/MM/YYYY') return `${day}/${month}/${year}`;
                                if (format === 'YYYY-MM-DD') return `${year}-${month}-${day}`;
                                if (format === 'MM/DD/YYYY') return `${month}/${day}/${year}`;
                                if (format === 'DD.MM.YYYY') return `${day}.${month}.${year}`;
                                return format;
                              })()}
                            </span>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* UI Mode */}
                  <div className="bg-white dark:bg-[var(--color-bg-tertiary)] border border-gray-200 dark:border-[var(--color-border)] rounded-xl p-6 shadow-sm">
                    <label className="flex items-center gap-2 font-semibold text-gray-900 dark:text-[var(--color-text-primary)] mb-2">
                      <Layout size={20} className="text-purple-500" />
                      {t('settings.general.uiMode')}
                    </label>
                    <p className="text-sm text-gray-500 dark:text-[var(--color-text-secondary)] mb-4">
                      {t('settings.general.uiModeDesc')}
                    </p>
                    <div className="flex gap-4">
                      <button
                        onClick={() => setLocalCoreSettings({ ...localCoreSettings, uiMode: 'classic' })}
                        className={`flex-1 p-5 border rounded-2xl text-left transition-all ${
                          localCoreSettings.uiMode === 'classic' 
                          ? 'border-indigo-600 dark:border-primary-500 bg-indigo-50 dark:bg-primary-900/20 ring-2 ring-indigo-200 dark:ring-primary-900/30' 
                          : 'border-gray-200 dark:border-[var(--color-border)] hover:bg-gray-50 dark:hover:bg-[var(--color-bg-secondary)]'
                        }`}
                      >
                        <div className="font-bold text-gray-900 dark:text-[var(--color-text-primary)]">{t('settings.general.classic')}</div>
                        <div className="text-xs text-gray-500 dark:text-[var(--color-text-secondary)]">{t('settings.general.classicDesc')}</div>
                      </button>
                      <button
                        onClick={() => setLocalCoreSettings({ ...localCoreSettings, uiMode: 'windows' })}
                        className={`flex-1 p-5 border rounded-2xl text-left transition-all ${
                          localCoreSettings.uiMode === 'windows' 
                          ? 'border-indigo-600 dark:border-primary-500 bg-indigo-50 dark:bg-primary-900/20 ring-2 ring-indigo-200 dark:ring-primary-900/30' 
                          : 'border-gray-200 dark:border-[var(--color-border)] hover:bg-gray-50 dark:hover:bg-[var(--color-bg-secondary)]'
                        }`}
                      >
                        <div className="font-bold text-gray-900 dark:text-[var(--color-text-primary)]">{t('settings.general.windows')}</div>
                        <div className="text-xs text-gray-500 dark:text-[var(--color-text-secondary)]">{t('settings.general.windowsDesc')}</div>
                      </button>
                    </div>
                    </div>
                  </div>
                </div>
              )}

                  {/* Currencies Tab */}
                  {(activeTab as string) === 'currencies' && (
                    <div className="max-w-6xl mx-auto space-y-8">
                      <SectionHeader 
                        title={t('settings.tabs.currencies')} 
                        description={t('settings.currencies.description')}
                        onSave={() => handleSave('currencies')}
                        disabled={saving} // Currencies handled internally by CompanyCurrencySettings components
                        saving={saving}
                      />
                      <CompanyCurrencySettings />
                    </div>
                  )}

                  {/* Policy Configuration Tab (Merged: Approval & Posting) */}
                  {(activeTab as string) === 'policies' && (
                    <div className="w-full space-y-8">
                      <SectionHeader 
                        title={t('settings.tabs.policies')} 
                        description={t('settings.policies.description')}
                        onSave={() => handleSave('policies')}
                        disabled={!hasPolicyChanges || saving}
                        saving={saving}
                      />

                {/* Approval Gates Section */}
                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border border-indigo-200 dark:border-indigo-800/50 rounded-xl p-6 shadow-sm">
                  <h3 className="flex items-center gap-2 font-bold text-gray-900 dark:text-[var(--color-text-primary)] mb-4">
                    <Shield size={20} className="text-indigo-600 dark:text-indigo-400" />
                    {t('settings.policies.approvalGates')}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-[var(--color-text-secondary)] mb-6">
                    {t('settings.policies.approvalDesc')}
                  </p>
                  
                  <div className="flex flex-col gap-6">
                    {/* Financial Approval Toggle */}
                    <div className="bg-white/70 dark:bg-[var(--color-bg-tertiary)] rounded-xl p-5 border border-indigo-100 dark:border-[var(--color-border)] shadow-sm">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <label className="font-semibold text-gray-800 dark:text-[var(--color-text-primary)]">{t('settings.policies.financialApproval')}</label>
                            <div className="group relative">
                              <Info size={14} className="text-gray-400 hover:text-indigo-600 cursor-help" />
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-gray-800 text-white text-xs rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 pointer-events-none text-center">
                                {t('settings.policies.financialApprovalHelp')}
                                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
                              </div>
                            </div>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-[var(--color-text-secondary)] mt-1">
                            {t('settings.policies.financialApprovalHint')}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-4">
                          <span className={`text-xs font-bold uppercase tracking-wider ${config.financialApprovalEnabled ? 'text-indigo-600' : 'text-gray-400'}`}>
                            {config.financialApprovalEnabled ? t('settings.on') : t('settings.off')}
                          </span>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              className="sr-only peer"
                              checked={config.financialApprovalEnabled}
                              onChange={(e) => setConfig({ 
                                ...config, 
                                financialApprovalEnabled: e.target.checked,
                                approvalRequired: e.target.checked  // Legacy sync
                              })}
                            />
                            <div className={`relative w-12 h-6 rounded-full transition-colors ${config.financialApprovalEnabled ? 'bg-indigo-600' : 'bg-gray-200'}`}>
                              <div className={`absolute top-[2px] left-[2px] w-5 h-5 bg-white rounded-full shadow-md transition-transform ${config.financialApprovalEnabled ? 'translate-x-6' : 'translate-x-0'}`}></div>
                            </div>
                          </label>
                        </div>
                      </div>
                      
                      {config.financialApprovalEnabled && (
                        <div className="mt-4 pt-4 border-t border-indigo-100">
                          <label className="text-xs font-semibold text-gray-700 mb-2 block">{t('settings.policies.applyTo')}</label>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setConfig({ ...config, faApplyMode: 'ALL' })}
                              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                                config.faApplyMode === 'ALL' 
                                  ? 'bg-indigo-600 text-white' 
                                  : 'bg-gray-100 dark:bg-[var(--color-bg-secondary)] text-gray-600 dark:text-[var(--color-text-secondary)] hover:bg-gray-200 dark:hover:bg-[var(--color-bg-tertiary)]'
                              }`}
                            >
                              {t('settings.policies.applyAll')}
                            </button>
                            <button
                              onClick={() => setConfig({ ...config, faApplyMode: 'MARKED_ONLY' })}
                              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                                config.faApplyMode === 'MARKED_ONLY' 
                                  ? 'bg-indigo-600 text-white' 
                                  : 'bg-gray-100 dark:bg-[var(--color-bg-secondary)] text-gray-600 dark:text-[var(--color-text-secondary)] hover:bg-gray-200 dark:hover:bg-[var(--color-bg-tertiary)]'
                              }`}
                            >
                              {t('settings.policies.applyMarked')}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Custody Confirmation Toggle */}
                    <div className="bg-white/70 dark:bg-[var(--color-bg-tertiary)] rounded-xl p-5 border border-indigo-100 dark:border-[var(--color-border)] shadow-sm">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <label className="font-semibold text-gray-800 dark:text-[var(--color-text-primary)]">{t('settings.policies.custody')}</label>
                            <div className="group relative">
                              <Info size={14} className="text-gray-400 hover:text-purple-600 cursor-help" />
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-gray-800 text-white text-xs rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 pointer-events-none text-center">
                                {t('settings.policies.custodyHelp')}
                                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
                              </div>
                            </div>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-[var(--color-text-secondary)] mt-1">
                            {t('settings.policies.custodyHint')}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-4">
                          <span className={`text-xs font-bold uppercase tracking-wider ${config.custodyConfirmationEnabled ? 'text-purple-600' : 'text-gray-400'}`}>
                            {config.custodyConfirmationEnabled ? t('settings.on') : t('settings.off')}
                          </span>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              className="sr-only peer"
                              checked={config.custodyConfirmationEnabled}
                              onChange={(e) => setConfig({ ...config, custodyConfirmationEnabled: e.target.checked })}
                            />
                            <div className={`relative w-12 h-6 rounded-full transition-colors ${config.custodyConfirmationEnabled ? 'bg-purple-600' : 'bg-gray-200'}`}>
                              <div className={`absolute top-[2px] left-[2px] w-5 h-5 bg-white rounded-full shadow-md transition-transform ${config.custodyConfirmationEnabled ? 'translate-x-6' : 'translate-x-0'}`}></div>
                            </div>
                          </label>
                        </div>
                      </div>
                      
                      {/* Smart CC Settings - Horizontal Row */}
                      {config.custodyConfirmationEnabled && (
                        <div className="mt-5 pt-5 border-t border-gray-100 dark:border-gray-700/50">
                          <p className="text-[10px] text-purple-600 dark:text-purple-400 font-bold uppercase tracking-wider mb-3">{t('settings.policies.smartConfig')}</p>
                          
                          <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start">
                             
                             {/* 1. Third Party Mode */}
                             <div className="xl:col-span-1">
                               <div className="flex items-center gap-1.5 mb-2">
                                 <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">{t('settings.policies.thirdParty')}</label>
                                 <div className="group relative">
                                   <Info size={12} className="text-gray-400 hover:text-purple-600 cursor-help" />
                                   <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-gray-800 text-white text-xs rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 pointer-events-none">
                                     {t('settings.policies.thirdPartyHelp')}
                                   </div>
                                 </div>
                               </div>
                               <div className="flex flex-col gap-1.5">
                                 <button
                                   onClick={() => setConfig({ ...config, ccThirdPartyMode: 'RECEIVER_ONLY' })}
                                   className={`w-full px-3 py-1.5 text-xs font-medium rounded-md transition-all text-left flex items-center justify-between group ${
                                     (config.ccThirdPartyMode || 'RECEIVER_ONLY') === 'RECEIVER_ONLY'
                                       ? 'bg-purple-50 text-purple-700 ring-1 ring-purple-600 py-2'
                                       : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                                   }`}
                                 >
                                   <span>{t('settings.policies.receiverOnly')}</span>
                                   {(config.ccThirdPartyMode || 'RECEIVER_ONLY') === 'RECEIVER_ONLY' && <CheckCircle2 size={12} className="text-purple-600" />}
                                 </button>
                                 <button
                                   onClick={() => setConfig({ ...config, ccThirdPartyMode: 'BOTH' })}
                                   className={`w-full px-3 py-1.5 text-xs font-medium rounded-md transition-all text-left flex items-center justify-between group ${
                                     config.ccThirdPartyMode === 'BOTH'
                                       ? 'bg-purple-50 text-purple-700 ring-1 ring-purple-600 py-2'
                                       : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                                   }`}
                                 >
                                   <span>{t('settings.policies.bothParties')}</span>
                                   {config.ccThirdPartyMode === 'BOTH' && <CheckCircle2 size={12} className="text-purple-600" />}
                                 </button>
                               </div>
                             </div>

                             {/* 2. Reversal Mode */}
                             <div className="xl:col-span-1">
                               <div className="flex items-center gap-1.5 mb-2">
                                 <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">{t('settings.policies.reversalLogic')}</label>
                                 <div className="group relative">
                                   <Info size={12} className="text-gray-400 hover:text-purple-600 cursor-help" />
                                   <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-gray-800 text-white text-xs rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 pointer-events-none">
                                     {t('settings.policies.reversalHelp')}
                                   </div>
                                 </div>
                               </div>
                               <div className="flex flex-col gap-1.5">
                                 <button
                                   onClick={() => setConfig({ ...config, ccReversalMode: 'SAME_AS_ORIGINAL' })}
                                   className={`w-full px-3 py-1.5 text-xs font-medium rounded-md transition-all text-left flex items-center justify-between group ${
                                     (config.ccReversalMode || 'SAME_AS_ORIGINAL') === 'SAME_AS_ORIGINAL'
                                       ? 'bg-purple-50 text-purple-700 ring-1 ring-purple-600 py-2'
                                       : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                                   }`}
                                 >
                                   <span>{t('settings.policies.matchOriginal')}</span>
                                   {(config.ccReversalMode || 'SAME_AS_ORIGINAL') === 'SAME_AS_ORIGINAL' && <CheckCircle2 size={12} className="text-purple-600" />}
                                 </button>
                                 <button
                                   onClick={() => setConfig({ ...config, ccReversalMode: 'AUTO_APPROVE' })}
                                   className={`w-full px-3 py-1.5 text-xs font-medium rounded-md transition-all text-left flex items-center justify-between group ${
                                     config.ccReversalMode === 'AUTO_APPROVE'
                                       ? 'bg-purple-50 text-purple-700 ring-1 ring-purple-600 py-2'
                                       : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                                   }`}
                                 >
                                   <span>{t('settings.policies.autoApprove')}</span>
                                   {config.ccReversalMode === 'AUTO_APPROVE' && <CheckCircle2 size={12} className="text-purple-600" />}
                                 </button>
                               </div>
                             </div>

                             {/* 3. Self Confirm */}
                             <div className="xl:col-span-1">
                               <div className="flex items-center gap-1.5 mb-2">
                                 <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">{t('settings.policies.selfConfirm')}</label>
                                 <div className="group relative">
                                   <Info size={12} className="text-gray-400 hover:text-purple-600 cursor-help" />
                                   <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-gray-800 text-white text-xs rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 pointer-events-none">
                                     {t('settings.policies.selfConfirmHelp')}
                                   </div>
                                 </div>
                               </div>
                               <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50/50">
                                  <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                      type="checkbox"
                                      className="sr-only peer"
                                      checked={config.ccAllowSelfConfirmation || false}
                                      onChange={(e) => setConfig({ ...config, ccAllowSelfConfirmation: e.target.checked })}
                                    />
                                    <div className="relative w-9 h-5 rounded-full bg-gray-200 dark:bg-gray-600 peer-checked:bg-purple-600 transition-colors">
                                      <div className={`absolute top-[2px] left-[2px] w-4 h-4 bg-white rounded-full shadow transition-transform ${config.ccAllowSelfConfirmation ? 'translate-x-4' : 'translate-x-0'}`}></div>
                                    </div>
                                  </label>
                                  <span className="text-[10px] text-gray-500 leading-tight">{t('settings.policies.selfConfirmHint')}</span>
                               </div>
                             </div>

                             {/* 4. Block Missing */}
                             <div className="xl:col-span-1">
                               <div className="flex items-center gap-1.5 mb-2">
                                 <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">{t('settings.policies.blockMissing')}</label>
                                 <div className="group relative">
                                   <Info size={12} className="text-gray-400 hover:text-purple-600 cursor-help" />
                                   <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-gray-800 text-white text-xs rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 pointer-events-none">
                                     {t('settings.policies.blockMissingHelp')}
                                   </div>
                                 </div>
                               </div>
                               <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50/50">
                                  <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                      type="checkbox"
                                      className="sr-only peer"
                                      checked={config.ccBlockIfNoCustodian ?? true}
                                      onChange={(e) => setConfig({ ...config, ccBlockIfNoCustodian: e.target.checked })}
                                    />
                                    <div className="relative w-9 h-5 rounded-full bg-gray-200 dark:bg-gray-600 peer-checked:bg-purple-600 transition-colors">
                                      <div className={`absolute top-[2px] left-[2px] w-4 h-4 bg-white rounded-full shadow transition-transform ${(config.ccBlockIfNoCustodian ?? true) ? 'translate-x-4' : 'translate-x-0'}`}></div>
                                    </div>
                                  </label>
                                  <span className="text-[10px] text-gray-500 leading-tight">{t('settings.policies.blockMissingHint')}</span>
                               </div>
                             </div>

                          </div>
                        </div>
                      )}
                    </div>

                    {/* Voucher Amount Threshold (Extracted) */}
                    <div className="bg-white/70 dark:bg-[var(--color-bg-tertiary)] rounded-xl p-5 border border-indigo-100 dark:border-[var(--color-border)] shadow-sm">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <label className="font-semibold text-gray-800 dark:text-[var(--color-text-primary)]">{t('settings.policies.amountThreshold')}</label>
                            <div className="group relative">
                              <Info size={14} className="text-gray-400 hover:text-indigo-600 cursor-help" />
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-gray-800 text-white text-xs rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 pointer-events-none text-center">
                                {t('settings.policies.amountThresholdHelp')}
                                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
                              </div>
                            </div>
                            
                            {/* Toggle Switch */}
                            <div className="flex items-center gap-2">
                                <label className="relative inline-flex items-center cursor-pointer">
                                  <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={!!config.ccAmountThreshold}
                                    onChange={(e) => {
                                       if (e.target.checked) {
                                          setConfig({ ...config, ccAmountThreshold: 100 });
                                       } else {
                                          setConfig({ ...config, ccAmountThreshold: 0 });
                                       }
                                    }}
                                  />
                                  <div className={`relative w-9 h-5 rounded-full transition-colors ${config.ccAmountThreshold ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-600'}`}>
                                    <div className={`absolute top-[2px] left-[2px] w-4 h-4 bg-white rounded-full shadow transition-transform ${config.ccAmountThreshold ? 'translate-x-4' : 'translate-x-0'}`}></div>
                                  </div>
                                </label>
                                <span className={`text-[10px] font-bold uppercase tracking-wider ${config.ccAmountThreshold ? 'text-indigo-600' : 'text-gray-400'}`}>
                                  {config.ccAmountThreshold ? t('settings.on') : t('settings.off')}
                                </span>
                            </div>
                          </div>
                          
                          <p className="text-xs text-gray-500 dark:text-[var(--color-text-secondary)] mt-1">
                            {config.ccAmountThreshold 
                              ? t('settings.policies.amountThresholdOn')
                              : t('settings.policies.amountThresholdOff')}
                          </p>
                        </div>
                        
                        {/* Dynamic Input (Always Visible, Disabled if OFF) */}
                        <div className={`flex items-center gap-2 shrink-0 ml-4 border-b-2 px-2 py-1 transition-all ${
                          config.ccAmountThreshold 
                            ? 'border-indigo-100 dark:border-indigo-900/50 opacity-100' 
                            : 'border-gray-100 dark:border-gray-800 opacity-50'
                        }`}>
                           <span className={`text-xs font-semibold uppercase ${
                             config.ccAmountThreshold ? 'text-gray-400' : 'text-gray-300'
                           }`}>
                               {coreSettings?.baseCurrency || 'USD'}
                           </span>
                           <input
                             type="number"
                             min="0"
                             value={config.ccAmountThreshold || 0}
                             disabled={!config.ccAmountThreshold}
                             onChange={(e) => setConfig({ ...config, ccAmountThreshold: Number(e.target.value) })}
                             className={`w-24 text-base font-bold bg-transparent border-none focus:ring-0 p-0 text-right ${
                               config.ccAmountThreshold 
                                ? 'text-gray-900 dark:text-gray-100' 
                                : 'text-gray-400 dark:text-gray-500 cursor-not-allowed'
                             }`}
                           />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Mode Indicator */}
                  <div className={`mt-4 p-3 rounded-lg text-xs font-medium flex items-center gap-2 ${
                    isModeA 
                      ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50'
                      : 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/50'
                  }`}>
                    <div className={`w-2 h-2 rounded-full ${isModeA ? 'bg-emerald-500' : 'bg-indigo-500'}`}></div>
                    {isModeA 
                      ? 'Flexible Posting Mode — Fast-track posting without approval gates' 
                      : 'Strict Approval Mode — Audit-compliant workflow with permanent lock'
                    }
                  </div>

                  {/* Posting Behavior Section - Always Visible */}
                  <div className="mt-6 pt-6 border-t border-indigo-100 dark:border-[var(--color-border)]">
                    <h4 className="flex items-center gap-2 font-semibold text-gray-800 dark:text-[var(--color-text-primary)] mb-4">
                      {isModeA ? (
                        <Settings size={18} className="text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <Shield size={18} className="text-indigo-600 dark:text-indigo-400" />
                      )}
                      Posting Behavior
                    </h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Auto-Post Toggle */}
                      <div className={`flex items-center justify-between p-4 rounded-lg border transition-all ${
                        isModeA ? 'bg-white/70 dark:bg-[var(--color-bg-tertiary)] border-emerald-100 dark:border-emerald-800/30' : 'bg-gray-50/50 dark:bg-[var(--color-bg-tertiary)] border-gray-100 dark:border-[var(--color-border)]'
                      }`}>
                        <div className="flex-1">
                          <label className="font-medium text-gray-800 dark:text-[var(--color-text-primary)] text-sm">Auto-Post When Approved</label>
                          <p className="text-xs text-gray-500 dark:text-[var(--color-text-secondary)] mt-0.5">
                            {isModeA 
                              ? 'Post to ledger automatically upon submission' 
                              : 'System automatically posts vouchers only after all approval gates are cleared'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-4">
                          <span className={`text-xs font-bold uppercase tracking-wider ${
                            config.autoPostEnabled ? (isModeA ? 'text-emerald-600' : 'text-indigo-600') : 'text-gray-400'
                          }`}>
                            {config.autoPostEnabled ? 'ON' : 'OFF'}
                          </span>
                          <label className={`relative inline-flex items-center ${isModeA ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}>
                            <input
                              type="checkbox"
                              className="sr-only peer"
                              checked={config.autoPostEnabled ?? true}
                              disabled={!isModeA}
                              onChange={(e) => setConfig({ ...config, autoPostEnabled: e.target.checked })}
                            />
                            <div className={`relative w-12 h-6 rounded-full transition-colors ${
                              config.autoPostEnabled 
                                ? (isModeA ? 'bg-emerald-500' : 'bg-indigo-600') 
                                : 'bg-gray-200'
                            }`}>
                              <div className={`absolute top-[2px] left-[2px] w-5 h-5 bg-white rounded-full shadow-md transition-transform ${config.autoPostEnabled ? 'translate-x-6' : 'translate-x-0'}`}></div>
                            </div>
                          </label>
                        </div>
                      </div>

                      {/* Allow Edit Posted Toggle - Always Visible, Disabled in Strict Mode */}
                        <div className={`flex items-center justify-between p-4 bg-white/70 dark:bg-[var(--color-bg-tertiary)] rounded-lg border transition-all ${
                          isModeA 
                            ? 'border-amber-100 dark:border-amber-800/30' 
                            : 'border-gray-200 dark:border-[var(--color-border)] opacity-60'
                        }`}>
                          <div className="flex-1">
                            <label className={`font-medium text-sm flex items-center gap-2 ${isModeA ? 'text-gray-800 dark:text-[var(--color-text-primary)]' : 'text-gray-500 dark:text-[var(--color-text-muted)]'}`}>
                              Allow Edit/Delete Posted
                              {!isModeA && <Lock size={14} className="text-gray-400" />}
                            </label>
                            <p className={`text-xs mt-0.5 ${isModeA ? 'text-gray-500 dark:text-[var(--color-text-secondary)]' : 'text-gray-400 dark:text-[var(--color-text-muted)]'}`}>
                              {isModeA 
                                ? 'Edit or delete posted vouchers (modifies/removes ledger entries)'
                                : 'Not available in Strict Mode — posted vouchers are immutable'}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 ml-4">
                            <span className={`text-xs font-bold uppercase tracking-wider ${
                              !isModeA 
                                ? 'text-gray-400 dark:text-[var(--color-text-muted)]'
                                : config.allowEditDeletePosted
                                  ? 'text-amber-600 dark:text-amber-500' 
                                  : 'text-gray-400 dark:text-[var(--color-text-muted)]'
                            }`}>
                              {config.allowEditDeletePosted ? 'ON' : 'OFF'}
                            </span>
                            <label className={`relative inline-flex items-center ${isModeA ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
                              <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={config.allowEditDeletePosted ?? false}
                                disabled={!isModeA}
                                onChange={(e) => setConfig({ ...config, allowEditDeletePosted: e.target.checked })}
                              />
                              <div className={`relative w-12 h-6 rounded-full transition-colors ${
                                !isModeA 
                                  ? 'bg-gray-300 dark:bg-gray-600'
                                  : config.allowEditDeletePosted 
                                    ? 'bg-amber-500' 
                                    : 'bg-gray-200 dark:bg-gray-700'
                              }`}>
                                <div className={`absolute top-[2px] left-[2px] w-5 h-5 bg-white rounded-full shadow-md transition-transform ${config.allowEditDeletePosted && isModeA ? 'translate-x-6' : 'translate-x-0'}`}></div>
                              </div>
                            </label>
                          </div>
                        </div>
                    </div>

                    {/* Mode-Specific Message */}
                    {isModeA && config.allowEditDeletePosted ? (
                      /* Flexible Mode + Allow Edit ON: Show caution */
                      <div className="mt-3 flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-lg">
                        <AlertTriangle size={14} className="text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-800 dark:text-amber-300">
                          <strong>Caution:</strong> Editing posted vouchers modifies ledger entries. Consider using reversals for better audit trail.
                        </p>
                      </div>
                    ) : !isModeA ? (
                      /* Strict Mode: Show info about immutability */
                      <div className="mt-3 flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-lg">
                        <Shield size={14} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                        <p className="text-xs text-blue-800 dark:text-blue-300">
                          <strong>Strict Mode Active:</strong> Posted vouchers are immutable and cannot be edited or deleted. To correct a financial effect, create a <strong>Reversal Voucher</strong> that posts offsetting entries.
                        </p>
                      </div>
                    ) : null}
              </div>
              

            </div>
          </div>
        )}

            {/* Payment Methods Tab */}
            {(activeTab as string) === 'payment-methods' && (
              <div className="max-w-4xl mx-auto space-y-8">
                <SectionHeader 
                  title="Payment Methods" 
                  description="Define and manage payment methods used across vouchers"
                  onSave={() => handleSave('payment-methods')}
                  disabled={!hasMethodChanges || saving}
                  saving={saving}
                />

                <div className="bg-white dark:bg-[var(--color-bg-tertiary)] border border-gray-200 dark:border-[var(--color-border)] rounded-xl overflow-hidden shadow-sm">
                  <div className="p-6 border-b border-gray-200 dark:border-[var(--color-border)] bg-gray-50/50 dark:bg-[var(--color-bg-tertiary)] flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-gray-900 dark:text-[var(--color-text-primary)]">Configured Methods</h3>
                      <p className="text-xs text-gray-500 mt-1">Status of payment options in voucher forms</p>
                    </div>
                    <button 
                      onClick={() => {
                        const newId = `method_${Date.now()}`;
                        const updated = [...(config.paymentMethods || []), { id: newId, name: 'New Payment Method', isEnabled: true }];
                        setConfig({ ...config, paymentMethods: updated });
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors shadow-sm"
                    >
                      <Plus size={14} />
                      Add Method
                    </button>
                  </div>

                  <div className="divide-y divide-gray-100 dark:divide-[var(--color-border)]">
                    {(!config.paymentMethods || config.paymentMethods.length === 0) ? (
                      <div className="p-12 text-center text-gray-500 text-sm italic">
                        No payment methods defined. Click 'Add Method' to get started.
                      </div>
                    ) : (
                      config.paymentMethods.map((pm, index) => (
                        <div key={pm.id} className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-[var(--color-bg-secondary)] transition-colors group">
                          <div className="flex items-center gap-4 flex-1 mr-4">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${pm.isEnabled ? 'bg-indigo-100 dark:bg-indigo-900/30' : 'bg-gray-100 dark:bg-[var(--color-bg-secondary)]'}`}>
                              <CreditCard size={18} className={pm.isEnabled ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'} />
                            </div>
                            <div className="flex-1">
                              <input 
                                type="text"
                                className={`w-full bg-transparent border-none focus:ring-0 font-bold p-0 ${pm.isEnabled ? 'text-gray-900 dark:text-[var(--color-text-primary)]' : 'text-gray-400'}`}
                                value={pm.name}
                                onChange={(e) => {
                                  const updated = [...(config.paymentMethods || [])];
                                  updated[index] = { ...pm, name: e.target.value };
                                  setConfig({ ...config, paymentMethods: updated });
                                }}
                              />
                              <p className="text-[10px] text-gray-400 font-mono mt-0.5">{pm.id}</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] font-bold uppercase tracking-wider ${pm.isEnabled ? 'text-emerald-600' : 'text-gray-400'}`}>
                                {pm.isEnabled ? 'Enabled' : 'Disabled'}
                              </span>
                              <label className="relative inline-flex items-center cursor-pointer scale-90">
                                <input
                                  type="checkbox"
                                  className="sr-only peer"
                                  checked={pm.isEnabled}
                                  onChange={(e) => {
                                    const updated = [...(config.paymentMethods || [])];
                                    updated[index] = { ...pm, isEnabled: e.target.checked };
                                    setConfig({ ...config, paymentMethods: updated });
                                  }}
                                />
                                <div className={`relative w-10 h-5 rounded-full transition-colors ${pm.isEnabled ? 'bg-emerald-500' : 'bg-gray-200 dark:bg-gray-700'}`}>
                                  <div className={`absolute top-[2px] left-[2px] w-4 h-4 bg-white rounded-full shadow transition-transform ${pm.isEnabled ? 'translate-x-5' : 'translate-x-0'}`}></div>
                                </div>
                              </label>
                            </div>
                            <button 
                              onClick={() => {
                                const updated = (config.paymentMethods || []).filter(item => item.id !== pm.id);
                                setConfig({ ...config, paymentMethods: updated });
                              }}
                              className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-all opacity-0 group-hover:opacity-100"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>


                <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50 rounded-xl">
                  <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-800/30 flex items-center justify-center shrink-0">
                    <Layout size={16} className="text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-blue-900 dark:text-blue-300">Form Integration</h4>
                    <p className="text-xs text-blue-800 dark:text-blue-400 mt-1 leading-relaxed">
                      Payment methods defined here will automatically populate the dropdowns in the Voucher Editor. 
                      Disabled methods will be hidden from the selector but preserved in existing records.
                    </p>
                  </div>
                </div>
              </div>
              )}


            {/* Cost Center Required Tab */}
            {(activeTab as string) === 'cost-center' && (
              <div className="max-w-4xl mx-auto space-y-8">
                <SectionHeader 
                  title={t('settings.tabs.costCenter')} 
                  description={t('settings.costCenter.description')}
                  onSave={() => handleSave('cost-center')}
                  disabled={!hasCostCenterChanges || saving}
                  saving={saving}
                />

                <div className="bg-white dark:bg-[var(--color-bg-tertiary)] border border-gray-200 dark:border-[var(--color-border)] rounded-xl p-6 shadow-sm">
                  <div className="flex items-start gap-6 mb-4">
                    <div className="flex-1">
                      <label className="flex items-center gap-2 font-bold text-gray-900 dark:text-[var(--color-text-primary)]">
                        <DollarSign size={20} className="text-purple-500" />
                        {t('settings.costCenter.title')}
                      </label>
                      <p className="text-sm text-gray-500 dark:text-[var(--color-text-secondary)] mt-1">
                        {t('settings.costCenter.subtitle')}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`text-xs font-bold uppercase tracking-wider ${config.costCenterPolicy.enabled ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 dark:text-[var(--color-text-muted)]'}`}>
                        {config.costCenterPolicy.enabled ? t('settings.on') : t('settings.off')}
                      </span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={config.costCenterPolicy.enabled}
                          onChange={(e) => setConfig({
                            ...config,
                            costCenterPolicy: {
                              ...config.costCenterPolicy,
                              enabled: e.target.checked
                            }
                          })}
                        />
                        <div className="relative w-12 h-6 bg-gray-200 dark:bg-gray-700 rounded-full transition-colors peer-checked:bg-indigo-600">
                          <div className={`absolute top-[2px] left-[2px] w-5 h-5 bg-white rounded-full shadow-md transition-transform ${config.costCenterPolicy.enabled ? 'translate-x-6' : 'translate-x-0'}`}></div>
                        </div>
                      </label>
                    </div>
                  </div>
                  
                  {config.costCenterPolicy.enabled && (
                    <div className="mt-6 pt-6 border-t border-gray-100">
                      <p className="text-sm font-semibold text-gray-900 mb-4">{t('settings.costCenter.requiredFor')}</p>
                      <div className="grid grid-cols-2 gap-4">
                        {['EXPENSE', 'ASSET', 'LIABILITY', 'REVENUE'].map((type) => (
                          <label key={type} className="flex items-center p-3 border border-gray-100 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors">
                            <input
                              type="checkbox"
                              className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                              checked={config.costCenterPolicy.requiredFor.accountTypes?.includes(type)}
                              onChange={(e) => {
                                const current = config.costCenterPolicy.requiredFor.accountTypes || [];
                                const updated = e.target.checked
                                  ? [...current, type]
                                  : current.filter((t: string) => t !== type);
                                setConfig({
                                  ...config,
                                  costCenterPolicy: {
                                    ...config.costCenterPolicy,
                                    requiredFor: {
                                      ...config.costCenterPolicy.requiredFor,
                                      accountTypes: updated
                                    }
                                  }
                                });
                              }}
                            />
                            <span className="ml-3 text-sm font-medium text-gray-700 dark:text-[var(--color-text-secondary)]">{type}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Cost Centers Manage Tab */}
            {(activeTab as string) === 'cost-centers-manage' && (
                <div className="w-full min-h-[600px] border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden bg-white dark:bg-gray-900">
                   <CostCentersPage />
                </div>
            )}

            {/* Policy Error Mode Tab */}
            {(activeTab as string) === 'error-mode' && (
              <div className="max-w-4xl mx-auto space-y-8">
                <SectionHeader 
                  title={t('settings.errorMode.title')} 
                  description={t('settings.errorMode.description')}
                  onSave={() => handleSave('error-mode')}
                  disabled={!hasErrorModeChanges || saving}
                  saving={saving}
                />

                <div className="bg-white dark:bg-[var(--color-bg-tertiary)] border border-gray-200 dark:border-[var(--color-border)] rounded-xl p-6 shadow-sm">
                  <div className="flex items-center gap-2 font-bold text-gray-900 dark:text-[var(--color-text-primary)] mb-2">
                    <AlertTriangle size={20} className="text-amber-500" />
                    {t('settings.errorMode.validationBehavior')}
                  </div>
                  <p className="text-sm text-gray-500 dark:text-[var(--color-text-secondary)] mb-6">
                    {t('settings.errorMode.validationDesc')}
                  </p>
                  <div className="space-y-4">
                    <label className={`
                      flex items-start p-4 border rounded-xl cursor-pointer transition-all
                      ${config.policyErrorMode === 'FAIL_FAST' ? 'border-indigo-500 dark:border-primary-500 bg-indigo-50 dark:bg-primary-900/20 ring-2 ring-indigo-100 dark:ring-primary-900/30' : 'border-gray-200 dark:border-[var(--color-border)] hover:bg-gray-50 dark:hover:bg-[var(--color-bg-secondary)]'}
                    `}>
                      <input
                        type="radio"
                        className="sr-only"
                        checked={config.policyErrorMode === 'FAIL_FAST'}
                        onChange={() => setConfig({ ...config, policyErrorMode: 'FAIL_FAST' })}
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-gray-900">{t('settings.errorMode.failFast')}</span>
                          {config.policyErrorMode === 'FAIL_FAST' && <span className="text-[10px] bg-indigo-600 text-white px-2 py-0.5 rounded-full font-bold uppercase">{t('settings.errorMode.recommended')}</span>}
                        </div>
                        <p className="text-xs text-gray-600 leading-relaxed">
                          {t('settings.errorMode.failFastDesc')}
                        </p>
                      </div>
                    </label>

                    <label className={`
                      flex items-start p-4 border rounded-xl cursor-pointer transition-all
                      ${config.policyErrorMode === 'AGGREGATE' ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-100' : 'border-gray-200 hover:bg-gray-50'}
                    `}>
                      <input
                        type="radio"
                        className="sr-only"
                        checked={config.policyErrorMode === 'AGGREGATE'}
                        onChange={() => setConfig({ ...config, policyErrorMode: 'AGGREGATE' })}
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-gray-900">{t('settings.errorMode.aggregate')}</span>
                        </div>
                        <p className="text-xs text-gray-600 leading-relaxed">
                          {t('settings.errorMode.aggregateDesc')}
                        </p>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Fiscal Year Tab */}
            {(activeTab as string) === 'fiscal' && (
              <>
              <div className="max-w-4xl mx-auto space-y-8">
                <SectionHeader 
                  title={t('settings.fiscal.title')} 
                  description={t('settings.fiscal.description')}
                  onSave={() => handleSave('fiscal')}
                  disabled={!hasFiscalChanges || saving}
                  saving={saving}
                />
                  
                {fiscalYears.length === 0 && (
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-xl p-4 flex items-start gap-3">
                    <AlertTriangle className="text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" size={20} />
                    <div>
                      <h4 className="font-bold text-amber-900 dark:text-amber-300 text-sm">No Active Accounting Periods</h4>
                      <p className="text-amber-800 dark:text-amber-400 text-xs mt-1">
                        Accounting periods are automatically generated when you define a Fiscal Year. 
                        Please create a Fiscal Year below to initialize your reporting periods (e.g., Monthly, Quarterly).
                      </p>
                    </div>
                  </div>
                )}
                  
                {/* Period Locking Card */}
                <div className={`bg-white dark:bg-[var(--color-bg-tertiary)] border rounded-2xl p-6 shadow-sm transition-all duration-300 ${
                  config.periodLockEnabled 
                    ? (!config.lockedThroughDate ? 'border-red-400 ring-4 ring-red-500/10 dark:border-red-900/40' : 'border-indigo-200 ring-4 ring-indigo-500/5 dark:border-indigo-900/40') 
                    : 'border-gray-200 dark:border-[var(--color-border)]'
                }`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-gray-900 dark:text-[var(--color-text-primary)]">
                          {t('settings.fiscal.periodLocking')}
                        </h3>
                        <div className="group relative">
                           <Info size={14} className="text-gray-400 cursor-help" />
                           <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2 bg-gray-900 text-white text-[10px] rounded shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 text-center">
                              {t('settings.fiscal.periodLockingHelp')}
                           </div>
                        </div>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-[var(--color-text-secondary)]">
                        {t('settings.fiscal.periodLockingHint')}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-4">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                        config.periodLockEnabled 
                          ? (!config.lockedThroughDate ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300') 
                          : 'bg-gray-100 text-gray-500 dark:bg-gray-800'
                      }`}>
                        {config.periodLockEnabled ? t('settings.on') : t('settings.off')}
                      </span>
                      <label className="inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={config.periodLockEnabled ?? false}
                          onChange={(e) => {
                            const isEnabled = e.target.checked;
                            // Auto-set today's date if turning ON and date is empty
                            const newDate = (isEnabled && !config.lockedThroughDate) 
                              ? new Date().toISOString().split('T')[0] 
                              : config.lockedThroughDate;
                            
                            setConfig({ ...config, periodLockEnabled: isEnabled, lockedThroughDate: newDate });
                          }}
                        />
                        <div className={`relative w-12 h-6 rounded-full transition-all ${config.periodLockEnabled ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-700'}`}>
                          <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${config.periodLockEnabled ? 'translate-x-6' : 'translate-x-0'}`}></div>
                        </div>
                      </label>
                    </div>
                  </div>

                  {config.periodLockEnabled && (
                    <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-800 animate-in fade-in slide-in-from-top-1 duration-300">
                       <div className={`flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-xl border transition-all ${
                         !config.lockedThroughDate 
                           ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-900/30' 
                           : 'bg-indigo-50/20 dark:bg-indigo-900/5 border-indigo-100/50 dark:border-indigo-900/20'
                       }`}>
                          <div className="flex-1">
                             <div className="flex items-center gap-2 mb-1">
                                <Lock size={14} className={!config.lockedThroughDate ? 'text-red-600' : 'text-indigo-600 dark:text-indigo-400'} />
                                <label className={`text-sm font-bold ${!config.lockedThroughDate ? 'text-red-900 dark:text-red-300' : 'text-gray-800 dark:text-[var(--color-text-primary)]'}`}>
                                   {t('settings.fiscal.lockedThroughDate')}
                                </label>
                                {!config.lockedThroughDate && <span className="text-[10px] font-bold text-red-600 uppercase">Required</span>}
                             </div>
                             <p className="text-xs text-gray-500 dark:text-[var(--color-text-secondary)]">
                                {t('settings.fiscal.lockedThroughDateDesc')}
                             </p>
                          </div>
                          <div className="shrink-0">
                            <DatePicker
                               value={config.lockedThroughDate || ''}
                               onChange={(date) => setConfig({ ...config, lockedThroughDate: date })}
                               className={`w-full sm:w-auto ${
                                 !config.lockedThroughDate 
                                   ? 'border-red-300 focus:ring-red-500 focus:border-red-500 shadow-sm shadow-red-100' 
                                   : 'border-gray-300 dark:border-[var(--color-border)] focus:ring-indigo-500 focus:border-indigo-500'
                               }`}
                            />
                          </div>
                       </div>
                    </div>
                  )}
                </div>

                <div className="bg-white dark:bg-[var(--color-bg-tertiary)] border border-gray-200 dark:border-[var(--color-border)] rounded-2xl p-6 shadow-sm">
                  <div className="flex flex-col md:flex-row md:items-start gap-4">
                    <div className="flex-1">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">{t('settings.fiscal.fiscalYear')}</label>
                          <input
                            type="number"
                            className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg dark:bg-[var(--color-bg-secondary)]"
                            value={fyYear}
                            onChange={(e) => setFyYear(Number(e.target.value))}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">{t('settings.fiscal.startMonth')}</label>
                          <select
                            className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg dark:bg-[var(--color-bg-secondary)]"
                            value={fyStartMonth}
                            onChange={(e) => setFyStartMonth(Number(e.target.value))}
                          >
                            {[1,2,3,4,5,6,7,8,9,10,11,12].map((m) => (
                              <option key={m} value={m}>{new Date(2000, m-1, 1).toLocaleString(i18n.language || 'en', { month: 'long' })}</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">{t('settings.fiscal.periodScheme')}</label>
                          <select
                            className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg dark:bg-[var(--color-bg-secondary)]"
                            value={fyPeriodScheme}
                            onChange={(e) => setFyPeriodScheme(e.target.value as any)}
                          >
                            <option value="MONTHLY">{t('settings.fiscal.monthly', 'Monthly')}</option>
                            <option value="QUARTERLY">{t('settings.fiscal.quarterly', 'Quarterly')}</option>
                            <option value="SEMI_ANNUAL">{t('settings.fiscal.semiAnnual', 'Semi-Annual')}</option>
                          </select>
                        </div>
                      </div>
                      {/* Special periods are added later per fiscal year */}
                    </div>

                    <button
                      onClick={handleCreateFiscalYear}
                      className="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl shadow-lg hover:bg-indigo-700 transition md:mt-6"
                      disabled={fiscalLoading}
                    >
                      {fiscalLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                      {t('settings.fiscal.createYear')}
                    </button>
                  </div>
                </div>

                <div className="bg-white dark:bg-[var(--color-bg-tertiary)] border border-gray-200 dark:border-[var(--color-border)] rounded-2xl p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-[var(--color-text-primary)]">{t('settings.fiscal.fiscalYears')}</h3>
                    <button
                      onClick={loadFiscalYears}
                      className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700"
                    >
                      <RefreshCw className={`w-4 h-4 ${fiscalLoading ? 'animate-spin' : ''}`} />
                      {t('settings.common.refresh')}
                    </button>
                  </div>

                  {fiscalYears.length === 0 ? (
                    <p className="text-sm text-[var(--color-text-muted)]">{t('settings.fiscal.none')}</p>
                  ) : (
                    <div className="space-y-3">
                      {fiscalYears.map((fy) => (
                        <div key={fy.id} className="border border-[var(--color-border)] rounded-xl p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <div className="text-sm font-bold text-[var(--color-text-primary)]">{fy.name}</div>
                              <div className="text-xs text-[var(--color-text-muted)]">
                                {fy.startDate} → {fy.endDate}
                              </div>
                            </div>
                              <div className="flex items-center gap-3">
                                <span className={`px-2 py-1 rounded-full text-xs font-bold ${fy.status === 'CLOSED' ? 'bg-emerald-100 text-emerald-700' : fy.status === 'LOCKED' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                                  {t(`settings.fiscal.status.${fy.status.toLowerCase() as 'open' | 'closed' | 'locked'}`, { defaultValue: fy.status })}
                                </span>
                                {fy.status === 'CLOSED' && (
                                  <button
                                    onClick={() => handleReopenYear(fy.id)}
                                    disabled={fiscalLoading}
                                    className="p-1 text-emerald-600 hover:text-emerald-700 transition-colors"
                                    title="Reopen Fiscal Year"
                                  >
                                    <RotateCcw size={16} />
                                  </button>
                                )}
                                {fy.status === 'OPEN' && (
                                  <button
                                    onClick={() => {
                                      setClosingFyId(fy.id);
                                      setClosingStep('PREVIEW');
                                      setRetainedEarningsAccountId(''); 
                                    }}
                                    disabled={fiscalLoading}
                                    className="p-1 text-gray-400 hover:text-indigo-600 transition-colors"
                                    title={t('settings.fiscal.closeYear')}
                                  >
                                    <Lock size={16} />
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDeleteFiscalYear(fy.id)}
                                  disabled={fiscalLoading}
                                  className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                                  title={t('settings.common.delete')}
                                >
                                  <Trash2 size={16} />
                                </button>
                                {fy.status === 'OPEN' && (fy.specialPeriodsCount || 0) < 4 && (
                                  <button
                                    onClick={() => handleEnableSpecialPeriods(fy.id)}
                                    disabled={fiscalLoading}
                                    className="p-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded border border-indigo-200 transition-colors ml-2"
                                    title={t('settings.fiscal.addSpecialPeriod', 'Add Special Period')}
                                  >
                                    + P{13 + (fy.specialPeriodsCount || 0)}
                                  </button>
                                )}

                            </div>
                            </div>

                            <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2">
                              {fy.periods.map((p) => (
                                <div key={p.id} className="flex items-center justify-between bg-[var(--color-bg-secondary)] rounded-lg px-3 py-2">
                                  <div>
                                    <div className="text-sm font-semibold">{p.name}</div>
                                    <div className="text-xs text-[var(--color-text-muted)]">
                                      {p.startDate} - {p.endDate}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${p.status === 'CLOSED' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                                      {p.status}
                                    </span>
                                    {p.status === 'OPEN' ? (
                                      <button
                                        onClick={() => handleClosePeriod(fy.id, p.id)}
                                        disabled={fiscalLoading}
                                        className="text-[var(--color-text-muted)] hover:text-indigo-600"
                                        title={t('settings.fiscal.closePeriod')}
                                      >
                                        <Lock size={14} />
                                      </button>
                                    ) : (
                                      <button
                                        onClick={() => handleReopenPeriod(fy.id, p.id)}
                                        disabled={fiscalLoading}
                                        className="text-[var(--color-text-muted)] hover:text-amber-600"
                                        title={t('settings.fiscal.reopenPeriod')}
                                      >
                                        <RefreshCw size={14} />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                      ))}
                    </div>
                  )}
                  </div>

                  {/* Closing Year Modal */}
                  {closingFyId && createPortal(
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-[2px] p-4">
                      <div className="bg-white dark:bg-[var(--color-bg-primary)] rounded-xl shadow-2xl max-w-lg w-full overflow-hidden border border-gray-200 dark:border-[var(--color-border)] transform transition-all">
                        {closingStep === 'PREVIEW' ? (
                          <>
                            {/* Modal Header */}
                            <div className="bg-indigo-50 dark:bg-indigo-900/20 px-6 py-4 border-b border-indigo-100 dark:border-indigo-900/30 flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/40 rounded-lg text-indigo-600 dark:text-indigo-400">
                                   <Building2 size={24} />
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 dark:text-[var(--color-text-primary)]">
                                  {t('settings.fiscal.closingWizard.step1', 'Step 1: Account Selection')}
                                </h3>
                              </div>
                              <button onClick={handleCloseModalReset} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
                            </div>

                            <div className="p-6">
                              <p className="text-sm text-gray-600 dark:text-[var(--color-text-secondary)] mb-6 leading-relaxed">
                                {t('settings.fiscal.closingWizard.step1Desc', 'Welcome to the Year-End Closing Wizard. To begin, please select the target Retained Earnings account where net income will be transferred.')}
                              </p>
                              
                              <div className="bg-indigo-50/30 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30 rounded-xl p-5 mb-8">
                                <label className="block text-sm font-bold text-indigo-900 dark:text-indigo-300 mb-3">
                                  {t('settings.fiscal.retainedEarnings')} <span className="text-red-500">*</span>
                                </label>
                                <AccountSelector
                                  value={retainedEarningsAccountId}
                                  onChange={(account) => setRetainedEarningsAccountId(account?.id || '')}
                                  placeholder={t('settings.fiscal.retainedPlaceholder')}
                                  className="w-full shadow-sm"
                                />
                                <div className="mt-3 text-right">
                                   <button
                                     onClick={handleAutoCreateRetainedEarnings}
                                     className="text-xs font-semibold text-indigo-600 hover:underline"
                                     disabled={fiscalLoading}
                                   >
                                     + {t('settings.fiscal.autoCreateAccount')}
                                   </button>
                                </div>
                              </div>

                              <div className="bg-white dark:bg-[#0c1015] p-5 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm relative z-40">
                                <label className="block text-sm font-bold text-gray-900 dark:text-gray-300 mb-1">
                                  {t('settings.fiscal.pandLClearingAccount', 'P&L Clearing Account')} <span className="text-gray-400 font-normal text-xs ml-2">({t('settings.common.optional', 'Optional')})</span>
                                </label>
                                <p className="text-xs text-gray-500 mb-3">
                                  {t('settings.fiscal.pandLClearingHint', 'If selected, all Revenue/Expense lines will first clear into this account, and the net balance will move to Retained Earnings.')}
                                </p>
                                <AccountSelector
                                  value={pandLClearingAccountId}
                                  onChange={(account) => setPandLClearingAccountId(account?.id || '')}
                                  placeholder={t('settings.fiscal.pandLClearingPlaceholder', 'Select P&L Clearing Account')}
                                  className="w-full shadow-sm"
                                />
                              </div>

                              {/* Re-closing Awareness Alert */}
                              {fiscalYears.find(f => f.id === closingFyId)?.closingVoucherId && (
                                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-xl p-5 mb-8 animate-in fade-in slide-in-from-top-2">
                                  <div className="flex items-start gap-3">
                                    <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={20} />
                                    <div className="flex-1">
                                      <h4 className="font-bold text-amber-900 dark:text-amber-300 text-sm">
                                        {t('settings.fiscal.reclosingDetected', 'Previous Closing Detected')}
                                      </h4>
                                      <p className="text-amber-800 dark:text-amber-400 text-xs mt-1 leading-relaxed">
                                        {t('settings.fiscal.reclosingHint', 'This year was previously closed. To ensure accurate financial reporting, the previous closing voucher must be invalidated and reversed first.')}
                                      </p>
                                      
                                      <div className="mt-4 flex flex-col gap-2">
                                        <div className="flex items-center justify-between text-[10px] font-bold text-amber-700/60 uppercase tracking-widest">
                                          <span>Last Closing Voucher</span>
                                          <span className="font-mono">{lastClosingVoucher?.voucherNo || fiscalYears.find(f => f.id === closingFyId)?.closingVoucherId?.substring(0,8)}</span>
                                        </div>
                                        {lastClosingVoucher && (
                                          <div className="flex items-center gap-4 text-[11px] text-amber-800 font-medium">
                                            <span>{lastClosingVoucher.date}</span>
                                            <span className="opacity-40">|</span>
                                            <span>{lastClosingVoucher.currency} {lastClosingVoucher.totalDebit?.toLocaleString()}</span>
                                          </div>
                                        )}
                                        <button 
                                          onClick={async () => {
                                            if (closingFyId) {
                                              try {
                                                setFiscalLoading(true);
                                                await accountingApi.reopenFiscalYear(closingFyId);
                                                await loadFiscalYears();
                                                setLastClosingVoucher(null);
                                                errorHandler.showSuccess(t('settings.messages.previousClosingReversed', 'Previous closing invalidated successfully.'));
                                              } catch (err: any) {
                                                errorHandler.showError(err?.response?.data?.error?.message || 'Failed to invalidate previous closing');
                                              } finally {
                                                setFiscalLoading(false);
                                              }
                                            }
                                          }}
                                          disabled={fiscalLoading}
                                          className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-2 shadow-sm mt-1"
                                        >
                                          {fiscalLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <RotateCcw size={14} />}
                                          {t('settings.fiscal.invalidateAndReverse', 'Invalidate & Reverse Previous Closing')}
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}

                                <div className="flex justify-end gap-3 mt-6">
                                  <button onClick={handleCloseModalReset} className="px-6 py-2 text-sm font-bold text-gray-500 hover:text-gray-700">{t('settings.common.cancel')}</button>
                                  <button
                                    onClick={handlePrepareClosing}
                                    disabled={!retainedEarningsAccountId || fiscalLoading}
                                    className="px-8 py-2.5 bg-indigo-600 text-white rounded-lg font-bold shadow-lg hover:bg-indigo-700 disabled:opacity-50"
                                  >
                                    {t('settings.common.next', 'Next: Review')}
                                  </button>
                                </div>
                              </div>
                            </>
                        ) : closingStep === 'REVIEW' ? (
                          <>
                            <div className="bg-indigo-50 dark:bg-indigo-900/20 px-6 py-4 border-b border-indigo-100 dark:border-indigo-900/30 flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/40 rounded-lg text-indigo-600 dark:text-indigo-400">
                                   <FileText size={20} />
                                </div>
                                <h3 className="text-lg font-bold text-indigo-900 dark:text-indigo-300">
                                  {t('settings.fiscal.closingWizard.step2', 'Step 2: Draft Voucher Review')}
                                </h3>
                              </div>
                              <button onClick={handleCloseModalReset} className="text-indigo-400 hover:text-indigo-600"><X size={20} /></button>
                            </div>

                            <div className="p-6">
                              <div className="text-sm text-gray-600 dark:text-gray-400 mb-6 space-y-3">
                                <p className="font-bold text-gray-900 dark:text-white">
                                  {t('settings.fiscal.closingWizard.reviewDisclaimer', 'The system has generated the following Draft Closing Voucher. Review the ledger lines below before locking the year.')}
                                </p>
                              </div>

                              {draftClosingVoucher && (
                                <div className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden mb-6">
                                  <div className="bg-gray-50 dark:bg-gray-900/50 px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                      <span className="font-mono font-bold text-indigo-600">{draftClosingVoucher.voucherNo}</span>
                                      <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded text-[10px] font-bold uppercase tracking-wider">{draftClosingVoucher.status}</span>
                                    </div>
                                    <div className="text-xs font-medium text-gray-500">
                                      {t('settings.common.date')}: {draftClosingVoucher.date}
                                    </div>
                                  </div>
                                  <div className="max-h-60 overflow-y-auto">
                                    <table className="w-full text-xs text-left">
                                      <thead className="bg-white dark:bg-gray-950 sticky top-0 border-b border-gray-200 dark:border-gray-800">
                                        <tr>
                                          <th className="py-2 px-4 text-gray-500 font-semibold">{t('accounting.account')}</th>
                                          <th className="py-2 px-4 text-gray-500 font-semibold text-right">{t('accounting.debit')}</th>
                                          <th className="py-2 px-4 text-gray-500 font-semibold text-right">{t('accounting.credit')}</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60">
                                        {draftClosingVoucher.lines?.map((line: any, i: number) => {
                                          const isRetained = line.accountId === retainedEarningsAccountId;
                                          const isClearing = line.accountId === pandLClearingAccountId;
                                          return (
                                            <tr key={i} className={`hover:bg-gray-50 dark:hover:bg-gray-800/30 ${isRetained ? 'bg-indigo-50/30' : ''} ${isClearing ? 'bg-amber-50/30' : ''}`}>
                                              <td className="py-2 px-4">
                                                <div className="flex items-center gap-2">
                                                  <span className="font-medium text-gray-900 dark:text-gray-200 flex items-center gap-1.5">
                                                    {accounts.find(a => a.id === line.accountId)?.name || 'Unknown'}
                                                    {isRetained && <span className="text-[9px] bg-indigo-100 text-indigo-700 px-1 rounded uppercase font-bold">RE</span>}
                                                    {isClearing && <span className="text-[9px] bg-amber-100 text-amber-700 px-1 rounded uppercase font-bold">P&L CLR</span>}
                                                  </span>
                                                </div>
                                              </td>
                                              <td className="py-2 px-4 text-right font-mono text-gray-600">
                                                {line.debitAmount > 0 ? line.debitAmount.toLocaleString() : '-'}
                                              </td>
                                              <td className="py-2 px-4 text-right font-mono text-gray-600">
                                                {line.creditAmount > 0 ? line.creditAmount.toLocaleString() : '-'}
                                              </td>
                                            </tr>
                                          );
                                        })}
                                        </tbody>
                                        <tfoot className="bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-800 font-bold">
                                          <tr>
                                            <td className="py-3 px-4 text-gray-500 text-right">{t('accounting.total')}</td>
                                            <td className="py-3 px-4 text-right font-mono text-gray-900 dark:text-white">{(draftClosingVoucher.totalDebit || 0).toLocaleString()}</td>
                                            <td className="py-3 px-4 text-right font-mono text-gray-900 dark:text-white">{(draftClosingVoucher.totalCredit || 0).toLocaleString()}</td>
                                          </tr>
                                        </tfoot>
                                      </table>
                                    </div>
                                  </div>
                              )}

                              <div className="flex justify-end gap-3">
                                <button onClick={() => setClosingStep('PREVIEW')} className="px-6 py-2 text-sm font-bold text-gray-500 hover:text-gray-700">{t('settings.common.back', 'Back')}</button>
                                <button
                                  onClick={() => confirmCloseYear()}
                                  disabled={fiscalLoading}
                                  className="px-8 py-2.5 bg-indigo-600 text-white rounded-lg font-bold shadow-lg hover:bg-indigo-700 flex items-center gap-2"
                                >
                                  {fiscalLoading ? <RefreshCw size={18} className="animate-spin" /> : <Check size={18} />}
                                  {t('settings.fiscal.confirmations.closeYear.confirm', 'Post Voucher & Lock Year')}
                                </button>
                              </div>
                            </div>
                          </>
                        ) : (
                          <>
                            {/* Success Step */}
                            <div className="bg-emerald-50 dark:bg-emerald-900/20 px-6 py-6 border-b border-emerald-100 dark:border-emerald-900/30 text-center">
                              <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/40 rounded-full text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-4">
                                 <CheckCircle2 size={40} />
                              </div>
                              <h3 className="text-2xl font-bold text-emerald-900 dark:text-emerald-300">
                                {t('settings.fiscal.messages.yearClosedSuccess', 'Year Successfully Closed!')}
                              </h3>
                              <p className="text-emerald-700 dark:text-emerald-400 text-sm mt-1">
                                {t('settings.fiscal.closingWizard.lockedMessage', { year: fiscalYears.find(f => f.id === closingFyId)?.name })}
                              </p>
                            </div>

                            <div className="p-8">
                               <div className="bg-gray-50 dark:bg-[var(--color-bg-secondary)] rounded-2xl p-6 border border-gray-100 dark:border-gray-800 mb-8 space-y-4">
                                  <div className="flex items-center justify-between text-sm">
                                     <span className="text-gray-500">{t('settings.fiscal.summary.revenue', 'Revenue Total')}</span>
                                     <span className="font-bold text-gray-900 dark:text-white">{(closingSummary?.revenueTotal || 0).toLocaleString()} {closingSummary?.baseCurrency}</span>
                                  </div>
                                  <div className="flex items-center justify-between text-sm">
                                     <span className="text-gray-500">{t('settings.fiscal.summary.expense', 'Expense Total')}</span>
                                     <span className="font-bold text-gray-900 dark:text-white">{(closingSummary?.expenseTotal || 0).toLocaleString()} {closingSummary?.baseCurrency}</span>
                                  </div>
                                  <div className="border-t border-gray-200 dark:border-gray-700 pt-4 flex items-center justify-between">
                                     <span className="font-bold text-gray-900 dark:text-[var(--color-text-primary)]">{t('settings.fiscal.summary.netIncome', 'Net Income (Profit)')}</span>
                                     <span className={`text-lg font-black ${(closingSummary?.netIncome || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                       {(closingSummary?.netIncome || 0).toLocaleString()} {closingSummary?.baseCurrency}
                                     </span>
                                  </div>
                               </div>

                               <div className="bg-indigo-50 dark:bg-indigo-900/10 rounded-xl p-4 flex items-center justify-between border border-indigo-100 dark:border-indigo-900/30">
                                  <div className="flex items-center gap-3">
                                     <div className="p-2 bg-indigo-100 dark:bg-indigo-900/40 rounded text-indigo-600">
                                        <Hash size={20} />
                                     </div>
                                     <div>
                                        <div className="text-xs text-indigo-600 font-bold uppercase">{t('settings.fiscal.closingVoucher', 'Audit Trail Voucher')}</div>
                                        <div className="text-sm font-bold text-indigo-900 dark:text-indigo-300">
                                          {closingSummary?.voucherId ? `CLOSE-${closingFyId?.substring(0,8)}` : 'N/A'}
                                        </div>
                                     </div>
                                  </div>
                                  {closingSummary?.voucherId && (
                                    <button 
                                      className="px-4 py-2 bg-white dark:bg-[var(--color-bg-tertiary)] border border-indigo-200 dark:border-indigo-800 rounded-lg text-xs font-bold text-indigo-600 hover:bg-indigo-50 transition-all flex items-center gap-2"
                                      onClick={() => {
                                        window.location.hash = `#/accounting/vouchers?q=CLOSE-${closingFyId}`;
                                        handleCloseModalReset();
                                      }}
                                    >
                                       <RefreshCw size={14} />
                                       {t('settings.fiscal.viewVoucher', 'View Entry')}
                                    </button>
                                  )}
                               </div>

                               <button
                                 onClick={handleCloseModalReset}
                                 className="w-full mt-8 py-3 bg-gray-900 dark:bg-white dark:text-gray-900 text-white rounded-xl font-bold hover:opacity-90 active:scale-95 transition-all"
                               >
                                 {t('settings.common.done', 'Complete Wizard')}
                               </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>,
                    document.body
                  )}

                  {/* Generic Confirmation Modal */}
                  {genericConfirm.isOpen && createPortal(
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-[2px] p-4">
                      <div className="bg-white dark:bg-[var(--color-bg-primary)] rounded-xl shadow-2xl max-w-lg w-full p-6 border border-gray-200 dark:border-[var(--color-border)] transform transition-all">
                        <div className="flex items-start gap-4 mb-4">
                          <div className={`p-3 rounded-full flex-shrink-0 ${genericConfirm.type === 'DELETE_YEAR' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
                            {genericConfirm.type === 'DELETE_YEAR' ? <Trash2 size={24} /> : <AlertTriangle size={24} />}
                          </div>
                          <div className="flex-1">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-[var(--color-text-primary)]">
                              {t(`settings.fiscal.confirmations.${
                                genericConfirm.type === 'CLOSE_PERIOD' ? 'closePeriod' :
                                genericConfirm.type === 'REOPEN_PERIOD' ? 'reopenPeriod' :
                                genericConfirm.type === 'REOPEN_YEAR' ? 'reopenYear' :
                                'deleteYear'
                              }.title`)}
                            </h3>
                            <div className="mt-2 text-sm text-gray-500 dark:text-[var(--color-text-secondary)] leading-relaxed">
                              <span className="block font-bold text-gray-900 dark:text-[var(--color-text-primary)] mb-1">
                                {t(`settings.fiscal.confirmations.${
                                  genericConfirm.type === 'CLOSE_PERIOD' ? 'closePeriod' :
                                  genericConfirm.type === 'REOPEN_PERIOD' ? 'reopenPeriod' :
                                  genericConfirm.type === 'REOPEN_YEAR' ? 'reopenYear' :
                                  'deleteYear'
                                }.question`, { period: genericConfirm.label, year: genericConfirm.label })}
                              </span>
                              {t(`settings.fiscal.confirmations.${
                                genericConfirm.type === 'CLOSE_PERIOD' ? 'closePeriod' :
                                genericConfirm.type === 'REOPEN_PERIOD' ? 'reopenPeriod' :
                                genericConfirm.type === 'REOPEN_YEAR' ? 'reopenYear' :
                                'deleteYear'
                              }.description`, { period: genericConfirm.label, year: genericConfirm.label })}
                              
                              {genericConfirm.type === 'REOPEN_YEAR' && reopenVoucherDetails && (
                                <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-lg">
                                  <div className="flex items-center gap-2 mb-2">
                                    <AlertTriangle className="text-amber-600 w-4 h-4" />
                                    <span className="font-bold text-amber-900 dark:text-amber-300">
                                      {t('settings.fiscal.reopenWarningTitle', 'Closing Voucher Will Be Reversed')}
                                    </span>
                                  </div>
                                  <p className="text-amber-800 dark:text-amber-400 text-xs mb-3">
                                    {t('settings.fiscal.reopenWarningDesc', 'Reopening this year will automatically reverse the following closing voucher to cancel its financial effect.')}
                                  </p>
                                  <div className="flex items-center justify-between text-xs bg-white dark:bg-[var(--color-bg-primary)] p-2 rounded border border-amber-100 dark:border-amber-800/30">
                                    <div>
                                      <div className="font-bold text-gray-900 dark:text-[var(--color-text-primary)]">{reopenVoucherDetails.voucherNo}</div>
                                      <div className="text-gray-500">{reopenVoucherDetails.date}</div>
                                    </div>
                                    <div className="text-right">
                                      <div className="font-bold text-gray-900 dark:text-[var(--color-text-primary)]">{reopenVoucherDetails.currency} {reopenVoucherDetails.totalDebit?.toLocaleString()}</div>
                                      <a 
                                        href={`#/accounting/vouchers?q=${reopenVoucherDetails.voucherNo}`} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="text-indigo-600 hover:underline"
                                      >
                                        {t('settings.fiscal.viewVoucher', 'View Entry')}
                                      </a>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-6">
                          <button
                            onClick={() => {
                              setGenericConfirm(prev => ({ ...prev, isOpen: false }));
                              setReopenVoucherDetails(null);
                            }}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none dark:bg-[var(--color-bg-tertiary)] dark:text-[var(--color-text-primary)] dark:border-[var(--color-border)]"
                          >
                            {t('settings.common.cancel')}
                          </button>
                          <button
                            onClick={() => {
                              if (genericConfirm.type === 'CLOSE_PERIOD') confirmClosePeriod();
                              else if (genericConfirm.type === 'REOPEN_PERIOD') confirmReopenPeriod();
                              else if (genericConfirm.type === 'REOPEN_YEAR') confirmReopenYear();
                              else if (genericConfirm.type === 'DELETE_YEAR') confirmDeleteYear();
                            }}
                            disabled={fiscalLoading}
                            className={`px-4 py-2 text-sm font-medium text-white border border-transparent rounded-lg focus:outline-none disabled:opacity-50 shadow-sm ${
                               genericConfirm.type === 'DELETE_YEAR' ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'
                            }`}
                          >
                            {fiscalLoading ? (
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
                            ) : (
                              t(`settings.fiscal.confirmations.${
                                genericConfirm.type === 'CLOSE_PERIOD' ? 'closePeriod' :
                                genericConfirm.type === 'REOPEN_PERIOD' ? 'reopenPeriod' :
                                genericConfirm.type === 'REOPEN_YEAR' ? 'reopenYear' :
                                'deleteYear'
                              }.confirm`)
                            )}
                          </button>
                        </div>
                      </div>
                    </div>,
                    document.body
                  )}
                  
                  {/* Add Special Period Modal */}
                  {specialPeriodData.isOpen && createPortal(
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-[2px] p-4">
                      <div className="bg-white dark:bg-[var(--color-bg-primary)] rounded-xl shadow-2xl max-w-md w-full p-6 border border-gray-200 dark:border-[var(--color-border)] transform transition-all">
                        <div className="flex items-center gap-3 mb-6">
                           <div className="p-2 bg-indigo-100 dark:bg-indigo-900/40 rounded-lg text-indigo-600 dark:text-indigo-400">
                             <Plus size={24} />
                           </div>
                           <h3 className="text-xl font-bold text-gray-900 dark:text-[var(--color-text-primary)]">
                             {t('settings.fiscal.addSpecialPeriodTitle', 'Add Special Period')}
                           </h3>
                        </div>

                        <div className="space-y-4">
                          <p className="text-sm text-gray-500 dark:text-[var(--color-text-secondary)]">
                            {t('settings.fiscal.specialPeriodHint', 'Special periods (P13-P16) are used for year-end adjustments and audits. They are strictly tied to the fiscal year end date.')}
                          </p>
                          
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                              {t('settings.fiscal.periodName', 'Period Name')}
                            </label>
                            <input 
                              type="text"
                              autoFocus
                              value={specialPeriodData.newName}
                              onChange={(e) => setSpecialPeriodData({ ...specialPeriodData, newName: e.target.value })}
                              onKeyDown={(e) => e.key === 'Enter' && confirmAddSpecialPeriod()}
                              className="w-full px-4 py-2 bg-white dark:bg-[var(--color-bg-secondary)] border border-gray-300 dark:border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                              placeholder="e.g. Year-End Adjustments"
                            />
                          </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-8">
                          <button
                            onClick={() => setSpecialPeriodData(prev => ({ ...prev, isOpen: false }))}
                            className="px-6 py-2 text-sm font-bold text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
                          >
                            {t('settings.common.cancel')}
                          </button>
                          <button
                            onClick={confirmAddSpecialPeriod}
                            disabled={!specialPeriodData.newName.trim() || fiscalLoading}
                            className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold shadow-lg hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center gap-2"
                          >
                            {fiscalLoading ? <RefreshCw size={16} className="animate-spin" /> : <Check size={16} />}
                            {t('settings.common.add')}
                          </button>
                        </div>
                      </div>
                    </div>,
                    document.body
                  )}
                </div>
              </>
            )}

            {/* Voucher Numbering Tab */}
            {(activeTab as string) === 'numbering' && (
              <div className="max-w-4xl mx-auto space-y-6">
                <SectionHeader 
                  title={t('settings.numbering.title')} 
                  description={t('settings.numbering.description')}
                  onSave={() => handleSave('numbering')}
                  disabled={saving}
                  saving={saving}
                />

                <div className="bg-white border rounded-xl p-4 shadow-sm space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-[var(--color-text-muted)]">{t('settings.numbering.prefix')}</label>
                      <input className="w-full border rounded px-3 py-2 text-sm" value={seqPrefix} onChange={(e) => setSeqPrefix(e.target.value.toUpperCase())} />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-[var(--color-text-muted)]">{t('settings.numbering.yearOptional')}</label>
                      <input className="w-full border rounded px-3 py-2 text-sm" value={seqYear} onChange={(e) => setSeqYear(e.target.value === '' ? '' : Number(e.target.value))} />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-[var(--color-text-muted)]">{t('settings.numbering.nextNumber')}</label>
                      <input type="number" className="w-full border rounded px-3 py-2 text-sm" value={seqNext} onChange={(e) => setSeqNext(Number(e.target.value))} />
                    </div>
                    <div className="flex items-end">
                      <button onClick={handleSetNextNumber} className="px-4 py-2 bg-indigo-600 text-white rounded-md flex items-center gap-2" disabled={saving}>
                        <Save size={16} />
                        {t('settings.numbering.saveNext')}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="bg-white border rounded-xl p-4 shadow-sm">
                  <h3 className="text-sm font-bold text-slate-800 mb-3">{t('settings.numbering.sequences')}</h3>
                  {sequences.length === 0 ? (
                    <p className="text-sm text-[var(--color-text-muted)]">{t('settings.numbering.noSequences')}</p>
                  ) : (
                    <div className="divide-y">
                      {sequences.map((s) => (
                        <div key={s.id} className="py-2 flex justify-between items-center">
                          <div>
                            <div className="font-semibold">{s.prefix}{s.year ? `-${s.year}` : ''}</div>
                            <div className="text-xs text-[var(--color-text-muted)]">{t('settings.numbering.last', { value: s.lastNumber })}</div>
                          </div>
                          <div className="text-xs text-[var(--color-text-muted)]">{s.updatedAt}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ======= FX REVALUATION TAB ======= */}
            {activeTab === 'fx-revaluation' && (
              <FXRevaluationTab />
            )}

            {/* Metadata and Closing of IIFE */}
            {config.updatedAt && (
              <div className="mt-8 pt-4 border-t border-[var(--color-border)] text-sm text-[var(--color-text-muted)] italic">
                {t('settings.metadata.lastUpdated', { value: new Date(config.updatedAt).toLocaleString(i18n.language) })}
                {config.updatedBy && t('settings.metadata.updatedBy', { user: config.updatedBy })}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export const AccountingSettingsPage: React.FC = () => (
  <AccountsProvider>
    <AccountingSettingsPageContent />
  </AccountsProvider>
);
