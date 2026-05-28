
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  User, 
  Building2, 
  ShieldCheck, 
  Phone,
  Mail,
  MapPin,
  Clock,
  Coins
} from 'lucide-react';
import { PartyDTO, PartyRole, PartyAccountStrategy, sharedApi } from '../../../api/sharedApi';
import { accountingApi } from '../../../api/accountingApi';
import { salesApi } from '../../../api/salesApi';
import { purchasesApi, VendorGroupDTO } from '../../../api/purchasesApi';
import { salesMasterDataApi, CustomerGroupDTO, PriceListDTO } from '../../../api/salesMasterDataApi';
import toast from 'react-hot-toast';
import { voucherFormApi, VoucherFormResponse } from '../../../api/voucherFormApi';
import { useRBAC } from '../../../api/rbac/useRBAC';
import { AccountSelector } from '../../accounting/components/shared/AccountSelector';
import { MasterCardLayout, FormSection, Field, MasterCardTab } from '../../../components/layout/MasterCardLayout';
import { generateNextCode, CODE_PATTERNS } from '../../../utils/codeGenerator';
import { Sparkles } from 'lucide-react';
import { useAccounts } from '../../../context/AccountsContext';

const PARTY_ACCOUNT_CODE_FORMAT_FALLBACK = '{parent}-{partyCode}';

interface PartyAccountCodeContext {
  parent: string;
  partyCode: string;
  seq?: number;
}

const zeroPad = (n: number, width: number) => {
  const text = String(Math.max(0, Math.floor(n)));
  return text.length >= width ? text : '0'.repeat(width - text.length) + text;
};

const renderPartyAccountCode = (template: string | undefined, ctx: PartyAccountCodeContext): string => {
  const tpl = (template && template.trim()) || PARTY_ACCOUNT_CODE_FORMAT_FALLBACK;
  return tpl
    .replace(/\{parent\}/g, ctx.parent)
    .replace(/\{partyCode\}/g, ctx.partyCode)
    .replace(/\{seq3\}/g, zeroPad(ctx.seq ?? 1, 3));
};

interface PartyMasterCardProps {
  partyId?: string;
  isWindow?: boolean;
  onClose?: () => void;
  onSaved?: (party: PartyDTO) => void;
  role?: PartyRole;
}

const PARTY_TABS: MasterCardTab[] = [
  { id: 'GENERAL', label: 'Identity & Legal', icon: Building2 },
  { id: 'CONTACT', label: 'Communication', icon: Phone },
  { id: 'COMMERCIAL', label: 'Commercial Terms', icon: Coins },
  { id: 'ACCOUNTING', label: 'Financial Settings', icon: ShieldCheck },
];

const PartyMasterCard: React.FC<PartyMasterCardProps> = ({ 
  partyId, 
  isWindow = false, 
  onClose, 
  onSaved,
  role = 'CUSTOMER'
}) => {
  const { t } = useTranslation();
  const { hasPermission } = useRBAC();
  const { getAccountById } = useAccounts();
  const [activeTab, setActiveTab] = useState('GENERAL');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currencies, setCurrencies] = useState<string[]>([]);
  const [customerGroups, setCustomerGroups] = useState<CustomerGroupDTO[]>([]);
  const [vendorGroups, setVendorGroups] = useState<VendorGroupDTO[]>([]);
  const [priceLists, setPriceLists] = useState<PriceListDTO[]>([]);
  const [invoiceTemplates, setInvoiceTemplates] = useState<VoucherFormResponse[]>([]);
  const [accountStrategy, setAccountStrategy] = useState<PartyAccountStrategy | ''>('');
  const [subAccountParentId, setSubAccountParentId] = useState('');
  const [partyAccountCodeFormat, setPartyAccountCodeFormat] = useState(PARTY_ACCOUNT_CODE_FORMAT_FALLBACK);

  const [form, setForm] = useState<Partial<PartyDTO>>({
    code: '',
    legalName: '',
    displayName: '',
    roles: [role],
    active: true,
    defaultCurrency: 'USD',
    paymentTermsDays: 0
  });

  const isNew = !partyId || partyId === 'new';
  const canEdit = hasPermission(role === 'CUSTOMER' ? 'sales.customers.manage' : 'purchases.suppliers.manage');

  useEffect(() => {
    loadCurrencies();
    void loadPartyAccountSettings();
    if (!isNew && partyId) loadParty(partyId);
    if (role === 'CUSTOMER') {
      salesMasterDataApi.listCustomerGroups().then(setCustomerGroups).catch(console.error);
      salesMasterDataApi.listPriceLists().then(setPriceLists).catch(console.error);
      voucherFormApi.list().then((forms) => {
        setInvoiceTemplates((forms || []).filter((form) => {
          if (form.enabled === false) return false;
          const voucherType = String(form.voucherType || '').toLowerCase();
          const formType = String(form.formType || '').toLowerCase();
          return voucherType === 'sales_invoice' || formType.startsWith('sales_invoice');
        }));
      }).catch(console.error);
    } else {
      purchasesApi.listVendorGroups().then(setVendorGroups).catch(console.error);
    }
  }, [partyId, role]);

  const loadPartyAccountSettings = async () => {
    try {
      if (role === 'CUSTOMER') {
        const salesSettings = await salesApi.getSettings().catch(() => null);
        const payload = salesSettings as any;
        setSubAccountParentId(payload?.arParentAccountId || '');
        setPartyAccountCodeFormat(payload?.partyAccountCodeFormat || PARTY_ACCOUNT_CODE_FORMAT_FALLBACK);
      } else {
        const purchaseSettings = await purchasesApi.getSettings().catch(() => null);
        const payload = purchaseSettings as any;
        setSubAccountParentId(payload?.apParentAccountId || '');
        setPartyAccountCodeFormat(payload?.partyAccountCodeFormat || PARTY_ACCOUNT_CODE_FORMAT_FALLBACK);
      }
    } catch {
      setSubAccountParentId('');
      setPartyAccountCodeFormat(PARTY_ACCOUNT_CODE_FORMAT_FALLBACK);
    }
  };

  const defaultInvoiceTemplateOptions = useMemo(
    () => invoiceTemplates
      .slice()
      .sort((a, b) => {
        if (!!a.isDefault !== !!b.isDefault) return a.isDefault ? -1 : 1;
        return (a.name || '').localeCompare(b.name || '');
      }),
    [invoiceTemplates]
  );

  const defaultLinkedAccountId = role === 'CUSTOMER' ? form.defaultARAccountId : form.defaultAPAccountId;
  const previewPartyCode = String(form.code || '').trim().toUpperCase();
  const parentAccount = subAccountParentId ? getAccountById(subAccountParentId) : undefined;
  const previewParentCode = (parentAccount as any)?.code || (parentAccount as any)?.userCode || '';
  const previewAccountCode = previewParentCode && previewPartyCode
    ? renderPartyAccountCode(partyAccountCodeFormat, {
      parent: previewParentCode,
      partyCode: previewPartyCode,
      seq: 1,
    })
    : '';

  const loadCurrencies = async () => {
    try {
      const res = await accountingApi.getCompanyCurrencies();
      setCurrencies((res?.currencies || []).filter(c => c.isEnabled).map(c => c.currencyCode));
    } catch (err) { console.error(err); }
  };

  const loadParty = async (id: string) => {
    try {
      setLoading(true);
      const data = await sharedApi.getParty(id);
      setForm(data);
      const existingAccountId = role === 'CUSTOMER' ? data.defaultARAccountId : data.defaultAPAccountId;
      setAccountStrategy(existingAccountId ? 'PICK_EXISTING' : '');
    } catch (err) { setError('Failed to load party details'); }
    finally { setLoading(false); }
  };

  const handleSave = async () => {
    const requiresExistingAccount = (!isNew || accountStrategy === 'PICK_EXISTING');

    if (isNew && !accountStrategy) {
      setError(t('parties.form.accounting.strategyRequired', 'Select an account strategy before saving.'));
      return;
    }
    if (requiresExistingAccount && !form.defaultARAccountId && role === 'CUSTOMER') {
      setError(t('parties.form.accounting.arRequired', 'Linked AR account is required for customers when using Pick Existing.'));
      return;
    }
    if (requiresExistingAccount && !form.defaultAPAccountId && role === 'VENDOR') {
      setError(t('parties.form.accounting.apRequired', 'Linked AP account is required for vendors when using Pick Existing.'));
      return;
    }
    if (isNew && accountStrategy === 'AUTO_CREATE' && !subAccountParentId) {
      setError(
        t(
          role === 'CUSTOMER'
            ? 'parties.form.accounting.missingArParent'
            : 'parties.form.accounting.missingApParent',
          role === 'CUSTOMER'
            ? 'Sales Settings is missing AR Parent Account. Configure it first.'
            : 'Purchase Settings is missing AP Parent Account. Configure it first.'
        )
      );
      return;
    }
    try {
      setSaving(true);
      setError(null);
      const createPayload = {
        ...form,
        accountStrategy,
      } as any;
      if (accountStrategy === 'AUTO_CREATE') {
        delete createPayload.defaultARAccountId;
        delete createPayload.defaultAPAccountId;
      }
      const res = isNew
        ? await sharedApi.createParty(createPayload)
        : await sharedApi.updateParty(partyId!, form);
      toast.success(isNew ? 'Created' : 'Updated');
      onSaved?.(res);
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to save';
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const syncCurrencyFromAccount = (account: any) => {
    if (!account) return;
    const accountCurrency = account.fixedCurrencyCode || account.currency;
    if (accountCurrency) {
      setForm(p => ({ ...p, defaultCurrency: accountCurrency }));
    }
  };

  const handleAutoGenerateCode = async () => {
    try {
      setError(null);
      const existing = await sharedApi.listParties({ role });
      const codes = (existing || []).map(p => p.code);
      const pattern = role === 'CUSTOMER' ? CODE_PATTERNS.CUSTOMER : CODE_PATTERNS.VENDOR;
      const nextCode = generateNextCode(codes, pattern);
      setForm(p => ({ ...p, code: nextCode }));
    } catch (err) {
      setError('Failed to suggest next code');
    }
  };

  if (loading) return <div className="p-20 text-center opacity-50 font-mono text-xs italic tracking-widest">Hydrating Master Table...</div>;

  return (
    <MasterCardLayout
      title={form.displayName || (role === 'VENDOR' ? 'Supplier' : 'Customer')}
      subtitle={isNew ? `Registering New Part - ${role}` : `${role} Master Record`}
      identifier={form.code}
      icon={role === 'VENDOR' ? Building2 : User}
      tabs={PARTY_TABS}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      isWindow={isWindow}
      isNew={isNew}
      saving={saving}
      canEdit={canEdit}
      onSave={handleSave}
      onClose={onClose}
      updatedAt={form.updatedAt}
      error={error}
    >
      {activeTab === 'GENERAL' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <FormSection title="Legal Identity">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label={`${role} Code`} required>
                <div className="relative flex items-center gap-1 group">
                   <input 
                      disabled={!isNew}
                      className="form-control font-bold pr-10" 
                      value={form.code} 
                      onChange={e => setForm(p => ({ ...p, code: e.target.value.toUpperCase() }))} 
                      placeholder={role === 'CUSTOMER' ? 'e.g. CUST-0001' : 'e.g. SUP-0001'}
                   />
                   {isNew && (
                      <button 
                        type="button"
                        onClick={handleAutoGenerateCode}
                        className="absolute right-2 p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/40 rounded transition-all opacity-0 group-hover:opacity-100"
                        title="Generate Next Code"
                      >
                         <Sparkles size={14} />
                      </button>
                   )}
                </div>
              </Field>
              <Field label="Tax / VAT Registration ID">
                <input className="form-control" value={form.taxId || ''} onChange={e => setForm(p => ({ ...p, taxId: e.target.value }))} />
              </Field>
              <div className="col-span-2">
                <Field label="Legal Entity Name (As per registration docs)" required>
                  <input className="form-control" value={form.legalName} onChange={e => setForm(p => ({ ...p, legalName: e.target.value }))} />
                </Field>
              </div>
              <div className="col-span-2">
                <Field label="Trading / Display Name" required>
                  <input className="form-control font-medium text-blue-600 dark:text-blue-400" value={form.displayName} onChange={e => setForm(p => ({ ...p, displayName: e.target.value }))} />
                </Field>
              </div>
            </div>
          </FormSection>
        </div>
      )}

      {activeTab === 'CONTACT' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <FormSection title="Engagement Details">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Contact Person">
                <input className="form-control" value={form.contactPerson || ''} onChange={e => setForm(p => ({ ...p, contactPerson: e.target.value }))} />
              </Field>
              <Field label="Record Status">
                 <select className="form-control font-bold" value={String(form.active)} onChange={e => setForm(p => ({ ...p, active: e.target.value === 'true' }))}>
                    <option value="true">ACTIVE</option>
                    <option value="false">SUSPENDED</option>
                 </select>
              </Field>
            </div>
          </FormSection>
          <FormSection title="Communication Channels">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Phone/Mobile Number">
                <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-lg bg-slate-100/50 dark:bg-slate-800/50 flex items-center justify-center text-slate-400 border border-slate-200 dark:border-slate-700 flex-shrink-0">
                       <Phone size={16} />
                    </div>
                    <input className="form-control" value={form.phone || ''} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
                </div>
              </Field>
              <Field label="Electronic Mail">
                 <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-lg bg-slate-100/50 dark:bg-slate-800/50 flex items-center justify-center text-slate-400 border border-slate-200 dark:border-slate-700 flex-shrink-0">
                       <Mail size={16} />
                    </div>
                    <input className="form-control" value={form.email || ''} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
                 </div>
              </Field>
              <div className="col-span-2">
                <Field label="Primary Address / HQ Location">
                  <div className="flex items-start gap-2">
                    <div className="w-9 h-9 rounded-lg bg-slate-100/50 dark:bg-slate-800/50 flex items-center justify-center text-slate-400 border border-slate-200 dark:border-slate-700 flex-shrink-0 mt-0.5">
                       <MapPin size={16} />
                    </div>
                    <textarea rows={3} className="form-control pt-2" value={form.address || ''} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} />
                  </div>
                </Field>
              </div>
            </div>
          </FormSection>
        </div>
      )}

      {activeTab === 'COMMERCIAL' && (
        <div className="space-y-6 animate-in fade-in duration-300">
           <FormSection title="Agreed Terms">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Payment Terms (Days Credit)">
                   <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800/50 flex-shrink-0">
                         <Clock size={16} />
                      </div>
                      <input type="number" className="form-control font-mono" value={form.paymentTermsDays || 0} onChange={e => setForm(p => ({ ...p, paymentTermsDays: parseInt(e.target.value) }))} />
                   </div>
                </Field>
                <Field label="Standard Currency">
                   <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/50 flex-shrink-0">
                         <Coins size={16} />
                      </div>
                      <select className="form-control font-bold text-emerald-700 dark:text-emerald-400" value={form.defaultCurrency || ''} onChange={e => setForm(p => ({ ...p, defaultCurrency: e.target.value }))}>
                        <option value="">(Currency Selection)</option>
                        {currencies.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                   </div>
                </Field>
              </div>
           </FormSection>

           {role === 'CUSTOMER' && (
             <FormSection title="Customer Segmentation & Credit">
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 <Field label="Customer Group">
                   <select className="form-control" value={form.customerGroupId || ''} onChange={e => setForm(p => ({ ...p, customerGroupId: e.target.value || undefined }))}>
                     <option value="">(No Group)</option>
                     {customerGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                   </select>
                 </Field>
                 <Field label="Default Price List">
                   <select className="form-control" value={form.defaultPriceListId || ''} onChange={e => setForm(p => ({ ...p, defaultPriceListId: e.target.value || undefined }))}>
                     <option value="">(No Price List)</option>
                     {priceLists.map(pl => <option key={pl.id} value={pl.id}>{pl.name} ({pl.currency})</option>)}
                   </select>
                 </Field>
                 <Field label="Credit Limit">
                   <input type="number" min={0} step={0.01} className="form-control font-mono" value={form.creditLimit ?? ''} onChange={e => setForm(p => ({ ...p, creditLimit: e.target.value === '' ? undefined : parseFloat(e.target.value) }))} />
                 </Field>
                 <Field label="Credit Hold Policy">
                   <select className="form-control" value={form.creditHoldPolicy || 'NONE'} onChange={e => setForm(p => ({ ...p, creditHoldPolicy: e.target.value as 'NONE' | 'WARN' | 'BLOCK' }))}>
                     <option value="NONE">NONE</option>
                     <option value="WARN">WARN</option>
                     <option value="BLOCK">BLOCK</option>
                   </select>
                 </Field>
                 <Field label="Tax Exempt">
                   <div className="flex items-center gap-2 pt-1">
                     <input type="checkbox" className="h-4 w-4 rounded border-slate-300" checked={!!form.taxExempt} onChange={e => setForm(p => ({ ...p, taxExempt: e.target.checked }))} />
                     <span className="form-control border-0 p-0 bg-transparent text-xs text-slate-500">Customer is tax exempt</span>
                   </div>
                 </Field>
                 <div className="sm:col-span-2">
                   <Field label={t('sales.invoiceTemplates.customerDefaultLabel', 'Default Invoice Template')}>
                     <select
                       className="form-control"
                       value={form.defaultSalesInvoiceTemplateId || ''}
                       onChange={e => {
                         const selectedId = e.target.value;
                         const selectedTemplate = defaultInvoiceTemplateOptions.find((entry) => entry.id === selectedId);
                         setForm(p => ({
                           ...p,
                           defaultSalesInvoiceTemplateId: selectedId,
                           defaultSalesInvoiceFormType: selectedTemplate?.formType || '',
                         }));
                       }}
                     >
                       <option value="">{t('sales.invoiceTemplates.none', '(No Template)')}</option>
                       {defaultInvoiceTemplateOptions.map((tpl) => (
                         <option key={tpl.id} value={tpl.id}>
                           {tpl.name}{tpl.isDefault ? ` ${t('sales.invoiceTemplates.defaultTag', '(Default)')}` : ''}
                         </option>
                       ))}
                     </select>
                     <p className="mt-1 text-[10px] text-slate-500">
                       {t(
                         'sales.invoiceTemplates.customerDefaultHelp',
                         'Used to pre-select the invoice print layout when creating new sales invoices for this customer.'
                       )}
                     </p>
                   </Field>
                 </div>
               </div>
             </FormSection>
           )}

           {role === 'VENDOR' && (
             <FormSection title={t('purchases.vendorGroups.vendorFormTitle', 'Vendor Segmentation')}>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 <Field label={t('purchases.vendorGroups.vendorFieldLabel', 'Vendor Group')}>
                   <select
                     className="form-control"
                     value={form.vendorGroupId || ''}
                     onChange={e => setForm(p => ({ ...p, vendorGroupId: e.target.value || undefined }))}
                   >
                     <option value="">{t('purchases.vendorGroups.noGroup', '(No Group)')}</option>
                     {vendorGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                   </select>
                 </Field>
               </div>
               <p className="mt-2 text-[10px] text-slate-500">
                 {t(
                   'purchases.vendorGroups.vendorFormHelp',
                   'Groups classify vendors for filtering and reporting. They do not change AP posting or payment behavior.'
                 )}
               </p>
             </FormSection>
           )}
        </div>
      )}

      {activeTab === 'ACCOUNTING' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <FormSection title={t('parties.form.accounting.title', 'Accounting')}>
            <div className="space-y-5 pt-2">
              <Field label={t('parties.form.accounting.strategyLabel', 'Account Strategy *')}>
                <div className="space-y-2">
                  <label className="flex items-start gap-2 rounded border border-slate-200 px-3 py-2 text-xs">
                    <input
                      type="radio"
                      name="party-account-strategy"
                      checked={accountStrategy === 'AUTO_CREATE'}
                      onChange={() => setAccountStrategy('AUTO_CREATE')}
                      disabled={!isNew}
                    />
                    <span>
                      <span className="font-semibold text-slate-800">
                        {t('parties.form.accounting.autoCreate', 'Auto-create sub-account')}
                      </span>
                      <span className="ml-1 text-slate-500">
                        {t('parties.form.accounting.autoCreateHelp', 'Creates a dedicated account from settings format and parent.')}
                      </span>
                    </span>
                  </label>

                  <label className="flex items-start gap-2 rounded border border-slate-200 px-3 py-2 text-xs">
                    <input
                      type="radio"
                      name="party-account-strategy"
                      checked={accountStrategy === 'PICK_EXISTING'}
                      onChange={() => setAccountStrategy('PICK_EXISTING')}
                    />
                    <span>
                      <span className="font-semibold text-slate-800">
                        {t('parties.form.accounting.pickExisting', 'Pick existing account')}
                      </span>
                      <span className="ml-1 text-slate-500">
                        {t('parties.form.accounting.pickExistingHelp', 'Manually bind this party to an existing AR/AP account.')}
                      </span>
                    </span>
                  </label>

                  {isNew && !accountStrategy && (
                    <p className="text-[11px] text-amber-700">
                      {t('parties.form.accounting.strategyPrompt', 'Choose one strategy before saving this party.')}
                    </p>
                  )}
                  {!isNew && (
                    <p className="text-[11px] text-slate-500">
                      {t('parties.form.accounting.strategyEditNote', 'Auto-create runs during new party creation. Existing parties can be remapped using Pick Existing.')}
                    </p>
                  )}
                </div>
              </Field>

              {accountStrategy === 'AUTO_CREATE' && (
                <div className="rounded-lg border border-indigo-100 bg-indigo-50/30 px-3 py-3 text-xs">
                  <p className="font-semibold text-indigo-900">
                    {t('parties.form.accounting.previewTitle', 'Generated account preview')}
                  </p>
                  {!subAccountParentId && (
                    <p className="mt-1 text-amber-700">
                      {t(
                        role === 'CUSTOMER'
                          ? 'parties.form.accounting.missingArParent'
                          : 'parties.form.accounting.missingApParent',
                        role === 'CUSTOMER'
                          ? 'Sales Settings is missing AR Parent Account. Configure it first.'
                          : 'Purchase Settings is missing AP Parent Account. Configure it first.'
                      )}
                    </p>
                  )}
                  {subAccountParentId && !previewPartyCode && (
                    <p className="mt-1 text-slate-600">
                      {t('parties.form.accounting.previewNeedsCode', 'Enter a party code to preview the generated account code.')}
                    </p>
                  )}
                  {subAccountParentId && previewPartyCode && (
                    <>
                      <p className="mt-1 text-slate-700">
                        {t('parties.form.accounting.previewFormat', 'Format: {{format}}', { format: partyAccountCodeFormat || PARTY_ACCOUNT_CODE_FORMAT_FALLBACK })}
                      </p>
                      <p className="mt-1 font-mono font-semibold text-indigo-900">
                        {previewAccountCode || t('parties.form.accounting.previewUnavailable', 'Preview unavailable')}
                      </p>
                    </>
                  )}
                </div>
              )}

              {(accountStrategy === 'PICK_EXISTING' || !isNew) && (
                <Field label={role === 'CUSTOMER' ? 'Accounts Receivable (A/R) *' : 'Accounts Payable (A/P) *'}>
                  <AccountSelector
                    value={defaultLinkedAccountId}
                    onChange={(a: any) => {
                      setForm((p) => ({ ...p, [role === 'CUSTOMER' ? 'defaultARAccountId' : 'defaultAPAccountId']: a?.id }));
                      syncCurrencyFromAccount(a);
                    }}
                    allowedClassifications={role === 'CUSTOMER' ? ['ASSET'] : ['LIABILITY']}
                    contextLabel={role === 'CUSTOMER' ? 'Asset' : 'Liability'}
                    enforceClassification
                  />
                  <p className="text-[9px] text-slate-400 mt-1 italic uppercase tracking-tighter">
                    {t('parties.form.accounting.accountHelp', 'Primary GL posting target for transactions associated with this party.')}
                  </p>
                </Field>
              )}
            </div>
          </FormSection>
        </div>
      )}

      <style>{`
        .form-control { width: 100%; border-radius: 0.375rem; border: 1px solid #cbd5e1; padding: 0.5rem 0.75rem; font-size: 0.75rem; outline: none; transition: all 0.2s; background: #fff; }
        .form-control:focus { border-color: #2563eb; ring: 2px solid #2563eb; }
        .dark .form-control { background: #0f172a; border-color: #334155; color: #f1f5f9; }
      `}</style>
    </MasterCardLayout>
  );
};

export default PartyMasterCard;
