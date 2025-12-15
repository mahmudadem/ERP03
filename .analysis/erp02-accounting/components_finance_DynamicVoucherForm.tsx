// components/finance/DynamicVoucherForm.tsx
/**
 * STEP 2 + STEP 6: Dynamic Voucher Form Component
 * 
 * Supports TWO modes based on voucherType.mode:
 * 
 * 1. SINGLE-LINE MODE (default):
 *    - Simple form with header fields only
 *    - Fixed debit/credit accounts per journal template rules
 *    - Single amount drives both sides
 * 
 * 2. MULTI-LINE MODE:
 *    - Header fields shown above table
 *    - Editable line-entry table with columns from lineFields
 *    - Add/remove rows dynamically
 *    - Real-time balance calculation (Debit/Credit totals)
 *    - Field-based journal entry conversion using fromField mapping
 */

import React, { useState, useMemo } from 'react';
import { VoucherTypeConfig, VoucherTypeField, VoucherLineFieldConfig, FinancialVoucher, VoucherLineItem, VoucherStatus, PaymentMethod, Account } from '../../types';
import { saveVoucher } from '../../services/finance.service';
import AccountSelectionModal from './AccountSelectionModal';

interface DynamicVoucherFormProps {
    companyId: string;
    voucherType: VoucherTypeConfig;
    userProfile: any;
    accounts: Account[];
    onSuccess?: () => void;
    onClose?: () => void;
    uiMode?: 'classic' | 'windows';
    t: any;
}

interface FormData {
    [key: string]: any;
}

interface FormErrors {
    [key: string]: string;
}

// STEP 6: Line entry for multi-line mode
interface LineEntry {
    id: number;
    accountId: string;
    side: 'Debit' | 'Credit';
    amount: number;
    currency?: string;
    notes?: string;
    costCenterId?: string;
    ref?: string;
}

const DynamicVoucherForm: React.FC<DynamicVoucherFormProps> = ({
    companyId,
    voucherType,
    userProfile,
    accounts,
    onSuccess,
    onClose,
    uiMode = 'classic',
    t
}) => {
    // Form data (header fields)
    const [formData, setFormData] = useState<FormData>({});
    const [formErrors, setFormErrors] = useState<FormErrors>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Account modal state
    const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
    const [currentAccountField, setCurrentAccountField] = useState<string | null>(null);
    const [currentLineIndex, setCurrentLineIndex] = useState<number | null>(null);

    // STEP 6: Multi-line state
    const [lines, setLines] = useState<LineEntry[]>([
        { id: 1, accountId: '', side: 'Debit', amount: 0 },
        { id: 2, accountId: '', side: 'Credit', amount: 0 }
    ]);
    const [nextLineId, setNextLineId] = useState(3);

    // Determine mode (default to singleLine for backwards compatibility)
    const mode = voucherType.mode || 'singleLine';

    // Sort and filter visible header fields
    const visibleFields = useMemo(() => {
        return voucherType.fields
            .filter(field => field.visible)
            .sort((a, b) => a.order - b.order);
    }, [voucherType.fields]);

    // STEP 6: Sort and filter visible line fields (for multi-line mode)
    const visibleLineFields = useMemo(() => {
        if (mode !== 'multiLine' || !voucherType.lineFields) return [];
        return voucherType.lineFields
            .filter(field => field.visible)
            .sort((a, b) => a.order - b.order);
    }, [mode, voucherType.lineFields]);

    // STEP 6: Calculate totals
    const totals = useMemo(() => {
        const debitTotal = lines
            .filter(line => line.side === 'Debit')
            .reduce((sum, line) => sum + (parseFloat(String(line.amount)) || 0), 0);

        const creditTotal = lines
            .filter(line => line.side === 'Credit')
            .reduce((sum, line) => sum + (parseFloat(String(line.amount)) || 0), 0);

        return {
            debit: debitTotal,
            credit: creditTotal,
            difference: debitTotal - creditTotal
        };
    }, [lines]);

    // Get field label in current language
    const getFieldLabel = (field: VoucherTypeField | VoucherLineFieldConfig): string => {
        const lang = (t.language || 'en') as 'ar' | 'en' | 'tr';
        if (field.label && field.label[lang]) {
            return field.label[lang];
        }

        // Default labels
        const defaultLabels: { [key: string]: string } = {
            amount: t.formAmount || 'Amount',
            date: t.tableTransactionDate || 'Date',
            description: t.description || 'Description',
            notes: t.notes || 'Notes',
            currency: t.currency || 'Currency',
            costCenter: t.costCenter || 'Cost Center',
            account: t.account || 'Account',
            referenceDoc: t.referenceDoc || 'Reference Document',
            paymentMethod: t.paymentMethod || 'Payment Method',
            side: t.side || 'Side',
            ref: t.reference || 'Reference'
        };

        return defaultLabels[field.id] || field.id;
    };

    // Handle header field change
    const handleChange = (fieldId: string, value: any) => {
        setFormData(prev => ({ ...prev, [fieldId]: value }));
        if (formErrors[fieldId]) {
            setFormErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[fieldId];
                return newErrors;
            });
        }
    };

    // STEP 6: Handle line field change
    const handleLineChange = (lineIndex: number, fieldId: string, value: any) => {
        setLines(prev => prev.map((line, idx) =>
            idx === lineIndex ? { ...line, [fieldId]: value } : line
        ));
    };

    // STEP 6: Add new line
    const handleAddLine = () => {
        const constraints = voucherType.lineConstraints;
        if (constraints?.maxRows && lines.length >= constraints.maxRows) {
            alert(t.maxRowsReached || `Maximum ${constraints.maxRows} lines allowed`);
            return;
        }

        setLines(prev => [...prev, {
            id: nextLineId,
            accountId: '',
            side: 'Debit',
            amount: 0
        }]);
        setNextLineId(prev => prev + 1);
    };

    // STEP 6: Remove line
    const handleRemoveLine = (lineIndex: number) => {
        const constraints = voucherType.lineConstraints;
        if (constraints?.minRows && lines.length <= constraints.minRows) {
            alert(t.minRowsRequired || `Minimum ${constraints.minRows} lines required`);
            return;
        }

        setLines(prev => prev.filter((_, idx) => idx !== lineIndex));
    };

    // Open account modal (header or line)
    const handleOpenAccountModal = (fieldId: string, lineIndex?: number) => {
        setCurrentAccountField(fieldId);
        setCurrentLineIndex(lineIndex !== undefined ? lineIndex : null);
        setIsAccountModalOpen(true);
    };

    // Handle account selection
    const handleAccountSelect = (account: Account) => {
        if (currentLineIndex !== null) {
            // Line account selection
            handleLineChange(currentLineIndex, 'accountId', account.id);
        } else if (currentAccountField) {
            // Header account selection
            handleChange(currentAccountField, account.id);
        }
        setIsAccountModalOpen(false);
        setCurrentAccountField(null);
        setCurrentLineIndex(null);
    };

    // Validate form
    const validateForm = (): boolean => {
        const errors: FormErrors = {};

        // Validate header fields
        visibleFields.forEach(field => {
            if (field.required) {
                const value = formData[field.id];
                if (value === undefined || value === null || value === '') {
                    errors[field.id] = `${getFieldLabel(field)} ${t.isRequired || 'is required'}`;
                }
            }
        });

        // STEP 6: Validate lines for multi-line mode
        if (mode === 'multiLine') {
            const constraints = voucherType.lineConstraints;

            // Check min/max rows
            if (constraints?.minRows && lines.length < constraints.minRows) {
                errors._form = `${t.minRowsRequired || 'Minimum'} ${constraints.minRows} ${t.linesRequired || 'lines required'}`;
            }

            // Validate each line
            lines.forEach((line, idx) => {
                visibleLineFields.forEach(field => {
                    if (field.required) {
                        const value = field.id === 'account' ? line.accountId : (line as any)[field.id];
                        if (value === undefined || value === null || value === '') {
                            errors[`line_${idx}_${field.id}`] = `${getFieldLabel(field)} ${t.isRequired || 'required'}`;
                        }
                    }
                });
            });

            // Check balanced entries
            if (constraints?.requireBalancedLines && Math.abs(totals.difference) > 0.01) {
                errors._form = t.entriesNotBalanced || 'Entries must be balanced (Debit = Credit)';
            }
        }

        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    // Convert form data to Journal Entry
    const convertToJournalEntry = (): FinancialVoucher => {
        const voucherLines: VoucherLineItem[] = [];
        let lineId = 1;

        if (mode === 'singleLine') {
            // SINGLE-LINE MODE: Use existing logic
            const amount = parseFloat(formData.amount || '0');

            voucherType.journalTemplate.rules.forEach(rule => {
                let accountId: string | null = null;

                if (rule.accountSource === 'fixed') {
                    accountId = rule.accountId || null;
                } else if (rule.accountSource === 'userSelect') {
                    accountId = formData.account || null;
                }

                if (accountId) {
                    voucherLines.push({
                        id: lineId++,
                        accountId,
                        type: rule.side === 'debit' ? 'Debit' : 'Credit',
                        amount: amount,
                        notes: formData.notes || formData.description || ''
                    });
                }
            });
        } else {
            // MULTI-LINE MODE: Convert lines using fromField mapping
            // Iterate through each table row
            lines.forEach(line => {
                // Apply each rule to the line
                voucherType.journalTemplate.rules.forEach(rule => {
                    // Determine Side
                    let type: 'Debit' | 'Credit' | null = null;
                    if (rule.side === 'debit') type = 'Debit';
                    else if (rule.side === 'credit') type = 'Credit';
                    else if (rule.side === 'fromField' && rule.sideFieldId) {
                        const val = (line as any)[rule.sideFieldId];
                        if (val === 'Debit' || val === 'Credit') type = val;
                    }

                    // Determine Account
                    let accountId: string | null = null;
                    if (rule.accountSource === 'fixed') accountId = rule.accountId || null;
                    else if (rule.accountSource === 'fromField' && rule.accountFieldId) {
                        accountId = (line as any)[rule.accountFieldId] || null;
                    }
                    // Note: 'userSelect' doesn't make sense for multi-line rows unless we have a specific logic, 
                    // but usually it's 'fromField' pointing to the account column.

                    // Determine Amount
                    let amount = 0;
                    if (rule.amountSource === 'fromField' && rule.amountFieldId) {
                        amount = parseFloat(String((line as any)[rule.amountFieldId])) || 0;
                    } else {
                        // Fallback to standard 'amount' field if not specified
                        amount = parseFloat(String(line.amount)) || 0;
                    }

                    if (type && accountId && amount) {
                        voucherLines.push({
                            id: lineId++,
                            accountId,
                            type,
                            amount,
                            notes: line.notes || '',
                            costCenterId: line.costCenterId
                        });
                    }
                });
            });
        }

        // Create voucher object
        const voucher: FinancialVoucher = {
            id: `temp-${Date.now()}`,
            voucherNo: null,
            date: formData.date || new Date().toISOString().split('T')[0],
            description: formData.description || `${voucherType.name.en} Transaction`,
            type: voucherType.name.en as any,
            referenceDoc: formData.referenceDoc || '',
            currency: formData.currency || 'USD',
            paymentMethod: formData.paymentMethod || null,
            status: VoucherStatus.DRAFT,
            lines: voucherLines,
            createdBy: userProfile?.id || null,
            createdAt: Date.now()
        };

        return voucher;
    };

    // Handle form submission
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateForm()) {
            return;
        }

        setIsSubmitting(true);

        try {
            const journalEntry = convertToJournalEntry();
            await saveVoucher(companyId, journalEntry, userProfile, accounts);

            console.log('Voucher saved successfully');

            if (onSuccess) {
                onSuccess();
            }

            // Reset form
            setFormData({});
            setFormErrors({});
            if (mode === 'multiLine') {
                setLines([
                    { id: 1, accountId: '', side: 'Debit', amount: 0 },
                    { id: 2, accountId: '', side: 'Credit', amount: 0 }
                ]);
                setNextLineId(3);
            }

        } catch (error: any) {
            console.error('Error saving voucher:', error);
            setFormErrors({ _form: error.message || 'Failed to save voucher' });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Render header field based on type
    const renderField = (field: VoucherTypeField) => {
        const label = getFieldLabel(field);
        const value = formData[field.id] || field.defaultValue || '';
        const error = formErrors[field.id];

        switch (field.id) {
            case 'amount':
                return (
                    <div key={field.id} className="space-y-1">
                        <label className="block text-sm font-medium text-gray-900 dark:text-white">
                            {label}
                            {field.required && <span className="text-red-500 ml-1">*</span>}
                        </label>
                        <input
                            type="number"
                            step="0.01"
                            value={value}
                            onChange={(e) => handleChange(field.id, e.target.value)}
                            onWheel={(e) => e.currentTarget.blur()}
                            className="w-full bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        />
                        {error && <p className="text-sm text-red-500">{error}</p>}
                    </div>
                );

            case 'date':
                return (
                    <div key={field.id} className="space-y-1">
                        <label className="block text-sm font-medium text-gray-900 dark:text-white">
                            {label}
                            {field.required && <span className="text-red-500 ml-1">*</span>}
                        </label>
                        <input
                            type="date"
                            value={value}
                            onChange={(e) => handleChange(field.id, e.target.value)}
                            className="w-full bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        />
                        {error && <p className="text-sm text-red-500">{error}</p>}
                    </div>
                );

            case 'account':
                const selectedAccount = accounts.find(a => a.id === value);
                return (
                    <div key={field.id} className="space-y-1">
                        <label className="block text-sm font-medium text-gray-900 dark:text-white">
                            {label}
                            {field.required && <span className="text-red-500 ml-1">*</span>}
                        </label>
                        <button
                            type="button"
                            onClick={() => handleOpenAccountModal(field.id)}
                            className="w-full text-left p-2.5 bg-gray-50 border border-gray-300 text-gray-900 dark:text-white text-sm rounded-lg dark:bg-gray-700 dark:border-gray-600 flex justify-between items-center"
                        >
                            {selectedAccount ? (
                                <span>{selectedAccount.name} ({selectedAccount.code})</span>
                            ) : (
                                <span className="text-gray-400">{t.selectAccount || 'Select Account...'}</span>
                            )}
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                            </svg>
                        </button>
                        {error && <p className="text-sm text-red-500">{error}</p>}
                    </div>
                );

            case 'description':
            case 'notes':
                return (
                    <div key={field.id} className="space-y-1">
                        <label className="block text-sm font-medium text-gray-900 dark:text-white">
                            {label}
                            {field.required && <span className="text-red-500 ml-1">*</span>}
                        </label>
                        <textarea
                            rows={2}
                            value={value}
                            onChange={(e) => handleChange(field.id, e.target.value)}
                            className="w-full bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        />
                        {error && <p className="text-sm text-red-500">{error}</p>}
                    </div>
                );

            case 'currency':
                return (
                    <div key={field.id} className="space-y-1">
                        <label className="block text-sm font-medium text-gray-900 dark:text-white">
                            {label}
                            {field.required && <span className="text-red-500 ml-1">*</span>}
                        </label>
                        <select
                            value={value}
                            onChange={(e) => handleChange(field.id, e.target.value)}
                            className="w-full bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        >
                            <option value="">Select Currency</option>
                            <option value="USD">USD</option>
                            <option value="EUR">EUR</option>
                            <option value="TRY">TRY</option>
                        </select>
                        {error && <p className="text-sm text-red-500">{error}</p>}
                    </div>
                );

            case 'paymentMethod':
                return (
                    <div key={field.id} className="space-y-1">
                        <label className="block text-sm font-medium text-gray-900 dark:text-white">
                            {label}
                            {field.required && <span className="text-red-500 ml-1">*</span>}
                        </label>
                        <select
                            value={value}
                            onChange={(e) => handleChange(field.id, e.target.value)}
                            className="w-full bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        >
                            <option value="">N/A</option>
                            {Object.values(PaymentMethod).map(m => (
                                <option key={m} value={m}>{m}</option>
                            ))}
                        </select>
                        {error && <p className="text-sm text-red-500">{error}</p>}
                    </div>
                );

            case 'referenceDoc':
                return (
                    <div key={field.id} className="space-y-1">
                        <label className="block text-sm font-medium text-gray-900 dark:text-white">
                            {label}
                            {field.required && <span className="text-red-500 ml-1">*</span>}
                        </label>
                        <input
                            type="text"
                            value={value}
                            onChange={(e) => handleChange(field.id, e.target.value)}
                            className="w-full bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        />
                        {error && <p className="text-sm text-red-500">{error}</p>}
                    </div>
                );

            default:
                return (
                    <div key={field.id} className="space-y-1">
                        <label className="block text-sm font-medium text-gray-900 dark:text-white">
                            {label}
                            {field.required && <span className="text-red-500 ml-1">*</span>}
                        </label>
                        <input
                            type="text"
                            value={value}
                            onChange={(e) => handleChange(field.id, e.target.value)}
                            className="w-full bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:text white"
                        />
                        {error && <p className="text-sm text-red-500">{error}</p>}
                    </div>
                );
        }
    };

    // STEP 6: Render line entry table cell
    const renderLineCell = (line: LineEntry, lineIndex: number, field: VoucherLineFieldConfig) => {
        const value = field.id === 'account' ? line.accountId : (line as any)[field.id] || '';
        const error = formErrors[`line_${lineIndex}_${field.id}`];

        switch (field.id) {
            case 'account':
                const selectedAccount = accounts.find(a => a.id === value);
                return (
                    <td key={field.id} className="px-2 py-2">
                        <button
                            type="button"
                            onClick={() => handleOpenAccountModal('account', lineIndex)}
                            className="w-full text-left p-2 bg-gray-50 border border-gray-300 text-gray-900 dark:text-white text-sm rounded dark:bg-gray-700 dark:border-gray-600 flex justify-between items-center"
                        >
                            {selectedAccount ? (
                                <span className="truncate">{selectedAccount.name}</span>
                            ) : (
                                <span className="text-gray-400 text-xs">{t.selectAccount || 'Select...'}</span>
                            )}
                        </button>
                        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
                    </td>
                );

            case 'side':
                return (
                    <td key={field.id} className="px-2 py-2">
                        <select
                            value={line.side}
                            onChange={(e) => handleLineChange(lineIndex, 'side', e.target.value as 'Debit' | 'Credit')}
                            className="w-full p-2 bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        >
                            <option value="Debit">{t.debit || 'Debit'}</option>
                            <option value="Credit">{t.credit || 'Credit'}</option>
                        </select>
                    </td>
                );

            case 'amount':
                return (
                    <td key={field.id} className="px-2 py-2">
                        <input
                            type="number"
                            step="0.01"
                            value={value}
                            onChange={(e) => handleLineChange(lineIndex, 'amount', parseFloat(e.target.value) || 0)}
                            onWheel={(e) => e.currentTarget.blur()}
                            className="w-full p-2 bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded text-right dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        />
                        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
                    </td>
                );

            case 'notes':
                return (
                    <td key={field.id} className="px-2 py-2">
                        <input
                            type="text"
                            value={value}
                            onChange={(e) => handleLineChange(lineIndex, 'notes', e.target.value)}
                            className="w-full p-2 bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        />
                    </td>
                );

            default:
                return (
                    <td key={field.id} className="px-2 py-2">
                        <input
                            type="text"
                            value={value}
                            onChange={(e) => handleLineChange(lineIndex, field.id, e.target.value)}
                            className="w-full p-2 bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        />
                    </td>
                );
        }
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
                    {voucherType.name.en}
                </h2>
                {onClose && (
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Header Fields */}
                {visibleFields.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {visibleFields.map(field => renderField(field))}
                    </div>
                )}

                {/* STEP 6: Multi-line Table */}
                {mode === 'multiLine' && (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                                {t.journalEntryLines || 'Journal Entry Lines'}
                            </h3>
                            <button
                                type="button"
                                onClick={handleAddLine}
                                className="px-3 py-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-sm flex items-center gap-2"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                {t.addLine || 'Add Line'}
                            </button>
                        </div>

                        <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 dark:bg-gray-700">
                                    <tr>
                                        <th className="px-2 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">#</th>
                                        {visibleLineFields.map(field => (
                                            <th
                                                key={field.id}
                                                className={`px-2 py-3 text-${field.align || 'left'} text-xs font-medium text-gray-700 dark:text-gray-300 uppercase`}
                                                style={{ width: field.width ? `${field.width}px` : 'auto' }}
                                            >
                                                {getFieldLabel(field)}
                                                {field.required && <span className="text-red-500 ml-1">*</span>}
                                            </th>
                                        ))}
                                        <th className="px-2 py-3 text-center text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">{t.actions || 'Actions'}</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                    {lines.map((line, lineIndex) => (
                                        <tr key={line.id}>
                                            <td className="px-2 py-2 text-gray-500 dark:text-gray-400">{lineIndex + 1}</td>
                                            {visibleLineFields.map(field => renderLineCell(line, lineIndex, field))}
                                            <td className="px-2 py-2 text-center">
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveLine(lineIndex)}
                                                    className="text-red-500 hover:text-red-700"
                                                >
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Totals */}
                        <div className="flex justify-end">
                            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 space-y-2 min-w-[300px]">
                                <div className="flex justify-between text-sm">
                                    <span className="font-medium text-gray-700 dark:text-gray-300">{t.totalDebit || 'Total Debit'}:</span>
                                    <span className="font-semibold text-gray-900 dark:text-white">{totals.debit.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="font-medium text-gray-700 dark:text-gray-300">{t.totalCredit || 'Total Credit'}:</span>
                                    <span className="font-semibold text-gray-900 dark:text-white">{totals.credit.toFixed(2)}</span>
                                </div>
                                <div className="border-t border-gray-200 dark:border-gray-600 pt-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="font-medium text-gray-700 dark:text-gray-300">{t.difference || 'Difference'}:</span>
                                        <span className={`font-bold ${Math.abs(totals.difference) < 0.01 ? 'text-green-600' : 'text-red-600'}`}>
                                            {totals.difference.toFixed(2)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Form Error */}
                {formErrors._form && (
                    <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-600 text-red-700 dark:text-red-200 rounded-lg">
                        {formErrors._form}
                    </div>
                )}

                {/* Submit Buttons */}
                <div className="flex justify-end gap-3">
                    {onClose && (
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                        >
                            {t.buttonCancel || 'Cancel'}
                        </button>
                    )}
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                    >
                        {isSubmitting && (
                            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                        )}
                        {isSubmitting ? (t.saving || 'Saving...') : (t.submitForApproval || 'Submit')}
                    </button>
                </div>
            </form>

            <AccountSelectionModal
                isOpen={isAccountModalOpen}
                onClose={() => {
                    setIsAccountModalOpen(false);
                    setCurrentAccountField(null);
                    setCurrentLineIndex(null);
                }}
                onSelect={handleAccountSelect}
                accounts={accounts}
                t={t}
            />
        </div>
    );
};

export default DynamicVoucherForm;
