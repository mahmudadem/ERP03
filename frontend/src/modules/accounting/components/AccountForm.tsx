import { useState } from 'react';
import { Account, NewAccountInput, UpdateAccountInput } from '../../../api/accounting';
import { CurrencySelector } from './shared/CurrencySelector';

interface AccountFormProps {
    mode: 'create' | 'edit';
    initialValues?: Account;
    accounts?: Account[];
    onSubmit: (data: NewAccountInput) => Promise<any>;
    onCancel: () => void;
}

const ACCOUNT_TYPES = [
    { value: 'ASSET', label: 'Asset' },
    { value: 'LIABILITY', label: 'Liability' },
    { value: 'EQUITY', label: 'Equity' },
    { value: 'INCOME', label: 'Income' },
    { value: 'EXPENSE', label: 'Expense' },
];

export const AccountForm: React.FC<AccountFormProps> = ({
    mode,
    initialValues,
    accounts = [],
    onSubmit,
    onCancel,
}) => {
    const [formData, setFormData] = useState({
        code: initialValues?.code || '',
        name: initialValues?.name || '',
        type: (initialValues?.type as string) || 'ASSET',
        parentId: initialValues?.parentId || '',
        currency: initialValues?.currency || '',
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const payload: NewAccountInput = {
                code: formData.code,
                name: formData.name,
                type: (formData.type || '').toUpperCase(),
                parentId: formData.parentId ? formData.parentId : null,
                currency: formData.currency || null,
            };
            await onSubmit(payload);
        } finally {
            setIsSubmitting(false);
        }
    };

    const readOnly = mode === 'edit' && initialValues?.isProtected;

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
                <input
                    type="text"
                    name="code"
                    value={formData.code}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={readOnly}
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                    name="type"
                    value={formData.type}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={readOnly}
                >
                    {ACCOUNT_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                            {t.label}
                        </option>
                    ))}
                </select>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Parent Account (Optional)</label>
                <select
                    name="parentId"
                    value={formData.parentId}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={readOnly}
                >
                    <option value="">None</option>
                    {accounts
                        .filter((acc) => acc.id !== initialValues?.id)
                        .map((acc) => (
                            <option key={acc.id} value={acc.id}>
                                {acc.code} - {acc.name}
                            </option>
                        ))}
                </select>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Currency (Optional)</label>
                <CurrencySelector
                    value={formData.currency}
                    onChange={(val) => setFormData(prev => ({ ...prev, currency: val }))}
                    className="w-full"
                    disabled={readOnly}
                />
                <p className="mt-1 text-xs text-gray-500">
                    If set, vouchers using this account will be locked to this currency.
                </p>
            </div>

            <div className="flex gap-3 pt-4">
                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    {isSubmitting ? 'Saving...' : mode === 'create' ? 'Create Account' : 'Update Account'}
                </button>
                <button
                    type="button"
                    onClick={onCancel}
                    disabled={isSubmitting}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 disabled:opacity-50 transition-colors"
                >
                    Cancel
                </button>
            </div>
        </form>
    );
};
