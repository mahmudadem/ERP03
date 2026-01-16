import { useState, useEffect } from 'react';
import { 
    Account, 
    NewAccountInput, 
    AccountRole, 
    AccountClassification, 
    BalanceNature, 
    BalanceEnforcement, 
    CurrencyPolicy,
    AccountStatus
} from '../../../api/accounting';
import { CurrencySelector } from './shared/CurrencySelector';
import { useCompanyUsers } from '../../../hooks/useCompanyAdmin';
import { Shield, UserCheck, Lock } from 'lucide-react';

interface AccountFormProps {
    mode: 'create' | 'edit';
    initialValues?: Account;
    accounts?: Account[];
    onSubmit: (data: NewAccountInput) => Promise<any>;
    onCancel: () => void;
}

const CLASSIFICATIONS: { value: AccountClassification; label: string }[] = [
    { value: 'ASSET', label: 'Asset' },
    { value: 'LIABILITY', label: 'Liability' },
    { value: 'EQUITY', label: 'Equity' },
    { value: 'REVENUE', label: 'Revenue' },
    { value: 'EXPENSE', label: 'Expense' },
];

const ROLES: { value: AccountRole; label: string }[] = [
    { value: 'POSTING', label: 'Posting Account (Transaction)' },
    { value: 'HEADER', label: 'Header Account (Folder)' },
];

const BALANCE_NATURES: { value: BalanceNature; label: string }[] = [
    { value: 'DEBIT', label: 'Debit' },
    { value: 'CREDIT', label: 'Credit' },
    { value: 'BOTH', label: 'Both' },
];

const BALANCE_ENFORCEMENT: { value: BalanceEnforcement; label: string }[] = [
    { value: 'WARN_ABNORMAL', label: 'Warn on abnormal balance' },
    { value: 'BLOCK_ABNORMAL', label: 'Block abnormal balance' },
    { value: 'ALLOW_ABNORMAL', label: 'Allow (No check)' },
];

const CURRENCY_POLICIES: { value: CurrencyPolicy; label: string }[] = [
    { value: 'INHERIT', label: 'Inherit from Parent' },
    { value: 'FIXED', label: 'Fixed Currency' },
    { value: 'OPEN', label: 'Any Currency' },
    // { value: 'RESTRICTED', label: 'Restricted (Select permitted)' }, // MVP: Restricted UI not fully implemented
];

export const AccountForm: React.FC<AccountFormProps> = ({
    mode,
    initialValues,
    accounts = [],
    onSubmit,
    onCancel,
}) => {
    // Determine defaults
    const defaultClassification = 'ASSET';
    
    // State
    const [userCode, setUserCode] = useState(initialValues?.userCode || initialValues?.code || '');
    const [name, setName] = useState(initialValues?.name || '');
    const [description, setDescription] = useState(initialValues?.description || '');
    const [status, setStatus] = useState<AccountStatus>(initialValues?.status || (initialValues?.isActive ? 'ACTIVE' : 'INACTIVE') || 'ACTIVE');
    
    const [classification, setClassification] = useState<AccountClassification>(
        (initialValues?.classification as AccountClassification) || 
        (initialValues?.type as AccountClassification) || 
        defaultClassification
    );
    const [accountRole, setAccountRole] = useState<AccountRole>(initialValues?.accountRole || 'POSTING');
    
    const [balanceNature, setBalanceNature] = useState<BalanceNature>(initialValues?.balanceNature || 'DEBIT');
    const [balanceEnforcement, setBalanceEnforcement] = useState<BalanceEnforcement>(initialValues?.balanceEnforcement || 'WARN_ABNORMAL');
    
    const [parentId, setParentId] = useState(initialValues?.parentId || '');
    
    const [currencyPolicy, setCurrencyPolicy] = useState<CurrencyPolicy>(initialValues?.currencyPolicy || 'INHERIT');
    const [fixedCurrencyCode, setFixedCurrencyCode] = useState(initialValues?.fixedCurrencyCode || initialValues?.currency || '');

    const [requiresApproval, setRequiresApproval] = useState(initialValues?.requiresApproval || false);
    const [requiresCustodyConfirmation, setRequiresCustodyConfirmation] = useState(initialValues?.requiresCustodyConfirmation || false);
    const [custodianUserId, setCustodianUserId] = useState(initialValues?.custodianUserId || '');

    const { users: companyUsers, isLoading: isLoadingUsers } = useCompanyUsers();
    
    const [isSubmitting, setIsSubmitting] = useState(false);

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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
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
        <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* --- Section 1: Identification --- */}
            <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-2">Identification</h3>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Account Code</label>
                        <input
                            type="text"
                            value={userCode}
                            onChange={(e) => setUserCode(e.target.value.toUpperCase())}
                            required
                            disabled={isLocked}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 uppercase"
                            placeholder="e.g. 1001"
                        />
                    </div>
                    {mode === 'edit' && initialValues?.systemCode && (
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">System Code (Auto)</label>
                            <input
                                type="text"
                                value={initialValues.systemCode}
                                disabled
                                className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-md"
                            />
                        </div>
                    )}
                </div>
                <div className="mt-4">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Account Name</label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                {mode === 'edit' && (
                     <div className="mt-4">
                        <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
                        <select 
                            value={status} 
                            onChange={(e) => setStatus(e.target.value as AccountStatus)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                            disabled={isLocked}
                        >
                            <option value="ACTIVE">Active</option>
                            <option value="INACTIVE">Inactive</option>
                        </select>
                    </div>
                )}
            </div>

            {/* --- Section 2: Semantics --- */}
            <div className="bg-white p-4 rounded-md border border-gray-200">
                 <h3 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-2">Classification & Role</h3>
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Classification</label>
                        <select
                            value={classification}
                            onChange={(e) => setClassification(e.target.value as AccountClassification)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white disabled:bg-gray-50"
                            disabled={isUsed || isLocked || !!parentId}
                        >
                            {CLASSIFICATIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                        </select>
                        {(isUsed || !!parentId) && (
                            <p className="text-[10px] text-gray-500 mt-1">
                                {isUsed ? 'Cannot change classification of used account' : 'Inherited from parent account'}
                            </p>
                        )}
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Role</label>
                         <select
                            value={accountRole}
                            onChange={(e) => setAccountRole(e.target.value as AccountRole)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                            disabled={isUsed || isLocked}
                        >
                            {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                        </select>
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-4 mt-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Balance Nature</label>
                        <select
                            value={balanceNature}
                            onChange={(e) => setBalanceNature(e.target.value as BalanceNature)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                            disabled={isUsed}
                        >
                             {BALANCE_NATURES.map(n => <option key={n.value} value={n.value}>{n.label}</option>)}
                        </select>
                    </div>
                    {accountRole === 'POSTING' && (
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Validation Rule</label>
                            <select
                                value={balanceEnforcement}
                                onChange={(e) => setBalanceEnforcement(e.target.value as BalanceEnforcement)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                            >
                                {BALANCE_ENFORCEMENT.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
                            </select>
                        </div>
                    )}
                 </div>
            </div>

            {/* --- Section 3: Currency & Hierarchy --- */}
            <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
                 <h3 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-2">Policy & Hierarchy</h3>
                 
                 <div className="mb-4">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Currency Policy</label>
                    <div className="grid grid-cols-2 gap-4">
                        <select
                            value={currencyPolicy}
                            onChange={(e) => setCurrencyPolicy(e.target.value as CurrencyPolicy)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                            disabled={isUsed}
                        >
                            {CURRENCY_POLICIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                        </select>
                        
                        {currencyPolicy === 'FIXED' && (
                            <CurrencySelector
                                value={fixedCurrencyCode}
                                onChange={setFixedCurrencyCode}
                                placeholder="Select Currency..."
                                disabled={isUsed}
                            />
                        )}
                    </div>
                 </div>

                 <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Parent Account</label>
                    <select
                        value={parentId}
                        onChange={(e) => setParentId(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        disabled={isLocked || isUsed} // Often safer to lock parent if used to avoid tree issues
                    >
                        <option value="">(No Parent - Root Level)</option>
                        {(() => {
                            // Find all descendants to prevent circular references
                            const getDescendantIds = (parentId: string, visited = new Set<string>()): string[] => {
                                if (visited.has(parentId)) return [];
                                visited.add(parentId);
                                
                                const children = accounts.filter(a => a.parentId === parentId);
                                return children.reduce((acc, child) => {
                                    return [...acc, child.id, ...getDescendantIds(child.id, visited)];
                                }, [] as string[]);
                            };
                            
                            const descendantIds = mode === 'edit' && initialValues?.id 
                                ? new Set(getDescendantIds(initialValues.id)) 
                                : new Set();

                            return accounts
                                .filter(a => a.id !== initialValues?.id) // Prevent self-parenting
                                .filter(a => !descendantIds.has(a.id)) // Prevent circular parenting (choosing a child as parent)
                                .filter(a => a.classification === classification) // Must match classification
                                .map(a => (
                                    <option key={a.id} value={a.id}>
                                        {a.code} - {a.name}
                                    </option>
                                ));
                        })()}
                    </select>
                    <p className="text-xs text-gray-400 mt-1">Only accounts with matching Classification can be parents.</p>
                 </div>
            </div>

            {/* --- Section 4: Approval & Custody (GATE V1) --- */}
            <div className="bg-blue-50/30 p-4 rounded-md border border-blue-100">
                <div className="flex items-center gap-2 mb-3 border-b border-blue-100 pb-2">
                    <Shield className="w-4 h-4 text-blue-600" />
                    <h3 className="text-sm font-semibold text-blue-800">Governance & Approval Gates</h3>
                </div>

                <div className="space-y-4">
                    {/* Financial Approval Gate */}
                    <div className="flex items-start gap-3">
                        <div className="pt-1">
                            <input
                                type="checkbox"
                                id="requiresApproval"
                                checked={requiresApproval}
                                onChange={(e) => setRequiresApproval(e.target.checked)}
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                        </div>
                        <label htmlFor="requiresApproval" className="flex flex-col cursor-pointer">
                            <span className="text-sm font-medium text-gray-700">Financial Verification Required</span>
                            <span className="text-xs text-gray-500">Enable this to force management approval for all vouchers touching this account (if FA Mode is 'Marked Only').</span>
                        </label>
                    </div>

                    <hr className="border-blue-100" />

                    {/* Custody Confirmation Gate */}
                    <div className="space-y-3">
                        <div className="flex items-start gap-3">
                            <div className="pt-1">
                                <input
                                    type="checkbox"
                                    id="requiresCustodyConfirmation"
                                    checked={requiresCustodyConfirmation}
                                    onChange={(e) => setRequiresCustodyConfirmation(e.target.checked)}
                                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                />
                            </div>
                            <label htmlFor="requiresCustodyConfirmation" className="flex flex-col cursor-pointer">
                                <span className="text-sm font-medium text-gray-700">Custody Confirmation Required</span>
                                <span className="text-xs text-gray-500">Ensures the physical custodian of this asset/fund confirms the transaction.</span>
                            </label>
                        </div>

                        {requiresCustodyConfirmation && (
                            <div className="ml-7 p-3 bg-white rounded border border-blue-100">
                                <label className="block text-xs font-medium text-blue-600 mb-1 flex items-center gap-1">
                                    <UserCheck className="w-3 h-3" />
                                    Designated Custodian User
                                </label>
                                <select
                                    value={custodianUserId}
                                    onChange={(e) => setCustodianUserId(e.target.value)}
                                    required={requiresCustodyConfirmation}
                                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="">(Select Custodian...)</option>
                                    {!isLoadingUsers && companyUsers?.map((u: any) => (
                                        <option key={u.id} value={u.id}>
                                            {u.displayName || u.email || u.id}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-[10px] text-gray-400 mt-1">Only this user can satisfy the Custody gate for transactions on this account.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex gap-3 pt-4 justify-end">
                <button
                    type="button"
                    onClick={onCancel}
                    disabled={isSubmitting}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 disabled:opacity-50"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                    {isSubmitting ? 'Saving...' : mode === 'create' ? 'Create Account' : 'Save Changes'}
                </button>
            </div>
        </form>
    );
};
