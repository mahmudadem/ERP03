import React from 'react';
import { VoucherTypeConfig, Translation } from '../../../types';

interface Props {
    config: VoucherTypeConfig;
    updateConfig: (updates: Partial<VoucherTypeConfig>) => void;
    t: Translation;
}

const Step1BasicInfo: React.FC<Props> = ({ config, updateConfig, t }) => {
    return (
        <div className="space-y-6 p-4">
            <div className="border-b pb-4 mb-4 dark:border-gray-700">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    {t.basicInformation || 'Basic Information'}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {t.basicInfoDesc || 'Define the identity and behavior of this voucher type.'}
                </p>
            </div>

            {/* Mode Selection */}
            <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg">
                <label className="block text-sm font-medium mb-2 text-indigo-900 dark:text-indigo-300">
                    {t.voucherMode || 'Voucher Mode'}
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button
                        type="button"
                        onClick={() => updateConfig({ mode: 'singleLine' })}
                        className={`p-4 rounded-lg border-2 text-left transition-all ${
                            config.mode === 'singleLine'
                                ? 'border-indigo-600 bg-white dark:bg-gray-800 shadow-md'
                                : 'border-transparent bg-white/50 dark:bg-gray-800/50 hover:bg-white dark:hover:bg-gray-800'
                        }`}
                    >
                        <div className="font-semibold text-gray-900 dark:text-white mb-1">
                            {t.singleLineMode || 'Single-line Mode'}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            {t.singleLineDesc || 'Simple form for payments and receipts. Fixed debit/credit accounts.'}
                        </p>
                    </button>

                    <button
                        type="button"
                        onClick={() => updateConfig({ mode: 'multiLine' })}
                        className={`p-4 rounded-lg border-2 text-left transition-all ${
                            config.mode === 'multiLine'
                                ? 'border-indigo-600 bg-white dark:bg-gray-800 shadow-md'
                                : 'border-transparent bg-white/50 dark:bg-gray-800/50 hover:bg-white dark:hover:bg-gray-800'
                        }`}
                    >
                        <div className="font-semibold text-gray-900 dark:text-white mb-1">
                            {t.multiLineMode || 'Multi-line Mode'}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            {t.multiLineDesc || 'Full journal entry table with multiple debit/credit lines.'}
                        </p>
                    </button>
                </div>
            </div>

            {/* Identity */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="col-span-1 md:col-span-3">
                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                        {t.category || 'Category'} <span className="text-red-500">*</span>
                    </label>
                    <select
                        value={config.category || 'Financial'}
                        onChange={(e) => updateConfig({ category: e.target.value as any })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                    >
                        <option value="Financial">{t.financial || 'Financial'}</option>
                        <option value="Inventory">{t.inventory || 'Inventory'}</option>
                        <option value="Sales">{t.sales || 'Sales'}</option>
                        <option value="Purchase">{t.purchase || 'Purchase'}</option>
                        <option value="Custom">{t.custom || 'Custom'}</option>
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                        {t.nameEnglish || 'Name (English)'} <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        value={config.name.en}
                        onChange={(e) => updateConfig({ name: { ...config.name, en: e.target.value } })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                        placeholder="e.g. Journal Entry"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                        {t.nameArabic || 'Name (Arabic)'} <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        value={config.name.ar}
                        onChange={(e) => updateConfig({ name: { ...config.name, ar: e.target.value } })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                        dir="rtl"
                        placeholder="مثال: قيد يومية"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                        {t.nameTurkish || 'Name (Turkish)'} <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        value={config.name.tr}
                        onChange={(e) => updateConfig({ name: { ...config.name, tr: e.target.value } })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                        placeholder="Örn. Yevmiye Fişi"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                        {t.code || 'Code'} <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        value={config.code}
                        onChange={(e) => updateConfig({ code: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                        placeholder="e.g. JE-001"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                        {t.abbreviation || 'Abbreviation'} <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        value={config.abbreviation}
                        onChange={(e) => updateConfig({ abbreviation: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                        maxLength={5}
                        placeholder="e.g. JE"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                        {t.color || 'Color'}
                    </label>
                    <div className="flex gap-2">
                        <input
                            type="color"
                            value={config.color || '#3B82F6'}
                            onChange={(e) => updateConfig({ color: e.target.value })}
                            className="h-10 w-20 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer"
                        />
                        <div 
                            className="flex-1 h-10 rounded-lg flex items-center justify-center text-white font-bold shadow-sm"
                            style={{ backgroundColor: config.color || '#3B82F6' }}
                        >
                            {config.abbreviation || 'AB'}
                        </div>
                    </div>
                </div>
            </div>

            {/* Status */}
            <div className="pt-4 border-t dark:border-gray-700">
                <label className="flex items-center gap-3 cursor-pointer">
                    <div className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            checked={config.isActive}
                            onChange={(e) => updateConfig({ isActive: e.target.checked })}
                            className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
                    </div>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {t.isActive || 'Active Status'}
                    </span>
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-14">
                    {t.isActiveDesc || 'If disabled, this voucher type will not be available for creating new vouchers.'}
                </p>
            </div>
        </div>
    );
};

export default Step1BasicInfo;
