import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { Edit2, Lock, Plus, RefreshCw, X } from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { PurchaseTaxTreatment, TaxCodeDTO, TaxScope, TaxType, sharedApi } from '../../../api/sharedApi';
import { AccountSelector } from '../../accounting/components/shared/AccountSelector';

type TaxPriceBasis = '' | 'EXCLUSIVE' | 'INCLUSIVE';

interface TaxCodeFormState {
  code: string;
  name: string;
  ratePercent: string;
  taxType: TaxType;
  scope: TaxScope;
  purchaseTaxAccountId: string;
  salesTaxAccountId: string;
  purchaseTaxTreatment: PurchaseTaxTreatment;
  priceBasis: TaxPriceBasis;
  active: boolean;
}

const emptyForm: TaxCodeFormState = {
  code: '',
  name: '',
  ratePercent: '',
  taxType: 'VAT',
  scope: 'BOTH',
  purchaseTaxAccountId: '',
  salesTaxAccountId: '',
  purchaseTaxTreatment: 'RECOVERABLE',
  priceBasis: '',
  active: true,
};

const accountingLockedFields = new Set([
  'code',
  'rate',
  'taxType',
  'scope',
  'purchaseTaxAccountId',
  'salesTaxAccountId',
  'purchaseTaxTreatment',
  'priceIsInclusive',
]);

const toPercentText = (rate: number | undefined): string => {
  const percent = Number(rate || 0) * 100;
  return Number.isInteger(percent) ? String(percent) : String(Number(percent.toFixed(4)));
};

const errorMessage = (error: unknown, fallback: string): string => {
  const anyError = error as any;
  return (
    anyError?.response?.data?.error?.message ||
    anyError?.response?.data?.message ||
    anyError?.message ||
    fallback
  );
};

const TaxCodesPage: React.FC = () => {
  const { t } = useTranslation('common');
  const [taxCodes, setTaxCodes] = useState<TaxCodeDTO[]>([]);
  const [form, setForm] = useState<TaxCodeFormState>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<TaxCodeDTO | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saveError, setSaveError] = useState('');

  const isEditingLockedCode = editing?.usedInPostedDocuments === true;
  const lockedFieldSet = useMemo(() => new Set(editing?.lockedFields || []), [editing]);
  const isLocked = (field: string) => isEditingLockedCode && (lockedFieldSet.size === 0 || lockedFieldSet.has(field) || accountingLockedFields.has(field));

  const loadTaxCodes = async () => {
    try {
      setLoading(true);
      const result = await sharedApi.listTaxCodes();
      setTaxCodes(result || []);
    } catch (error) {
      console.error('Failed to load tax codes', error);
      toast.error(t('taxCodes.messages.loadFailed', { defaultValue: 'Failed to load tax codes.' }));
      setTaxCodes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTaxCodes();
  }, []);

  const openCreateModal = () => {
    setEditing(null);
    setForm(emptyForm);
    setSaveError('');
    setModalOpen(true);
  };

  const openEditModal = (taxCode: TaxCodeDTO) => {
    setEditing(taxCode);
    setForm({
      code: taxCode.code,
      name: taxCode.name,
      ratePercent: toPercentText(taxCode.rate),
      taxType: taxCode.taxType,
      scope: taxCode.scope,
      purchaseTaxAccountId: taxCode.purchaseTaxAccountId || '',
      salesTaxAccountId: taxCode.salesTaxAccountId || '',
      purchaseTaxTreatment: taxCode.purchaseTaxTreatment || 'RECOVERABLE',
      priceBasis: taxCode.priceIsInclusive === true ? 'INCLUSIVE' : 'EXCLUSIVE',
      active: taxCode.active,
    });
    setSaveError('');
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setEditing(null);
    setForm(emptyForm);
    setSaveError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const ratePercent = Number(form.ratePercent);
    if (!Number.isFinite(ratePercent) || ratePercent < 0) {
      setSaveError(t('taxCodes.messages.invalidRate', { defaultValue: 'Rate % must be a non-negative number.' }));
      return;
    }

    if (!form.priceBasis) {
      setSaveError(t('taxCodes.messages.priceBasisRequired', {
        defaultValue: 'Price Basis is required. Choose whether entered prices include tax or tax is added on top.',
      }));
      return;
    }

    try {
      setSaving(true);
      setSaveError('');
      const payload: Partial<TaxCodeDTO> = {
        code: form.code,
        name: form.name,
        rate: ratePercent / 100,
        taxType: form.taxType,
        scope: form.scope,
        purchaseTaxAccountId: form.purchaseTaxAccountId || undefined,
        salesTaxAccountId: form.salesTaxAccountId || undefined,
        purchaseTaxTreatment: form.purchaseTaxTreatment,
        priceIsInclusive: form.priceBasis === 'INCLUSIVE',
        active: form.active,
      };

      if (editing) {
        await sharedApi.updateTaxCode(editing.id, payload);
        toast.success(t('taxCodes.messages.updated', { defaultValue: 'Tax code updated.' }));
      } else {
        await sharedApi.createTaxCode(payload);
        toast.success(t('taxCodes.messages.created', { defaultValue: 'Tax code created.' }));
      }

      closeModal();
      await loadTaxCodes();
    } catch (error) {
      console.error('Failed to save tax code', error);
      const message = errorMessage(error, t('taxCodes.messages.saveFailed', { defaultValue: 'Failed to save tax code.' }));
      setSaveError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const priceBasisLabel = (taxCode: Pick<TaxCodeDTO, 'priceIsInclusive'>): string =>
    taxCode.priceIsInclusive
      ? t('taxCodes.priceBasis.inclusive', { defaultValue: 'Inclusive' })
      : t('taxCodes.priceBasis.exclusive', { defaultValue: 'Exclusive' });

  const purchaseTaxTreatmentLabel = (treatment: TaxCodeDTO['purchaseTaxTreatment']): string =>
    treatment === 'NON_RECOVERABLE'
      ? t('taxCodes.purchaseTreatment.nonRecoverableShort', { defaultValue: 'Non-recoverable' })
      : t('taxCodes.purchaseTreatment.recoverableShort', { defaultValue: 'Recoverable' });

  const fieldLockText = isEditingLockedCode
    ? t('taxCodes.lockText', {
        defaultValue: 'This tax code is used in posted documents. Create a new tax code to change tax treatment.',
      })
    : '';

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{t('taxCodes.title', { defaultValue: 'Tax Codes' })}</h1>
          <p className="text-sm text-slate-500">
            {t('taxCodes.subtitle', { defaultValue: 'Manage tax rates, account routing, price basis, and purchase tax cost treatment.' })}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className="inline-flex items-center gap-2 rounded border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            disabled={loading}
            onClick={loadTaxCodes}
            type="button"
          >
            <RefreshCw className="h-4 w-4" />
            {t('common.refresh', { defaultValue: 'Refresh' })}
          </button>
          <button
            className="inline-flex items-center gap-2 rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            onClick={openCreateModal}
            type="button"
          >
            <Plus className="h-4 w-4" />
            {t('taxCodes.actions.new', { defaultValue: 'New Tax Code' })}
          </button>
        </div>
      </div>

      <Card className="p-0">
        {loading ? (
          <div className="p-6 text-sm text-slate-500">{t('taxCodes.loading', { defaultValue: 'Loading tax codes...' })}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr className="border-b border-slate-200">
                  <th className="px-4 py-3 text-left">{t('taxCodes.columns.code', { defaultValue: 'Code' })}</th>
                  <th className="px-4 py-3 text-left">{t('taxCodes.columns.name', { defaultValue: 'Name' })}</th>
                  <th className="px-4 py-3 text-right">{t('taxCodes.columns.rate', { defaultValue: 'Rate' })}</th>
                  <th className="px-4 py-3 text-left">{t('taxCodes.columns.type', { defaultValue: 'Type' })}</th>
                  <th className="px-4 py-3 text-left">{t('taxCodes.columns.scope', { defaultValue: 'Scope' })}</th>
                  <th className="px-4 py-3 text-left">{t('taxCodes.columns.priceBasis', { defaultValue: 'Price Basis' })}</th>
                  <th className="px-4 py-3 text-left">{t('taxCodes.columns.purchaseTreatment', { defaultValue: 'Purchase Treatment' })}</th>
                  <th className="px-4 py-3 text-left">{t('taxCodes.columns.status', { defaultValue: 'Status' })}</th>
                  <th className="px-4 py-3 text-left">{t('taxCodes.columns.usage', { defaultValue: 'Usage' })}</th>
                  <th className="px-4 py-3 text-right">{t('taxCodes.columns.actions', { defaultValue: 'Actions' })}</th>
                </tr>
              </thead>
              <tbody>
                {taxCodes.map((taxCode) => (
                  <tr key={taxCode.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-3 font-mono font-semibold text-slate-900">{taxCode.code}</td>
                    <td className="px-4 py-3">{taxCode.name}</td>
                    <td className="px-4 py-3 text-right font-mono">{toPercentText(taxCode.rate)}%</td>
                    <td className="px-4 py-3">{taxCode.taxType}</td>
                    <td className="px-4 py-3">{taxCode.scope}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-semibold ${
                          taxCode.priceIsInclusive
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {priceBasisLabel(taxCode)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-semibold ${
                          taxCode.purchaseTaxTreatment === 'NON_RECOVERABLE'
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-blue-50 text-blue-700'
                        }`}
                      >
                        {purchaseTaxTreatmentLabel(taxCode.purchaseTaxTreatment)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {taxCode.active
                        ? t('taxCodes.status.active', { defaultValue: 'Active' })
                        : t('taxCodes.status.inactive', { defaultValue: 'Inactive' })}
                    </td>
                    <td className="px-4 py-3">
                      {taxCode.usedInPostedDocuments ? (
                        <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">
                          <Lock className="h-3.5 w-3.5" />
                          {t('taxCodes.usage.locked', { defaultValue: 'Locked' })}
                        </span>
                      ) : (
                        <span className="rounded bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                          {t('taxCodes.usage.editable', { defaultValue: 'Editable' })}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        className="inline-flex items-center gap-1 rounded border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-50"
                        onClick={() => openEditModal(taxCode)}
                        type="button"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                        {t('common.edit', { defaultValue: 'Edit' })}
                      </button>
                    </td>
                  </tr>
                ))}
                {taxCodes.length === 0 && (
                  <tr>
                    <td className="px-4 py-10 text-center text-slate-500" colSpan={10}>
                      {t('taxCodes.empty', { defaultValue: 'No tax codes found.' })}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {editing
                    ? t('taxCodes.modal.editTitle', { defaultValue: 'Edit Tax Code' })
                    : t('taxCodes.modal.newTitle', { defaultValue: 'New Tax Code' })}
                </h2>
                {fieldLockText && (
                  <p className="mt-1 inline-flex items-center gap-1 text-xs text-amber-700">
                    <Lock className="h-3.5 w-3.5" />
                    {fieldLockText}
                  </p>
                )}
              </div>
              <button className="rounded p-1 text-slate-500 hover:bg-slate-100" onClick={closeModal} type="button">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form className="grid gap-4 p-5 md:grid-cols-2" onSubmit={handleSubmit}>
              <label className="text-sm">
                <div className="mb-1 font-medium">{t('taxCodes.fields.code', { defaultValue: 'Code' })}</div>
                <input
                  className="w-full rounded border border-slate-300 px-3 py-2 disabled:bg-slate-100"
                  disabled={isLocked('code')}
                  value={form.code}
                  onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value }))}
                  required
                />
              </label>
              <label className="text-sm">
                <div className="mb-1 font-medium">{t('taxCodes.fields.name', { defaultValue: 'Name' })}</div>
                <input
                  className="w-full rounded border border-slate-300 px-3 py-2"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  required
                />
              </label>
              <label className="text-sm">
                <div className="mb-1 font-medium">{t('taxCodes.fields.ratePercent', { defaultValue: 'Rate %' })}</div>
                <input
                  className="w-full rounded border border-slate-300 px-3 py-2 disabled:bg-slate-100"
                  disabled={isLocked('rate')}
                  type="number"
                  step="0.0001"
                  min="0"
                  value={form.ratePercent}
                  onChange={(e) => setForm((prev) => ({ ...prev, ratePercent: e.target.value }))}
                  placeholder="10"
                  required
                />
              </label>
              <label className="text-sm">
                <div className="mb-1 font-medium">{t('taxCodes.fields.type', { defaultValue: 'Type' })}</div>
                <select
                  className="w-full rounded border border-slate-300 px-3 py-2 disabled:bg-slate-100"
                  disabled={isLocked('taxType')}
                  value={form.taxType}
                  onChange={(e) => setForm((prev) => ({ ...prev, taxType: e.target.value as TaxType }))}
                >
                  <option value="VAT">VAT</option>
                  <option value="GST">GST</option>
                  <option value="EXEMPT">EXEMPT</option>
                  <option value="ZERO_RATED">ZERO_RATED</option>
                </select>
              </label>
              <label className="text-sm">
                <div className="mb-1 font-medium">{t('taxCodes.fields.scope', { defaultValue: 'Scope' })}</div>
                <select
                  className="w-full rounded border border-slate-300 px-3 py-2 disabled:bg-slate-100"
                  disabled={isLocked('scope')}
                  value={form.scope}
                  onChange={(e) => setForm((prev) => ({ ...prev, scope: e.target.value as TaxScope }))}
                >
                  <option value="PURCHASE">PURCHASE</option>
                  <option value="SALES">SALES</option>
                  <option value="BOTH">BOTH</option>
                </select>
              </label>
              <label className="text-sm">
                <div className="mb-1 font-medium">{t('taxCodes.fields.active', { defaultValue: 'Active' })}</div>
                <select
                  className="w-full rounded border border-slate-300 px-3 py-2"
                  value={String(form.active)}
                  onChange={(e) => setForm((prev) => ({ ...prev, active: e.target.value === 'true' }))}
                >
                  <option value="true">{t('taxCodes.status.active', { defaultValue: 'Active' })}</option>
                  <option value="false">{t('taxCodes.status.inactive', { defaultValue: 'Inactive' })}</option>
                </select>
              </label>
              <label className="text-sm">
                <div className="mb-1 font-medium">{t('taxCodes.fields.purchaseTaxAccount', { defaultValue: 'Purchase Tax Account' })}</div>
                <AccountSelector
                  disabled={isLocked('purchaseTaxAccountId')}
                  value={form.purchaseTaxAccountId}
                  onChange={(account) => setForm((prev) => ({ ...prev, purchaseTaxAccountId: account?.id || '' }))}
                  placeholder={t('taxCodes.placeholders.purchaseTaxAccount', { defaultValue: 'Select purchase tax account' })}
                />
              </label>
              <label className="text-sm">
                <div className="mb-1 font-medium">{t('taxCodes.fields.salesTaxAccount', { defaultValue: 'Sales Tax Account' })}</div>
                <AccountSelector
                  disabled={isLocked('salesTaxAccountId')}
                  value={form.salesTaxAccountId}
                  onChange={(account) => setForm((prev) => ({ ...prev, salesTaxAccountId: account?.id || '' }))}
                  placeholder={t('taxCodes.placeholders.salesTaxAccount', { defaultValue: 'Select sales tax account' })}
                />
              </label>
              <label className="text-sm md:col-span-2">
                <div className="mb-1 font-medium">
                  {t('taxCodes.fields.priceBasis', { defaultValue: 'Price Basis' })} <span className="text-red-600">*</span>
                </div>
                <select
                  className="w-full rounded border border-slate-300 px-3 py-2 disabled:bg-slate-100"
                  disabled={isLocked('priceIsInclusive')}
                  value={form.priceBasis}
                  onChange={(e) => {
                    setSaveError('');
                    setForm((prev) => ({ ...prev, priceBasis: e.target.value as TaxPriceBasis }));
                  }}
                  required
                >
                  <option value="">{t('taxCodes.placeholders.priceBasis', { defaultValue: 'Select price basis...' })}</option>
                  <option value="EXCLUSIVE">{t('taxCodes.priceBasis.exclusiveHelp', { defaultValue: 'Exclusive - tax is added on top' })}</option>
                  <option value="INCLUSIVE">{t('taxCodes.priceBasis.inclusiveHelp', { defaultValue: 'Inclusive - entered price already includes tax' })}</option>
                </select>
                <div className="mt-1 text-xs text-slate-500">
                  {t('taxCodes.priceBasis.help', {
                    defaultValue: 'With 10% tax and price 100, Exclusive totals 110; Inclusive splits 100 into net 90.91 and tax 9.09.',
                  })}
                </div>
              </label>
              <label className="text-sm md:col-span-2">
                <div className="mb-1 font-medium">
                  {t('taxCodes.fields.purchaseTaxTreatment', { defaultValue: 'Purchase Tax Treatment' })} <span className="text-red-600">*</span>
                </div>
                <select
                  className="w-full rounded border border-slate-300 px-3 py-2 disabled:bg-slate-100"
                  disabled={isLocked('purchaseTaxTreatment')}
                  value={form.purchaseTaxTreatment}
                  onChange={(e) => {
                    setSaveError('');
                    setForm((prev) => ({ ...prev, purchaseTaxTreatment: e.target.value as PurchaseTaxTreatment }));
                  }}
                  required
                >
                  <option value="RECOVERABLE">{t('taxCodes.purchaseTreatment.recoverableHelp', { defaultValue: 'Recoverable - post purchase tax separately' })}</option>
                  <option value="NON_RECOVERABLE">{t('taxCodes.purchaseTreatment.nonRecoverableHelp', { defaultValue: 'Non-recoverable - include purchase tax in item/expense cost' })}</option>
                </select>
                <div className="mt-1 text-xs text-slate-500">
                  {t('taxCodes.purchaseTreatment.help', {
                    defaultValue: 'Recoverable tax debits the purchase tax account. Non-recoverable tax is capitalized into inventory or expense cost.',
                  })}
                </div>
              </label>
              {saveError && (
                <div className="md:col-span-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {saveError}
                </div>
              )}
              <div className="flex justify-end gap-2 border-t border-slate-200 pt-4 md:col-span-2">
                <button className="rounded border border-slate-300 px-4 py-2 text-sm" onClick={closeModal} type="button">
                  {t('common.cancel', { defaultValue: 'Cancel' })}
                </button>
                <button className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60" disabled={saving} type="submit">
                  {saving
                    ? t('common.saving', { defaultValue: 'Saving...' })
                    : editing
                      ? t('taxCodes.actions.update', { defaultValue: 'Update Tax Code' })
                      : t('taxCodes.actions.create', { defaultValue: 'Create Tax Code' })}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaxCodesPage;
