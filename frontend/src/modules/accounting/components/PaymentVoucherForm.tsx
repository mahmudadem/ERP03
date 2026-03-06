import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AmountInput } from './shared/AmountInput';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { accountingApi } from '../../../api/accountingApi';
import { errorHandler } from '../../../services/errorHandler';
import { useCompanySettings } from '../../../hooks/useCompanySettings';
import { getCompanyToday } from '../../../utils/dateUtils';
import { AccountSelector } from './shared/AccountSelector';
import { Account } from '../../../context/AccountsContext';
import { useCompanyAccess } from '../../../context/CompanyAccessContext';

interface PaymentAllocation {
  payToAccountId: string;
  amount: number;
  notes: string;
}

interface PaymentFormProps {
  companyId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export const PaymentVoucherForm: React.FC<PaymentFormProps> = ({
  companyId,
  onSuccess,
  onCancel
}) => {
  const { t } = useTranslation('accounting');
  const { settings } = useCompanySettings();
  const { company } = useCompanyAccess();
  const baseCurrency = company?.baseCurrency || '';
  const [payFromAccountId, setPayFromAccountId] = useState('');
  const [description, setDescription] = useState('');
  const [allocations, setAllocations] = useState<PaymentAllocation[]>([
    { payToAccountId: '', amount: 0, notes: '' }
  ]);
  const [loading, setLoading] = useState(false);

  // Auto-calculate total from allocations
  const totalAmount = useMemo(() => {
    return allocations.reduce((sum, alloc) => sum + Number(alloc.amount || 0), 0);
  }, [allocations]);

  const handleAddAllocation = () => {
    setAllocations([...allocations, { payToAccountId: '', amount: 0, notes: '' }]);
  };

  const handleRemoveAllocation = (index: number) => {
    if (allocations.length > 1) {
      setAllocations(allocations.filter((_, i) => i !== index));
    }
  };

  const handleAllocationChange = (index: number, field: keyof PaymentAllocation, value: any) => {
    const updated = [...allocations];
    updated[index] = { ...updated[index], [field]: value };
    setAllocations(updated);
  };




  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const localDate = getCompanyToday(settings);
      
      const payload = {
        type: 'payment',
        date: localDate,
        payFromAccountId,
        currency: baseCurrency,
        exchangeRate: 1,
        totalAmount,
        description,
        lines: allocations
          .filter(a => a.payToAccountId && a.amount > 0)
          .map(a => ({
            accountId: a.payToAccountId,
            amount: a.amount,
            notes: a.notes,
            side: 'Credit' 
          }))
      };

      await accountingApi.createVoucher(payload);
      errorHandler.showSuccess('voucher_saved');
      
      if (onSuccess) onSuccess();
    } catch (err: any) {
      // The enhanced errorHandler now handles the translation and technical message display automatically
      errorHandler.showError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="payment-voucher-form p-6 max-w-4xl mx-auto transition-colors">
      <div className="flex items-center justify-between mb-8">
        <div>
           <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">{t('paymentVoucher.title', { defaultValue: 'New Payment Voucher' })}</h2>
           <p className="text-sm text-[var(--color-text-muted)] mt-1">{t('paymentVoucher.subtitle', { defaultValue: 'Record a disbursement or expense payment.' })}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Header Section */}
        <div className="form-section bg-[var(--color-bg-secondary)] p-6 rounded-xl border border-[var(--color-border)] shadow-sm">
          <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--color-text-muted)] mb-4">{t('paymentVoucher.sections.source', { defaultValue: 'Payment Source' })}</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1">
               <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase">{t('paymentVoucher.fields.payFrom', { defaultValue: 'Pay From Account *' })}</label>
               <AccountSelector
                 value={payFromAccountId}
                 onChange={(acc: Account | null) => setPayFromAccountId(acc?.id || '')}
                 placeholder={t('paymentVoucher.placeholders.payFrom', { defaultValue: 'Search bank / cash account...' })}
               />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase">{t('paymentVoucher.fields.description', { defaultValue: 'Description' })}</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder={t('paymentVoucher.placeholders.description', { defaultValue: 'Overall payment description...' })}
                className="w-full p-2 text-sm border border-[var(--color-border)] rounded bg-[var(--color-bg-primary)] focus:ring-1 focus:ring-primary-500 outline-none transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Allocations Section */}
        <div className="form-section bg-[var(--color-bg-secondary)] p-6 rounded-xl border border-[var(--color-border)] shadow-sm">
          <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--color-text-muted)] mb-4">{t('paymentVoucher.sections.allocations', { defaultValue: 'Payment Allocations' })}</h3>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <th className="py-2 text-[10px] font-bold text-[var(--color-text-muted)] uppercase">{t('paymentVoucher.fields.payTo', { defaultValue: 'Pay To Account *' })}</th>
                  <th className="py-2 text-[10px] font-bold text-[var(--color-text-muted)] uppercase w-40">{t('paymentVoucher.fields.amount', { defaultValue: 'Amount *' })}</th>
                  <th className="py-2 text-[10px] font-bold text-[var(--color-text-muted)] uppercase">{t('paymentVoucher.fields.notes', { defaultValue: 'Notes' })}</th>
                  <th className="py-2 text-[10px] font-bold text-[var(--color-text-muted)] uppercase w-20 text-center">{t('paymentVoucher.fields.action', { defaultValue: 'Action' })}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {allocations.map((alloc, index) => (
                  <tr key={index} className="group hover:bg-[var(--color-bg-tertiary)]/50 transition-colors">
                    <td className="py-3 pr-4">
                      <AccountSelector
                        value={alloc.payToAccountId}
                        onChange={(acc: Account | null) => handleAllocationChange(index, 'payToAccountId', acc?.id || '')}
                        placeholder={t('paymentVoucher.placeholders.payTo', { defaultValue: 'Search destination...' })}
                        noBorder
                        className="bg-transparent"
                      />
                    </td>
                    <td className="py-3 px-2">
                        <div className="relative flex items-center">
                          <span className="absolute left-2 text-[var(--color-text-muted)] text-[10px] font-bold uppercase">{baseCurrency}</span>
                          <AmountInput // Replaced manual input
                            value={alloc.amount}
                            onChange={(val) => handleAllocationChange(index, 'amount', val)}
                            placeholder=""
                            className="w-full pl-10 pr-2 py-1.5 text-sm border border-[var(--color-border)] rounded bg-[var(--color-bg-primary)] focus:ring-1 focus:ring-primary-500 outline-none font-mono text-left"
                          />
                       </div>
                    </td>
                    <td className="py-3 px-2">
                      <input
                        type="text"
                        value={alloc.notes}
                        onChange={(e) => handleAllocationChange(index, 'notes', e.target.value)}
                        placeholder={t('paymentVoucher.placeholders.notes', { defaultValue: 'Invoice #, etc.' })}
                        className="w-full p-1.5 text-sm border border-[var(--color-border)] rounded bg-[var(--color-bg-primary)] focus:ring-1 focus:ring-primary-500 outline-none"
                      />
                    </td>
                    <td className="py-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveAllocation(index)}
                        disabled={allocations.length === 1}
                        className="p-2 text-danger-500 hover:bg-danger-100/50 rounded-lg transition-colors disabled:opacity-30"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button 
            type="button" 
            onClick={handleAddAllocation} 
            className="mt-4 flex items-center gap-2 text-sm font-bold text-primary-600 hover:text-primary-700 transition-colors bg-primary-50 dark:bg-primary-900/10 px-4 py-2 rounded-lg"
          >
            <Plus className="w-4 h-4" /> {t('paymentVoucher.actions.addLine', { defaultValue: 'Add Another Line' })}
          </button>
        </div>

        {/* Summary & Footer */}
        <div className="flex items-center justify-between bg-[var(--color-bg-tertiary)] p-6 rounded-xl border border-[var(--color-border)] shadow-inner">
          <div className="flex items-center gap-8">
            <div>
              <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase block mb-1">{t('paymentVoucher.totalPayment', { defaultValue: 'Total Payment' })}</span>
              <span className="text-2xl font-mono font-bold text-primary-600 dark:text-primary-400">
                {new Intl.NumberFormat('en-US', { minimumFractionDigits: 2 }).format(totalAmount)}
                <span className="text-sm ml-1 opacity-60">{baseCurrency}</span>
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              type="button" 
              onClick={onCancel} 
              disabled={loading}
              className="px-6 py-2.5 text-sm font-bold text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] rounded-lg transition-colors"
            >
              {t('paymentVoucher.actions.cancel', { defaultValue: 'Cancel' })}
            </button>
            <button 
              type="submit" 
              disabled={loading || !payFromAccountId || totalAmount === 0}
              className="px-8 py-2.5 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 text-white rounded-lg font-bold shadow-lg shadow-primary-500/20 transition-all flex items-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? t('paymentVoucher.actions.processing', { defaultValue: 'Processing...' }) : t('paymentVoucher.actions.save', { defaultValue: 'Save Payment' })}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
