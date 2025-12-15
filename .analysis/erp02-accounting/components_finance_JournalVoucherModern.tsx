import React, { useState, useEffect, useRef } from 'react';
import { Translation, FinancialVoucher, VoucherLineItem, VoucherStatus, User, Account, PaymentMethod, VoucherType, SystemSettings } from '../../types';
import { useTransactionForm } from '../../hooks/useTransactionForm';
import AccountSelectionModal from './AccountSelectionModal';
import { TrashIcon } from '../Icons';

type Props = {
    t: Translation;
    onClose: () => void;
    setCloseHandler?: (handler: () => void) => void;
    onSave: (voucher: FinancialVoucher) => Promise<string>;
    voucher: FinancialVoucher | null;
    userProfile: User | null;
    voucherType: VoucherType;
    companyId: string;
    settings?: SystemSettings | null;
    windowId?: string;
    isActive?: boolean;
}

const JournalVoucherModern: React.FC<Props> = (props) => {
    const { t, onClose, setCloseHandler, voucher, userProfile, voucherType } = props;

    const {
        formData,
        setFormData,
        accounts,
        currencies,
        systemRate,
        rateSource,
        error,
        setError,
        balanceWarnings,
        isAccountModalOpen,
        setIsAccountModalOpen,
        isCommentsModalOpen,
        setIsCommentsModalOpen,
        isSubmitting,
        transactionCurrency,
        setTransactionCurrency,
        exchangeRate,
        setExchangeRate,
        baseCurrency,
        availableCurrencyCodes,
        selectableAccounts,
        currencyInfo,
        handleOpenAccountModal,
        handleAccountSelect,
        handleInputChange,
        handlePaymentDetailsChange,
        handleLineChange,
        handleExchangeRateChange,
        handleRefreshRate,
        handleAddLine,
        handleRemoveLine,
        handleAmountBlur,
        handleSave,
        handleSubmitForApproval,
        handleApprove,
        handleLock,
        handleReturnToDraft,
        canSubmit,
        canApprove,
        canLock,
        canReturnToDraft,
        isReadOnly,
        rawTotals,
        convertedTotals,
        statusBadgeClass
    } = useTransactionForm({ ...props, isOpen: true });

    // Track if form has been modified
    const [showCloseConfirm, setShowCloseConfirm] = useState(false);
    const initialFormData = useRef<string>('');
    const isInitialized = useRef(false);

    useEffect(() => {
        // Store initial form data after it's loaded (not on first render when it's empty)
        if (!isInitialized.current && formData && formData.lines && formData.lines.length > 0) {
            initialFormData.current = JSON.stringify(formData);
            isInitialized.current = true;
        }
    }, [formData]);

    const hasUnsavedChanges = () => {
        if (!isInitialized.current) return false;

        const current = JSON.parse(JSON.stringify(formData));
        const initial = JSON.parse(initialFormData.current);

        // Remove fields that change automatically (timestamps, generated IDs)
        const cleanData = (data: any) => {
            const cleaned = { ...data };
            delete cleaned.createdAt;
            delete cleaned.updatedAt;
            delete cleaned.auditLog;
            // Clean line IDs as they might be auto-generated
            if (cleaned.lines) {
                cleaned.lines = cleaned.lines.map((line: any) => {
                    const { id, ...rest } = line;
                    return rest;
                });
            }
            return cleaned;
        };

        const currentCleaned = cleanData(current);
        const initialCleaned = cleanData(initial);

        return JSON.stringify(currentCleaned) !== JSON.stringify(initialCleaned);
    };

    const handleCloseAttempt = React.useCallback(() => {
        if (hasUnsavedChanges() && !isReadOnly) {
            setShowCloseConfirm(true);
        } else {
            onClose();
        }
    }, [formData, isReadOnly, onClose]);

    const handleConfirmClose = () => {
        setShowCloseConfirm(false);
        onClose();
    };

    // Submit confirmation state
    const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);

    const validateVoucher = () => {
        // Check if there's any data entered
        const hasData = formData.lines?.some(line =>
            line.accountId || line.amount > 0 || line.notes
        );

        if (!hasData) {
            return 'Nothing to submit. Please enter transaction details.';
        }

        // Check if debit equals credit
        if (Math.abs(rawTotals.debit - rawTotals.credit) > 0.01) {
            return 'Debit and Credit totals must be equal.';
        }

        // Check if all lines have accounts
        const missingAccounts = formData.lines?.some(line =>
            line.amount > 0 && !line.accountId
        );

        if (missingAccounts) {
            return 'All transaction lines must have an account selected.';
        }

        return null;
    };

    const handleSubmitAttempt = () => {
        const validationError = validateVoucher();

        if (validationError) {
            setSubmitError(validationError);
            return;
        }

        // Show confirmation dialog
        setShowSubmitConfirm(true);
    };

    const handleConfirmSubmit = async () => {
        setShowSubmitConfirm(false);
        setSubmitError(null);
        await handleSubmitForApproval();
    };

    // Register our close handler with WindowFrame
    useEffect(() => {
        if (setCloseHandler) {
            setCloseHandler(handleCloseAttempt);
        }
    }, [setCloseHandler, handleCloseAttempt]);

    // Account autocomplete state
    const [accountSearchTerms, setAccountSearchTerms] = useState<{ [lineId: string]: string }>({});
    const [showSuggestions, setShowSuggestions] = useState<{ [lineId: string]: boolean }>({});
    const [selectedLineId, setSelectedLineId] = useState<string | null>(null);

    const getAccountSuggestions = (searchTerm: string) => {
        if (!searchTerm || searchTerm.length < 1) return [];

        const term = searchTerm.toLowerCase();
        return selectableAccounts
            .filter(account =>
                account.name.toLowerCase().includes(term) ||
                account.code.toLowerCase().includes(term)
            )
            .slice(0, 5); // Limit to 5 suggestions
    };

    const handleAccountInputChange = (lineId: string, value: string) => {
        setAccountSearchTerms(prev => ({ ...prev, [lineId]: value }));
        setShowSuggestions(prev => ({ ...prev, [lineId]: true }));

        // Auto-select if exact match
        const exactMatch = selectableAccounts.find(acc =>
            acc.code.toLowerCase() === value.toLowerCase() ||
            acc.name.toLowerCase() === value.toLowerCase()
        );

        if (exactMatch) {
            handleAccountSelect(exactMatch);
            setShowSuggestions(prev => ({ ...prev, [lineId]: false }));
        }
    };

    const handleAccountInputBlur = (lineId: string) => {
        // Delay to allow click on suggestion
        setTimeout(() => {
            setShowSuggestions(prev => ({ ...prev, [lineId]: false }));
        }, 200);
    };

    const handleSuggestionSelect = (lineId: string, account: Account) => {
        setAccountSearchTerms(prev => ({ ...prev, [lineId]: '' }));
        setShowSuggestions(prev => ({ ...prev, [lineId]: false }));
        handleAccountSelect(account);
    };

    const handleOpenAccountModalWithSearch = (lineId: string) => {
        setSelectedLineId(lineId);
        handleOpenAccountModal(lineId);
    };

    const formatDateTime = (value?: any) => {
        if (!value) return '';
        try {
            if (value.toDate) {
                return value.toDate().toLocaleString();
            }
            if (value.seconds) {
                return new Date(value.seconds * 1000).toLocaleString();
            }
            return new Date(value).toLocaleString();
        } catch {
            return String(value);
        }
    };

    const currentTime = formData.createdAt ? formatDateTime(formData.createdAt) : new Date().toLocaleString();

    return (
        <div className="flex flex-col h-full bg-white dark:bg-gray-900 select-none text-slate-800 dark:text-slate-200 font-sans">
            {/* Header Bar - Fully Compacted Single Line */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 dark:border-gray-700 bg-gray-50/30 dark:bg-gray-800/50">
                <div className="flex items-center gap-3">
                    <h1 className="text-base font-bold text-slate-700 dark:text-slate-200 leading-none">
                        Legacy Journal Entry
                    </h1>
                    <span className={`px-1.5 py-0.5 text-[10px] font-bold uppercase rounded border tracking-wide ${formData.status === VoucherStatus.PENDING ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                            formData.status === VoucherStatus.APPROVED ? 'bg-green-100 text-green-800 border-green-200' :
                                formData.status === VoucherStatus.DRAFT ? 'bg-gray-100 text-gray-500 border-gray-200' :
                                    'bg-gray-100 text-gray-500 border-gray-200'
                        }`}>
                        {formData.status || 'PENDING'}
                    </span>
                    <span className="text-[10px] text-gray-400 font-medium border-l border-gray-300 pl-3 ml-1 hidden md:inline-block">
                        Created: {currentTime}
                    </span>
                </div>

                <div className="flex items-center gap-1 bg-white dark:bg-gray-800 p-0.5 rounded border border-gray-100 dark:border-gray-700 shadow-sm">
                    <button className="p-1 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded transition-colors" title="Attach">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                        </svg>
                    </button>
                    <div className="w-px h-3 bg-gray-200 dark:bg-gray-600"></div>
                    <button className="p-1 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded transition-colors" title="Download">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Form Grid - Consolidated to 6 columns in one row */}
            <div className="px-4 py-3 grid grid-cols-1 md:grid-cols-6 gap-4 bg-white dark:bg-gray-900">
                <div className="space-y-0.5">
                    <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Currency</label>
                    <div className="relative">
                        <select
                            value={transactionCurrency}
                            onChange={(e) => {
                                const val = (e.target.value || '').toUpperCase();
                                setTransactionCurrency(val);
                                setExchangeRate(val === baseCurrency ? 1 : exchangeRate || 1);
                            }}
                            className="w-full p-1.5 border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-800 text-xs dark:text-gray-200 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-sm appearance-none pr-6"
                        >
                            {availableCurrencyCodes.map(code => (
                                <option key={code} value={code}>{code}</option>
                            ))}
                        </select>
                        <svg className="absolute top-2 right-2 text-gray-400 pointer-events-none w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </div>
                </div>

                <div className="space-y-0.5">
                    <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Rate</label>
                    <input
                        type="number"
                        step="any"
                        value={exchangeRate}
                        onChange={(e) => setExchangeRate(parseFloat(e.target.value) || 0)}
                        className="w-full p-1.5 border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-800 text-xs dark:text-gray-200 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-sm"
                        disabled={transactionCurrency === baseCurrency}
                    />
                </div>

                <div className="space-y-0.5">
                    <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Voucher No.</label>
                    <input
                        type="text"
                        readOnly
                        value={formData.voucherNo || 'Pending...'}
                        className="w-full p-1.5 border border-gray-200 dark:border-gray-700 rounded bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs shadow-sm"
                    />
                </div>

                <div className="space-y-0.5">
                    <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Date</label>
                    <div className="relative">
                        <input
                            type="date"
                            name="date"
                            disabled={isReadOnly}
                            value={formData.date || ''}
                            onChange={handleInputChange}
                            className="w-full p-1.5 border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-800 text-xs dark:text-gray-200 focus:ring-1 focus:ring-indigo-500 outline-none shadow-sm"
                        />
                    </div>
                </div>

                <div className="space-y-0.5">
                    <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Reference</label>
                    <input
                        type="text"
                        name="referenceDoc"
                        disabled={isReadOnly}
                        value={formData.referenceDoc || ''}
                        onChange={handleInputChange}
                        className="w-full p-1.5 border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-800 text-xs dark:text-gray-200 focus:ring-1 focus:ring-indigo-500 outline-none shadow-sm"
                    />
                </div>

                <div className="space-y-0.5">
                    <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Payment</label>
                    <div className="relative">
                        <select
                            name="paymentMethod"
                            disabled={isReadOnly}
                            value={formData.paymentMethod || ''}
                            onChange={handleInputChange}
                            className="w-full p-1.5 border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-800 text-xs dark:text-gray-200 focus:ring-1 focus:ring-indigo-500 outline-none shadow-sm appearance-none pr-6"
                        >
                            <option value="">N/A</option>
                            {Object.values(PaymentMethod).map(m => (
                                <option key={m} value={m}>{t[`paymentMethod${m.replace(/\s/g, '')}`] || m}</option>
                            ))}
                        </select>
                        <svg className="absolute top-2 right-2 text-gray-400 pointer-events-none w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </div>
                </div>

                {/* Description on separate row */}
                <div className="md:col-span-6 space-y-0.5">
                    <div className="flex justify-between items-center">
                        <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Description</label>
                        <button className="flex items-center gap-1 text-[9px] text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 px-1.5 py-0.5 rounded transition-colors">
                            <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                            </svg>
                            Auto-Fill
                        </button>
                    </div>
                    <input
                        type="text"
                        name="description"
                        disabled={isReadOnly}
                        value={formData.description || ''}
                        onChange={handleInputChange}
                        className="w-full p-1.5 border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-800 text-xs dark:text-gray-200 focus:ring-1 focus:ring-indigo-500 outline-none shadow-sm"
                        placeholder="Enter transaction details..."
                    />
                </div>
            </div>

            {/* Table Section */}
            <div className="flex-1 px-4 py-2 overflow-auto">
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-x-auto shadow-sm">
                    <table className="w-full text-sm min-w-[700px]">
                        <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 font-medium">
                            <tr>
                                <th className="p-2 text-start w-10 text-xs">#</th>
                                <th className="p-2 text-start text-xs">Account</th>
                                <th className="p-2 text-start w-28 text-xs">Debit</th>
                                <th className="p-2 text-start w-28 text-xs">Credit</th>
                                <th className="p-2 text-start text-xs">Notes</th>
                                <th className="p-2 w-8"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {(formData.lines || []).map((line, index) => {
                                const account = accounts.find(a => a.id === line.accountId);
                                return (
                                    <tr key={line.id} className="group hover:bg-slate-50 dark:hover:bg-gray-800 transition-colors">
                                        <td className="p-1.5 text-center text-gray-400 dark:text-gray-500 text-[10px]">{index + 1}</td>
                                        <td className="p-1.5 relative">
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    disabled={isReadOnly}
                                                    value={accountSearchTerms[line.id] || (account ? `${account.code} - ${account.name}` : '')}
                                                    onChange={(e) => handleAccountInputChange(line.id, e.target.value)}
                                                    onBlur={() => handleAccountInputBlur(line.id)}
                                                    onFocus={() => setShowSuggestions(prev => ({ ...prev, [line.id]: true }))}
                                                    placeholder="Type account name or code..."
                                                    className="w-full p-1 pr-7 border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-800 text-xs dark:text-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => handleOpenAccountModalWithSearch(line.id)}
                                                    disabled={isReadOnly}
                                                    className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                                                    title="Search accounts"
                                                >
                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                                    </svg>
                                                </button>

                                                {/* Suggestions Dropdown */}
                                                {showSuggestions[line.id] && accountSearchTerms[line.id] && (
                                                    <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                                        {getAccountSuggestions(accountSearchTerms[line.id]).map(acc => (
                                                            <div
                                                                key={acc.id}
                                                                onMouseDown={() => handleSuggestionSelect(line.id, acc)}
                                                                className="px-3 py-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 cursor-pointer border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                                                            >
                                                                <div className="text-xs font-medium text-gray-900 dark:text-gray-100">{acc.code} - {acc.name}</div>
                                                                <div className="text-[10px] text-gray-500 dark:text-gray-400">{acc.type}</div>
                                                            </div>
                                                        ))}
                                                        {getAccountSuggestions(accountSearchTerms[line.id]).length === 0 && (
                                                            <div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 text-center">
                                                                No matches. Click search icon for full list.
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-1.5">
                                            <input
                                                type="number"
                                                step="any"
                                                disabled={isReadOnly}
                                                value={line.type === 'Debit' ? (transactionCurrency !== 'TRY' ? (line.fxAmount ?? '') : (line.amount === 0 ? '' : line.amount)) : ''}
                                                onChange={e => {
                                                    const val = parseFloat(e.target.value) || 0;
                                                    const baseVal = transactionCurrency !== 'TRY' ? val * exchangeRate : val;
                                                    handleLineChange(line.id, { type: 'Debit', amount: baseVal, fxAmount: transactionCurrency !== 'TRY' ? val : undefined });
                                                }}
                                                onBlur={() => handleAmountBlur(line)}
                                                placeholder="---"
                                                className="w-full p-1 border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-800 text-xs dark:text-gray-200 text-end focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                                            />
                                        </td>
                                        <td className="p-1.5">
                                            <input
                                                type="number"
                                                step="any"
                                                disabled={isReadOnly}
                                                value={line.type === 'Credit' ? (transactionCurrency !== 'TRY' ? (line.fxAmount ?? '') : (line.amount === 0 ? '' : line.amount)) : ''}
                                                onChange={e => {
                                                    const val = parseFloat(e.target.value) || 0;
                                                    const baseVal = transactionCurrency !== 'TRY' ? val * exchangeRate : val;
                                                    handleLineChange(line.id, { type: 'Credit', amount: baseVal, fxAmount: transactionCurrency !== 'TRY' ? val : undefined });
                                                }}
                                                onBlur={() => handleAmountBlur(line)}
                                                placeholder="---"
                                                className="w-full p-1 border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-800 text-xs dark:text-gray-200 text-end focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                                            />
                                        </td>
                                        <td className="p-1.5">
                                            <input
                                                type="text"
                                                disabled={isReadOnly}
                                                value={line.notes || ''}
                                                onChange={e => handleLineChange(line.id, { notes: e.target.value })}
                                                className="w-full p-1 border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-800 text-xs dark:text-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                                            />
                                        </td>
                                        <td className="p-1.5 text-center">
                                            {!isReadOnly && (formData.lines?.length || 0) > 2 && (
                                                <button
                                                    onClick={() => handleRemoveLine(line.id)}
                                                    className="text-gray-300 dark:text-gray-600 hover:text-red-500 transition-colors"
                                                >
                                                    <TrashIcon />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    <button
                        onClick={handleAddLine}
                        disabled={isReadOnly}
                        className="w-full py-1.5 text-center text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors border-t border-indigo-100 dark:border-gray-700"
                    >
                        + Add Line
                    </button>
                </div>
            </div>

            {/* Footer Section - Compacted */}
            <div className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 p-2">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    {/* Totals - Compacted */}
                    <div className="flex gap-6 items-center">
                        <div className="flex items-baseline gap-2">
                            <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase">Total Debit</span>
                            <span className="text-base font-bold text-slate-800 dark:text-slate-200">{rawTotals.debit.toFixed(2)}</span>
                        </div>
                        <div className="h-4 w-px bg-gray-300 dark:bg-gray-600"></div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase">Total Credit</span>
                            <span className="text-base font-bold text-slate-800 dark:text-slate-200">{rawTotals.credit.toFixed(2)}</span>
                        </div>
                    </div>

                    {/* Action Buttons - Compacted */}
                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <button
                            onClick={handleCloseAttempt}
                            className="px-3 py-1 rounded bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => handleSave(VoucherStatus.DRAFT)}
                            disabled={isSubmitting || isReadOnly}
                            className="px-3 py-1 rounded bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm disabled:opacity-50"
                        >
                            Save as Draft
                        </button>
                        {canSubmit && (
                            <button
                                onClick={handleSubmitAttempt}
                                disabled={isSubmitting}
                                className="px-4 py-1 rounded bg-indigo-600 dark:bg-indigo-700 border border-indigo-700 dark:border-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors shadow-sm flex-1 md:flex-none whitespace-nowrap disabled:opacity-50"
                            >
                                Submit for Approval
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Confirmation Modal */}
            {showCloseConfirm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] pointer-events-auto">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 p-6 max-w-md w-full mx-4">
                        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-2">
                            {t.unsavedChanges || 'Unsaved Changes'}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                            {t.unsavedChangesMessage || 'You have unsaved changes. Are you sure you want to close without saving?'}
                        </p>
                        <div className="flex items-center gap-3 justify-end">
                            <button
                                onClick={() => setShowCloseConfirm(false)}
                                className="px-4 py-2 rounded bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                            >
                                {t.cancel || 'Cancel'}
                            </button>
                            <button
                                onClick={handleConfirmClose}
                                className="px-4 py-2 rounded bg-red-600 dark:bg-red-700 border border-red-700 dark:border-red-600 text-white text-sm font-medium hover:bg-red-700 dark:hover:bg-red-600 transition-colors"
                            >
                                {t.closeWithoutSaving || 'Close Without Saving'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Submit Confirmation Modal */}
            {showSubmitConfirm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] pointer-events-auto">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 p-6 max-w-md w-full mx-4">
                        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-2">
                            {t.confirmSubmit || 'Confirm Submission'}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                            {t.confirmSubmitMessage || 'Are you sure you want to submit this voucher for approval? This action cannot be undone.'}
                        </p>
                        <div className="flex items-center gap-3 justify-end">
                            <button
                                onClick={() => setShowSubmitConfirm(false)}
                                className="px-4 py-2 rounded bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                            >
                                {t.cancel || 'Cancel'}
                            </button>
                            <button
                                onClick={handleConfirmSubmit}
                                className="px-4 py-2 rounded bg-indigo-600 dark:bg-indigo-700 border border-indigo-700 dark:border-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors"
                            >
                                {t.submit || 'Submit'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Error Modal */}
            {submitError && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] pointer-events-auto">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 p-6 max-w-md w-full mx-4">
                        <h3 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-2">
                            {t.validationError || 'Validation Error'}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                            {submitError}
                        </p>
                        <div className="flex items-center gap-3 justify-end">
                            <button
                                onClick={() => setSubmitError(null)}
                                className="px-4 py-2 rounded bg-indigo-600 dark:bg-indigo-700 border border-indigo-700 dark:border-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors"
                            >
                                {t.ok || 'OK'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <AccountSelectionModal
                isOpen={isAccountModalOpen}
                onClose={() => setIsAccountModalOpen(false)}
                onSelect={handleAccountSelect}
                accounts={selectableAccounts}
                t={t}
            />
        </div>
    );
};

export default JournalVoucherModern;
