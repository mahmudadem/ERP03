import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card } from '../../../components/ui/Card';
import { AccountSelectorCombobox } from '../../../components/accounting/AccountSelectorCombobox';
import { accountingApi } from '../../../api/accountingApi';
import { PartyDTO, PartyRole, sharedApi } from '../../../api/sharedApi';

type VendorTab = 'GENERAL' | 'COMMERCIAL' | 'ACCOUNTING';

interface VendorFormState {
  code: string;
  legalName: string;
  displayName: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  taxId: string;
  paymentTermsDays: number | '';
  defaultCurrency: string;
  defaultAPAccountId: string;
  defaultARAccountId: string;
  active: boolean;
  roles: PartyRole[];
}

const emptyForm: VendorFormState = {
  code: '',
  legalName: '',
  displayName: '',
  contactPerson: '',
  phone: '',
  email: '',
  address: '',
  taxId: '',
  paymentTermsDays: '',
  defaultCurrency: '',
  defaultAPAccountId: '',
  defaultARAccountId: '',
  active: true,
  roles: ['VENDOR'],
};

const tabs: Array<{ id: VendorTab; label: string }> = [
  { id: 'GENERAL', label: 'General' },
  { id: 'COMMERCIAL', label: 'Commercial' },
  { id: 'ACCOUNTING', label: 'Accounting' },
];

const VendorDetailPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isCreateMode = id === 'new';
  const [activeTab, setActiveTab] = useState<VendorTab>('GENERAL');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!isCreateMode);
  const [currencies, setCurrencies] = useState<string[]>([]);
  const [form, setForm] = useState<VendorFormState>(emptyForm);

  useEffect(() => {
    const load = async () => {
      try {
        const currencyResult = await accountingApi.getCompanyCurrencies();
        const enabled = (currencyResult?.currencies || [])
          .filter((currency) => currency.isEnabled)
          .map((currency) => currency.currencyCode);
        setCurrencies(enabled);
      } catch (error) {
        console.error('Failed to load company currencies', error);
      }

      if (isCreateMode || !id) {
        setLoading(false);
        return;
      }

      try {
        const vendor = await sharedApi.getParty(id);
        setForm({
          code: vendor.code || '',
          legalName: vendor.legalName || '',
          displayName: vendor.displayName || '',
          contactPerson: vendor.contactPerson || '',
          phone: vendor.phone || '',
          email: vendor.email || '',
          address: vendor.address || '',
          taxId: vendor.taxId || '',
          paymentTermsDays: vendor.paymentTermsDays ?? '',
          defaultCurrency: vendor.defaultCurrency || '',
          defaultAPAccountId: vendor.defaultAPAccountId || '',
          defaultARAccountId: vendor.defaultARAccountId || '',
          active: vendor.active,
          roles: vendor.roles || ['VENDOR'],
        });
      } catch (error) {
        console.error('Failed to load vendor', error);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [id, isCreateMode]);

  const tabClass = useMemo(
    () => (tabId: VendorTab) =>
      `rounded px-3 py-2 text-sm ${activeTab === tabId ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`,
    [activeTab]
  );

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    const roles = Array.from(new Set([...(form.roles || []), 'VENDOR'])) as PartyRole[];
    const payload: Partial<PartyDTO> = {
      code: form.code,
      legalName: form.legalName,
      displayName: form.displayName,
      roles,
      contactPerson: form.contactPerson || undefined,
      phone: form.phone || undefined,
      email: form.email || undefined,
      address: form.address || undefined,
      taxId: form.taxId || undefined,
      paymentTermsDays: form.paymentTermsDays === '' ? undefined : Number(form.paymentTermsDays),
      defaultCurrency: form.defaultCurrency || undefined,
      defaultAPAccountId: form.defaultAPAccountId || undefined,
      defaultARAccountId: form.defaultARAccountId || undefined,
      active: form.active,
    };

    try {
      setSaving(true);

      if (isCreateMode) {
        const created = await sharedApi.createParty(payload);
        navigate(`/purchases/vendors/${created.id}`);
      } else {
        await sharedApi.updateParty(id, payload);
      }
    } catch (error) {
      console.error('Failed to save vendor', error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-4 text-sm text-slate-600">Loading vendor...</div>;
  }

  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          {isCreateMode ? 'New Vendor' : 'Vendor Detail'}
        </h1>
        <button
          className="rounded border border-slate-300 px-3 py-2 text-sm"
          onClick={() => navigate('/purchases/vendors')}
          type="button"
        >
          Back to Vendors
        </button>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button key={tab.id} className={tabClass(tab.id)} onClick={() => setActiveTab(tab.id)} type="button">
              {tab.label}
            </button>
          ))}
        </div>
      </Card>

      <Card className="p-6">
        <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSave}>
          {activeTab === 'GENERAL' && (
            <>
              <label className="text-sm">
                <div className="mb-1 font-medium">Code</div>
                <input
                  className="w-full rounded border border-slate-300 px-3 py-2"
                  value={form.code}
                  onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value }))}
                  required
                />
              </label>
              <label className="text-sm">
                <div className="mb-1 font-medium">Legal Name</div>
                <input
                  className="w-full rounded border border-slate-300 px-3 py-2"
                  value={form.legalName}
                  onChange={(e) => setForm((prev) => ({ ...prev, legalName: e.target.value }))}
                  required
                />
              </label>
              <label className="text-sm">
                <div className="mb-1 font-medium">Display Name</div>
                <input
                  className="w-full rounded border border-slate-300 px-3 py-2"
                  value={form.displayName}
                  onChange={(e) => setForm((prev) => ({ ...prev, displayName: e.target.value }))}
                  required
                />
              </label>
              <label className="text-sm">
                <div className="mb-1 font-medium">Contact Person</div>
                <input
                  className="w-full rounded border border-slate-300 px-3 py-2"
                  value={form.contactPerson}
                  onChange={(e) => setForm((prev) => ({ ...prev, contactPerson: e.target.value }))}
                />
              </label>
              <label className="text-sm">
                <div className="mb-1 font-medium">Phone</div>
                <input
                  className="w-full rounded border border-slate-300 px-3 py-2"
                  value={form.phone}
                  onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                />
              </label>
              <label className="text-sm">
                <div className="mb-1 font-medium">Email</div>
                <input
                  className="w-full rounded border border-slate-300 px-3 py-2"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                />
              </label>
              <label className="text-sm md:col-span-2">
                <div className="mb-1 font-medium">Address</div>
                <textarea
                  className="w-full rounded border border-slate-300 px-3 py-2"
                  rows={3}
                  value={form.address}
                  onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
                />
              </label>
              <label className="text-sm">
                <div className="mb-1 font-medium">Tax ID</div>
                <input
                  className="w-full rounded border border-slate-300 px-3 py-2"
                  value={form.taxId}
                  onChange={(e) => setForm((prev) => ({ ...prev, taxId: e.target.value }))}
                />
              </label>
              <label className="text-sm">
                <div className="mb-1 font-medium">Active</div>
                <select
                  className="w-full rounded border border-slate-300 px-3 py-2"
                  value={String(form.active)}
                  onChange={(e) => setForm((prev) => ({ ...prev, active: e.target.value === 'true' }))}
                >
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </label>
            </>
          )}

          {activeTab === 'COMMERCIAL' && (
            <>
              <label className="text-sm">
                <div className="mb-1 font-medium">Payment Terms (Days)</div>
                <input
                  className="w-full rounded border border-slate-300 px-3 py-2"
                  type="number"
                  min={0}
                  value={form.paymentTermsDays}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      paymentTermsDays: e.target.value === '' ? '' : Number(e.target.value),
                    }))
                  }
                />
              </label>
              <label className="text-sm">
                <div className="mb-1 font-medium">Default Currency</div>
                <select
                  className="w-full rounded border border-slate-300 px-3 py-2"
                  value={form.defaultCurrency}
                  onChange={(e) => setForm((prev) => ({ ...prev, defaultCurrency: e.target.value }))}
                >
                  <option value="">— Select Currency —</option>
                  {currencies.map((currency) => (
                    <option key={currency} value={currency}>
                      {currency}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}

          {activeTab === 'ACCOUNTING' && (
            <>
              <label className="text-sm">
                <div className="mb-1 font-medium">Default AP Account</div>
                <AccountSelectorCombobox
                  value={form.defaultAPAccountId}
                  onChange={(accountId) => setForm((prev) => ({ ...prev, defaultAPAccountId: accountId }))}
                  placeholder="Select AP account"
                />
              </label>
              <label className="text-sm">
                <div className="mb-1 font-medium">Default AR Account</div>
                <AccountSelectorCombobox
                  value={form.defaultARAccountId}
                  onChange={(accountId) => setForm((prev) => ({ ...prev, defaultARAccountId: accountId }))}
                  placeholder="Select AR account"
                />
              </label>
            </>
          )}

          <div className="md:col-span-2">
            <button className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white" disabled={saving} type="submit">
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default VendorDetailPage;
