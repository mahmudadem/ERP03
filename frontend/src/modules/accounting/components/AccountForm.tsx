import { useState, useEffect } from 'react';
import { 
    Account, 
    NewAccountInput, 
    AccountRole, 
    AccountClassification, 
    BalanceNature, 
    BalanceEnforcement, 
    CurrencyPolicy,
    AccountStatus,
    CashFlowCategory,
    PlSubgroup,
    EquitySubgroup
} from '../../../api/accounting';
import { CurrencySelector } from './shared/CurrencySelector';
import { useCompanyUsers, useCompanyProfile } from '../../../hooks/useCompanyAdmin';
import { useCompanyModules } from '../../../hooks/useCompanyModules';
import { Shield, UserCheck, Lock, Settings, FileCode, CheckCircle2, DollarSign, ChevronRight, LayoutGrid, Info, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { errorHandler } from '../../../services/errorHandler';
import { Spinner } from '../../../components/ui/Spinner';

interface AccountFormProps {
    mode: 'create' | 'edit';
    initialValues?: Account;
    accounts?: Account[];
    onSubmit: (data: NewAccountInput) => Promise<any>;
    onCancel: () => void;
    /**
     * Contextual constraint for inline creation from a typed account selector (engines-vs-modules
     * rule, Task 253). When provided, the classification dropdown is restricted to this set so a
     * non-accountant creating an account from, e.g., a "revenue account" picker cannot pick a wrong
     * classification and silently corrupt the books. A single entry locks the field.
     */
    allowedClassifications?: AccountClassification[];
}

const CLASSIFICATIONS: AccountClassification[] = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'];
const ROLES: AccountRole[] = ['POSTING', 'HEADER'];
const BALANCE_NATURES: BalanceNature[] = ['DEBIT', 'CREDIT', 'BOTH'];
const BALANCE_ENFORCEMENT: BalanceEnforcement[] = ['WARN_ABNORMAL', 'BLOCK_ABNORMAL', 'ALLOW_ABNORMAL'];
const CURRENCY_POLICIES: CurrencyPolicy[] = ['INHERIT', 'FIXED', 'OPEN'];
const CASH_FLOW_CATEGORIES: (CashFlowCategory | '')[] = ['', 'OPERATING', 'INVESTING', 'FINANCING'];
const PL_SUBGROUPS: { value: PlSubgroup | ''; forClassification: AccountClassification[] }[] = [
    { value: '', forClassification: ['REVENUE', 'EXPENSE'] },
    { value: 'SALES', forClassification: ['REVENUE'] },
    { value: 'OTHER_REVENUE', forClassification: ['REVENUE'] },
    { value: 'COST_OF_SALES', forClassification: ['EXPENSE'] },
    { value: 'OPERATING_EXPENSES', forClassification: ['EXPENSE'] },
    { value: 'OTHER_EXPENSES', forClassification: ['EXPENSE'] },
];
const EQUITY_SUBGROUPS: (EquitySubgroup | '')[] = ['', 'RETAINED_EARNINGS', 'CONTRIBUTED_CAPITAL', 'RESERVES'];

export const AccountForm: React.FC<AccountFormProps> = ({
    mode,
    initialValues,
    accounts = [],
    onSubmit,
    onCancel,
    allowedClassifications,
}) => {
    const { t } = useTranslation('accounting');
    // Contextual classification constraint (Task 253): restrict the dropdown when the form is
    // opened from a typed selector; lock it when exactly one classification is allowed.
    const hasClassificationConstraint = !!allowedClassifications && allowedClassifications.length > 0;
    const classificationOptions = hasClassificationConstraint
        ? CLASSIFICATIONS.filter(classification => allowedClassifications!.includes(classification))
        : CLASSIFICATIONS;
    const classificationLocked = hasClassificationConstraint && allowedClassifications!.length === 1;
    // Determine defaults
    const defaultClassification = 'ASSET';

    // State
    const [userCode, setUserCode] = useState(initialValues?.userCode || initialValues?.code || '');
    const [name, setName] = useState(initialValues?.name || '');
    const [description, setDescription] = useState(initialValues?.description || '');
    const [status, setStatus] = useState<AccountStatus>(initialValues?.status || (initialValues?.isActive ? 'ACTIVE' : 'INACTIVE') || 'ACTIVE');

    const initialClassification = ((): AccountClassification => {
        const fromValues = (initialValues?.classification as AccountClassification) || (initialValues?.type as AccountClassification);
        if (hasClassificationConstraint) {
            // Honor the incoming value only if it's within the allowed set; otherwise snap to the first allowed.
            return fromValues && allowedClassifications!.includes(fromValues) ? fromValues : allowedClassifications![0];
        }
        return fromValues || defaultClassification;
    })();
    const [classification, setClassification] = useState<AccountClassification>(initialClassification);
    const [accountRole, setAccountRole] = useState<AccountRole>(initialValues?.accountRole || 'POSTING');
    
    const [balanceNature, setBalanceNature] = useState<BalanceNature>(initialValues?.balanceNature || 'DEBIT');
    const [balanceEnforcement, setBalanceEnforcement] = useState<BalanceEnforcement>(initialValues?.balanceEnforcement || 'WARN_ABNORMAL');
    
    const [parentId, setParentId] = useState(initialValues?.parentId || '');
    
    // Professionally handle parent change to auto-set classification
    const handleParentChange = (newParentId: string) => {
        setParentId(newParentId);
        if (newParentId) {
            const parent = accounts.find(a => a.id === newParentId);
            if (parent) {
                setClassification(parent.classification as AccountClassification);
            }
        }
    };

    const generateNextCode = () => {
        if (!parentId) {
            // Root logic: find highest root code for this classification
            const rootAccs = accounts.filter(a => !a.parentId && a.classification === classification);
            const codes = rootAccs.map(a => parseInt(a.code)).filter(c => !isNaN(c));
            const next = codes.length > 0 ? Math.max(...codes) + 1 : (classification === 'ASSET' ? 1000 : classification === 'LIABILITY' ? 2000 : 3000);
            setUserCode(next.toString());
            return;
        }
        
        // Child logic: find highest child code under this parent
        const siblingAccs = accounts.filter(a => a.parentId === parentId);
        const codes = siblingAccs.map(a => parseInt(a.code)).filter(c => !isNaN(c));
        const parent = accounts.find(a => a.id === parentId);
        
        if (codes.length > 0) {
            setUserCode((Math.max(...codes) + 1).toString());
        } else if (parent) {
             setUserCode(`${parent.code}01`); // Default first child suffix
        }
    };
    
    const [currencyPolicy, setCurrencyPolicy] = useState<CurrencyPolicy>(initialValues?.currencyPolicy || 'INHERIT');
    const [fixedCurrencyCode, setFixedCurrencyCode] = useState(initialValues?.fixedCurrencyCode || initialValues?.currency || '');
    const [cashFlowCategory, setCashFlowCategory] = useState<CashFlowCategory | ''>(initialValues?.cashFlowCategory || '');
    const [plSubgroup, setPlSubgroup] = useState<PlSubgroup | ''>(initialValues?.plSubgroup || '');
    const [equitySubgroup, setEquitySubgroup] = useState<EquitySubgroup | ''>(initialValues?.equitySubgroup || '');

    // Fetch base currency from accounting module config
    const { getModuleStatus } = useCompanyModules();
    const { profile: company } = useCompanyProfile();
    const accountingModule = getModuleStatus('accounting');
    
    // Prefer company profile currency > accounting config > SYP fallback
    const baseCurrency = company?.currency || (accountingModule?.config as any)?.baseCurrency || 'SYP';

    const [requiresApproval, setRequiresApproval] = useState(initialValues?.requiresApproval || false);
    const [requiresCustodyConfirmation, setRequiresCustodyConfirmation] = useState(initialValues?.requiresCustodyConfirmation || false);
    const [custodianUserId, setCustodianUserId] = useState(initialValues?.custodianUserId || '');

    const { users: companyUsers, isLoading: isLoadingUsers } = useCompanyUsers();
    
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [activeTab, setActiveTab] = useState<'GENERAL' | 'ACCOUNTING' | 'CURRENCY' | 'GOVERNANCE'>('GENERAL');

    // Get parent details for governance validation
    const parentAccount = accounts.find(a => a.id === parentId);
    const isParentForeign = parentAccount?.currencyPolicy === 'FIXED' && parentAccount?.fixedCurrencyCode !== baseCurrency;

    // Professional Governance: Cascade/Enforce policies
    useEffect(() => {
        // Rule 1: Root accounts representing Level 0/1 MUST remain in base currency context
        if (!parentId) {
            // Force Root to FIXED:Base to ensure maximum clarity (INHERIT is also safe but FIXED is explicit)
            if (currencyPolicy !== 'FIXED' || fixedCurrencyCode !== baseCurrency) {
                 setCurrencyPolicy('FIXED');
                 setFixedCurrencyCode(baseCurrency);
            }
        }

        // Rule 2: Children under a foreign parent context MUST share the parent's currency
        if (parentId && isParentForeign) {
            if (currencyPolicy !== 'FIXED' || fixedCurrencyCode !== (parentAccount?.fixedCurrencyCode ?? baseCurrency)) {
                setCurrencyPolicy('FIXED');
                setFixedCurrencyCode(parentAccount?.fixedCurrencyCode || baseCurrency);
            }
        }
    }, [parentId, isParentForeign, currencyPolicy, fixedCurrencyCode, baseCurrency, parentAccount]);

    // Auto-set Balance Nature default when Classification changes
    useEffect(() => {
        if (!initialValues) { // Only for new or when explicitly changed
            if (['ASSET', 'EXPENSE'].includes(classification)) {
                setBalanceNature('DEBIT');
            } else {
                setBalanceNature('CREDIT');
            }
        }
    }, [classification, initialValues]);

    // Clear P&L subgroup when switching away from Revenue/Expense
    useEffect(() => {
        if (!['REVENUE', 'EXPENSE'].includes(classification)) {
            setPlSubgroup('');
        }
    }, [classification]);

    // Clear equity subgroup when switching away from Equity
    useEffect(() => {
        if (classification !== 'EQUITY') {
            setEquitySubgroup('');
        }
    }, [classification]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Safety: Ensure parent is truly a Header
        if (parentId) {
            const parent = accounts.find(a => a.id === parentId);
            if (parent && parent.accountRole !== 'HEADER') {
                errorHandler.showWarning(t('accountForm.hierarchyError', {
                    account: parent.name,
                    defaultValue: 'Hierarchy Error: Account "{{account}}" is a Posting account and cannot be selected as a parent.',
                }));
                return;
            }
        }

        setIsSubmitting(true);
        try {
            const payload: NewAccountInput = {
                userCode,
                name,
                description,
                classification,
                accountRole,
                status, // Only used in update, but accepted in type
                balanceNature,
                balanceEnforcement: accountRole === 'POSTING' ? balanceEnforcement : undefined,
                parentId: parentId || null,
                currencyPolicy,
                fixedCurrencyCode: currencyPolicy === 'FIXED' ? fixedCurrencyCode : null,
                cashFlowCategory: cashFlowCategory || null,
                plSubgroup: plSubgroup || null,
                equitySubgroup: equitySubgroup || null,
                requiresApproval,
                requiresCustodyConfirmation,
                custodianUserId: requiresCustodyConfirmation ? custodianUserId : null,
                
                // Legacy compat
                code: userCode,
                type: classification,
                isActive: status === 'ACTIVE',
                currency: currencyPolicy === 'FIXED' ? fixedCurrencyCode : undefined
            };
            await onSubmit(payload);
        } finally {
            setIsSubmitting(false);
        }
    };

    const isLocked = mode === 'edit' && initialValues?.isProtected;
    const isUsed = mode === 'edit' && initialValues?.isUsed;

    return (
        <form onSubmit={handleSubmit} className="flex flex-col w-full max-w-5xl h-[700px] bg-white dark:bg-[#0B0F1A] overflow-hidden rounded-2xl shadow-xl border border-gray-200 dark:border-gray-800 animate-in zoom-in-95 duration-500">
            {/* Simple Modal Header */}
            <header className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between shrink-0 bg-white dark:bg-gray-900">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    {mode === 'create' ? t('accountForm.createTitle', 'Create New Account') : t('accountForm.editTitle', 'Edit Account')}
                </h2>
                <button type="button" onClick={onCancel} className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                    <X size={20} />
                </button>
            </header>

            <div className="flex flex-1 overflow-hidden relative">
                {/* --- Sidebar Navigation (Precise Mimic) --- */}
                <aside className="w-64 border-r border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/40 overflow-y-auto block shrink-0">
                    <nav className="p-4 space-y-1">
                        {[
                            { id: 'GENERAL', label: t('accountForm.tabs.general', 'General Settings'), icon: Settings },
                            { id: 'ACCOUNTING', label: t('accountForm.tabs.accounting', 'Accounting Rules'), icon: FileCode },
                            { id: 'CURRENCY', label: t('accountForm.tabs.currency', 'Currency Policy'), icon: DollarSign },
                            { id: 'GOVERNANCE', label: t('accountForm.tabs.governance', 'Approval Workflow'), icon: Shield }
                        ].map((tab) => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setActiveTab(tab.id as any)}
                                    className={`
                                        w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
                                        ${isActive 
                                            ? 'bg-white dark:bg-gray-800 text-indigo-700 dark:text-primary-400 shadow-sm ring-1 ring-gray-200 dark:ring-gray-700' 
                                            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-white'
                                        }
                                    `}
                                >
                                    <Icon 
                                        size={18} 
                                        className={isActive ? 'text-indigo-600 dark:text-primary-400' : 'text-gray-400 dark:text-gray-500'} 
                                    />
                                    <span>{tab.label}</span>
                                </button>
                            );
                        })}
                    </nav>
                </aside>

                {/* --- Tab Content (Spacious Flat Layout) --- */}
                <main className="flex-1 overflow-y-auto p-12 scroll-smooth custom-scroll bg-white dark:bg-[#0B0F1A]">
                    <div className="max-w-4xl animate-in fade-in slide-in-from-right-4 duration-500 ease-out">
                        
                        {activeTab === 'GENERAL' && (
                            <div className="space-y-6">
                                <div className="mb-8 p-1">
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">
                                        {t('accountForm.generalTitle', 'General Information')}
                                    </h3>
                                    <p className="text-sm text-gray-500 mt-1">{t('accountForm.generalDescription')}</p>
                                </div>

                                <div className="group space-y-2 mb-4">
                                    <label className="flex items-center justify-between">
                                        <span className="text-[10px] font-extrabold text-blue-600 dark:text-blue-500 uppercase tracking-widest leading-none">{t('accountForm.parentAccount')}</span>
                                        {!parentId && <span className="text-[9px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded-full font-bold">{t('accountForm.rootLevel')}</span>}
                                    </label>
                                    <select
                                        value={parentId}
                                        onChange={(e) => handleParentChange(e.target.value)}
                                        className={`w-full px-4 py-3.5 border rounded-2xl focus:ring-4 focus:ring-blue-500/10 outline-none transition-all duration-300 text-sm shadow-sm font-medium
                                            ${parentId ? 'bg-blue-50/10 border-blue-200 text-blue-900' : 'bg-gray-50 border-gray-100 text-gray-500'}`}
                                        disabled={isLocked || isUsed}
                                    >
                                        <option value="">{t('accountForm.noParent')}</option>
                                        {(() => {
                                            const getDescendantIds = (parentId: string, visited = new Set<string>()): string[] => {
                                                if (visited.has(parentId)) return [];
                                                visited.add(parentId);
                                                const children = accounts.filter(a => a.parentId === parentId);
                                                return children.reduce((acc, child) => [...acc, child.id, ...getDescendantIds(child.id, visited)], [] as string[]);
                                            };
                                            const descendantIds = mode === 'edit' && initialValues?.id ? new Set(getDescendantIds(initialValues.id)) : new Set();
                                            
                                            return accounts
                                                .filter(a => a.id !== initialValues?.id)
                                                .filter(a => !descendantIds.has(a.id))
                                                .filter(a => a.accountRole === 'HEADER') 
                                                .sort((a, b) => a.classification.localeCompare(b.classification))
                                                .map(a => (
                                                    <option key={a.id} value={a.id}>
                                                        [{a.classification}] {a.code} - {a.name}
                                                    </option>
                                                ));
                                        })()}
                                    </select>
                                    <p className="text-[10px] text-gray-400 font-medium italic">
                                        {t('accountForm.parentTip')}
                                    </p>
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <div className="group space-y-1.5 relative">
                                        <label className="block text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">{t('accountForm.accountCode', 'Account Code')}</label>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                value={userCode}
                                                onChange={(e) => setUserCode(e.target.value.toUpperCase())}
                                                required
                                                disabled={isLocked}
                                                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/50 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all duration-300 font-mono text-sm uppercase disabled:opacity-50 shadow-sm"
                                                placeholder={t('accountForm.codePlaceholder')}
                                            />
                                            <button 
                                                type="button"
                                                onClick={generateNextCode}
                                                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                title={t('accountForm.generateCode')}
                                            >
                                                <LayoutGrid className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="group space-y-1.5">
                                        <label className="block text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">{t('accountForm.status')}</label>
                                        <select 
                                            value={status} 
                                            onChange={(e) => setStatus(e.target.value as AccountStatus)}
                                            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/50 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all duration-300 text-sm shadow-sm"
                                            disabled={isLocked}
                                        >
                                            <option value="ACTIVE">{t('accountForm.active')}</option>
                                            <option value="INACTIVE">{t('accountForm.inactive')}</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="group space-y-1.5 py-2">
                                    <label className="block text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">{t('accountForm.accountName', 'Account Name')}</label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        required
                                        className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/50 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all duration-300 text-sm shadow-sm font-semibold"
                                        placeholder={t('accountForm.accountNamePlaceholder', 'Electronic Supplies...')}
                                    />
                                </div>

                                <div className="space-y-6">
                                    <div className="space-y-1.5">
                                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">{t('accountForm.classification')}</label>
                                        <select
                                            value={classification}
                                            onChange={(e) => setClassification(e.target.value as AccountClassification)}
                                            className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all text-sm shadow-sm font-bold
                                                ${(parentId || classificationLocked) ? 'bg-amber-50/10 border-amber-100 text-amber-700 cursor-not-allowed' : 'bg-white border-gray-200'}`}
                                            disabled={isUsed || isLocked || !!parentId || classificationLocked}
                                        >
                                            {classificationOptions.map(option => (
                                                <option key={option} value={option}>{t(`accountForm.classifications.${option}`)}</option>
                                            ))}
                                        </select>
                                        {parentId && (
                                            <div className="flex items-center gap-1.5 mt-1.5 px-1">
                                                <div className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" />
                                                <p className="text-[10px] text-amber-600 font-extrabold uppercase tracking-tight">{t('accountForm.inheritedFromParent')}</p>
                                            </div>
                                        )}
                                        {!parentId && hasClassificationConstraint && (
                                            <div className="flex items-center gap-1.5 mt-1.5 px-1">
                                                <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full" />
                                                <p className="text-[10px] text-indigo-600 font-extrabold uppercase tracking-tight">{t('accountForm.setBySourceField')}</p>
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">{t('accountForm.role')}</label>
                                         <select
                                            value={accountRole}
                                            onChange={(e) => setAccountRole(e.target.value as AccountRole)}
                                            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm shadow-sm"
                                            disabled={isUsed || isLocked}
                                        >
                                            {ROLES.map(role => <option key={role} value={role}>{t(`accountForm.roles.${role}`)}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'ACCOUNTING' && (
                            <div className="space-y-6">
                                <div className="mb-8 p-1">
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">
                                        {t('accountForm.accountingTitle', 'Accounting Semantics')}
                                    </h3>
                                    <p className="text-sm text-gray-500 mt-1">{t('accountForm.accountingDescription')}</p>
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-1.5">
                                        <label className="block text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">{t('accountForm.balanceNature')}</label>
                                        <select
                                            value={balanceNature}
                                            onChange={(e) => setBalanceNature(e.target.value as BalanceNature)}
                                            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/50 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all duration-300 text-sm shadow-sm disabled:opacity-50"
                                            disabled={isUsed}
                                        >
                                             {BALANCE_NATURES.map(nature => <option key={nature} value={nature}>{t(`accountForm.balanceNatures.${nature}`)}</option>)}
                                        </select>
                                    </div>
                                    <div className="group space-y-1.5">
                                        <label className="block text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">{t('accountForm.validationRule')}</label>
                                        <select
                                            value={balanceEnforcement}
                                            onChange={(e) => setBalanceEnforcement(e.target.value as BalanceEnforcement)}
                                            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/50 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all duration-300 text-sm shadow-sm disabled:opacity-50"
                                            disabled={accountRole !== 'POSTING'}
                                        >
                                            {BALANCE_ENFORCEMENT.map(rule => <option key={rule} value={rule}>{t(`accountForm.balanceRules.${rule}`)}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-4 pt-2">
                                    <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
                                        <Info className="w-4 h-4 text-blue-500 shrink-0" />
                                        <p className="text-xs text-gray-500">
                                            {t('accountForm.accountingHint', 'Classification defines the core nature of this account and its position on financial statements.')}
                                        </p>
                                    </div>

                                    {(classification === 'REVENUE' || classification === 'EXPENSE') && (
                                        <div className="animate-in fade-in slide-in-from-top-2 duration-300 space-y-1.5">
                                            <label className="block text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">{t('accountForm.plSubgroup')}</label>
                                            <select
                                                value={plSubgroup}
                                                onChange={(e) => setPlSubgroup(e.target.value as PlSubgroup | '')}
                                                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/50 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all duration-300 text-sm shadow-sm"
                                            >
                                                {PL_SUBGROUPS.filter(s => s.forClassification.includes(classification)).map(s => {
                                                    const key = s.value || 'NONE';
                                                    return <option key={key} value={s.value}>{t(`accountForm.subgroups.${key}`)}</option>;
                                                })}
                                            </select>
                                        </div>
                                    )}

                                    {classification === 'EQUITY' && (
                                        <div className="animate-in fade-in slide-in-from-top-2 duration-300 space-y-1.5">
                                            <label className="block text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">{t('accountForm.equitySubgroup')}</label>
                                            <select
                                                value={equitySubgroup}
                                                onChange={(e) => setEquitySubgroup(e.target.value as EquitySubgroup | '')}
                                                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/50 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all duration-300 text-sm shadow-sm"
                                            >
                                                {EQUITY_SUBGROUPS.map(subgroup => {
                                                    const key = subgroup || 'NONE';
                                                    return <option key={key} value={subgroup}>{t(`accountForm.subgroups.${key}`)}</option>;
                                                })}
                                            </select>
                                        </div>
                                    )}

                                    <div className="space-y-1.5">
                                        <label className="block text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">{t('accountForm.cashFlowCategory')}</label>
                                        <select
                                            value={cashFlowCategory}
                                            onChange={(e) => setCashFlowCategory(e.target.value as CashFlowCategory | '')}
                                            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/50 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all duration-300 text-sm shadow-sm"
                                        >
                                            {CASH_FLOW_CATEGORIES.map(category => {
                                                const key = category || 'AUTO';
                                                return <option key={key} value={category}>{t(`accountForm.cashFlowCategories.${key}`)}</option>;
                                            })}
                                        </select>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'CURRENCY' && (
                            <div className="space-y-6">
                                <div className="mb-8 p-1">
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">
                                        {t('accountForm.currencyTitle', 'Currency Policy')}
                                    </h3>
                                    <p className="text-sm text-gray-500 mt-1">{t('accountForm.currencyDescription')}</p>
                                </div>

                                <div className="bg-amber-50/50 dark:bg-amber-900/5 p-4 rounded-xl border border-amber-100 dark:border-amber-900/30">
                                    <div className="flex gap-4">
                                        <div className="p-3 bg-white dark:bg-amber-900/20 rounded-xl shadow-sm self-start">
                                            <Lock className="w-5 h-5 text-amber-500 shadow-sm" />
                                        </div>
                                        <div className="flex-1 space-y-4">
                                            <div className="space-y-1.5">
                                                <label className="block text-xs font-bold text-amber-600 dark:text-amber-500 uppercase tracking-widest">{t('accountForm.policySelection')}</label>
                                                <select
                                                    value={currencyPolicy}
                                                    onChange={(e) => setCurrencyPolicy(e.target.value as CurrencyPolicy)}
                                                    className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-amber-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all text-sm shadow-sm disabled:opacity-50"
                                                    disabled={isUsed || (!parentId) || isParentForeign}
                                                >
                                                    {CURRENCY_POLICIES.map(policy => <option key={policy} value={policy}>{t(`accountForm.currencyPolicies.${policy}`)}</option>)}
                                                </select>
                                            </div>

                                            {(currencyPolicy === 'FIXED' || isParentForeign) && (
                                                <div className="group space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-300">
                                                    <label className="block text-xs font-bold text-amber-600 dark:text-amber-500 uppercase tracking-widest">{t('accountForm.fixedCurrency')}</label>
                                                    <CurrencySelector
                                                        value={fixedCurrencyCode}
                                                        onChange={setFixedCurrencyCode}
                                                        placeholder={t('accountForm.selectCurrency', 'Select Currency...')}
                                                        disabled={isUsed || (!parentId) || isParentForeign}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {(!parentId) && currencyPolicy === 'FIXED' && (
                                    <div className="p-3 bg-blue-50/50 text-blue-600 dark:bg-blue-900/10 dark:text-blue-400 rounded-xl text-xs font-medium flex items-center gap-2">
                                        <Info className="w-4 h-4 shrink-0" />
                                        <span>{t('accountForm.rootCurrencyLocked', { currency: baseCurrency })}</span>
                                    </div>
                                )}
                                {isParentForeign && (
                                    <div className="p-3 bg-indigo-50/50 text-indigo-600 dark:bg-indigo-900/10 dark:text-indigo-400 rounded-xl text-xs font-medium flex items-center gap-2">
                                        <Info className="w-4 h-4 shrink-0" />
                                        <span>{t('accountForm.parentCurrencyEnforced', { currency: parentAccount?.fixedCurrencyCode })}</span>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'GOVERNANCE' && (
                            <div className="space-y-6">
                                <div className="mb-8 p-1">
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">
                                        {t('accountForm.governanceTitle', 'Governance Gates')}
                                    </h3>
                                    <p className="text-sm text-gray-500 mt-1">{t('accountForm.governanceDescription')}</p>
                                </div>

                                <div className="space-y-4">
                                    {/* Financial Approval */}
                                    <div 
                                        className={`p-4 rounded-xl border transition-all cursor-pointer select-none ${requiresApproval ? 'bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800/50' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'}`}
                                        onClick={() => setRequiresApproval(!requiresApproval)}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className={`p-2 rounded-lg transition-colors ${requiresApproval ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-400 dark:bg-gray-700/50'}`}>
                                                <CheckCircle2 className="w-4 h-4" />
                                            </div>
                                            <div className="flex-1">
                                                <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-tight tracking-wide">{t('accountForm.requiresApproval', 'Financial Verification')}</h4>
                                                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                                                    {t('accountForm.requiresApprovalDescription')}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Custody Confirmation */}
                                    <div 
                                        className={`p-4 rounded-xl border transition-all cursor-pointer select-none ${requiresCustodyConfirmation ? 'bg-indigo-50/50 dark:bg-indigo-900/10 border-indigo-200 dark:border-indigo-800/50' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'}`}
                                        onClick={() => setRequiresCustodyConfirmation(!requiresCustodyConfirmation)}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className={`p-2 rounded-lg transition-colors ${requiresCustodyConfirmation ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-400 dark:bg-gray-700/50'}`}>
                                                <UserCheck className="w-4 h-4" />
                                            </div>
                                            <div className="flex-1">
                                                <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-tight tracking-wide">{t('accountForm.requiresCustody', 'Physical Custody Gate')}</h4>
                                                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                                                    {t('accountForm.requiresCustodyDescription')}
                                                </p>
                                                
                                                {requiresCustodyConfirmation && (
                                                    <div 
                                                        className="mt-4 p-4 bg-white dark:bg-gray-800 rounded-xl border border-indigo-100 dark:border-indigo-900/30 animate-in zoom-in-95 duration-300"
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        <label className="block text-[10px] font-bold text-indigo-500 uppercase tracking-widest mb-2">{t('accountForm.assignCustodian')}</label>
                                                        <select
                                                            value={custodianUserId}
                                                            onChange={(e) => setCustodianUserId(e.target.value)}
                                                            required={requiresCustodyConfirmation}
                                                            className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                                                        >
                                                            <option value="">{t('accountForm.selectCustodian')}</option>
                                                            {!isLoadingUsers && companyUsers?.map((u: any) => (
                                                                <option key={u.id} value={u.id}>
                                                                    {u.displayName || u.email || u.id}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </main>
            </div>

            <footer className="px-8 py-5 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/60 flex justify-between items-center shrink-0 z-20">
                <div className="flex items-center gap-3">
                    <div className={`flex h-2 w-2 rounded-full ${isSubmitting ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500'}`} />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                        {isSubmitting ? t('accountForm.processing') : t('accountForm.ready')}
                    </span>
                </div>
                <div className="flex items-center gap-4">
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={isSubmitting}
                        className="px-6 py-2.5 text-sm font-bold text-gray-500 hover:text-gray-900 dark:hover:text-white transition-all transform active:scale-95"
                    >
                        {t('accountForm.discard')}
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="px-8 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg shadow-sm active:scale-[0.98] transition-all flex items-center gap-2 group"
                    >
                        {isSubmitting ? (
                            <>
                                <Spinner size="sm" variant="white" />
                                <span>{t('accountForm.securing')}</span>
                            </>
                        ) : (mode === 'create' ? (
                            <>
                                <CheckCircle2 size={16} className="group-hover:text-indigo-500 transition-colors" />
                                <span>{t('accountForm.createAction')}</span>
                            </>
                        ) : (
                            <>
                                <CheckCircle2 size={16} className="group-hover:text-indigo-500 transition-colors" />
                                <span>{t('accountForm.updateAction')}</span>
                            </>
                        ))}
                    </button>
                </div>
            </footer>
        </form>
    );
};
