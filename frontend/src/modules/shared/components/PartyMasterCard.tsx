
import React, { useState, useEffect } from 'react';
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
import { PartyDTO, PartyRole, sharedApi } from '../../../api/sharedApi';
import { accountingApi } from '../../../api/accountingApi';
import { useRBAC } from '../../../api/rbac/useRBAC';
import { AccountSelector } from '../../accounting/components/shared/AccountSelector';
import { MasterCardLayout, FormSection, Field, MasterCardTab } from '../../../components/layout/MasterCardLayout';
import { generateNextCode, CODE_PATTERNS } from '../../../utils/codeGenerator';
import { Sparkles } from 'lucide-react';

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
  const { hasPermission } = useRBAC();
  const [activeTab, setActiveTab] = useState('GENERAL');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currencies, setCurrencies] = useState<string[]>([]);

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
    if (!isNew && partyId) loadParty(partyId);
  }, [partyId]);

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
    } catch (err) { setError('Failed to load party details'); }
    finally { setLoading(false); }
  };

  const handleSave = async () => {
    if (!form.defaultARAccountId && role === 'CUSTOMER') {
        setError('Linked AR Account is required for Customers');
        return;
    }
    if (!form.defaultAPAccountId && role === 'VENDOR') {
        setError('Linked AP Account is required for Suppliers');
        return;
    }
    try {
      setSaving(true);
      setError(null);
      const res = isNew 
        ? await sharedApi.createParty(form)
        : await sharedApi.updateParty(partyId!, form);
      onSaved?.(res);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save');
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
        </div>
      )}

      {activeTab === 'ACCOUNTING' && (
        <div className="space-y-6 animate-in fade-in duration-300">
           <FormSection title="Financial Ledger Integration">
              <div className="space-y-5 pt-2">
                  <Field label={role === 'CUSTOMER' ? "Accounts Receivable (A/R) *" : "Accounts Payable (A/P) *"}>
                    <AccountSelector 
                        value={role === 'CUSTOMER' ? form.defaultARAccountId : form.defaultAPAccountId} 
                        onChange={(a: any) => {
                            setForm(p => ({ ...p, [role === 'CUSTOMER' ? 'defaultARAccountId' : 'defaultAPAccountId']: a?.id }));
                            syncCurrencyFromAccount(a);
                        }} 
                    />
                    <p className="text-[9px] text-slate-400 mt-1 italic uppercase tracking-tighter">Primary GL Posting Target for all transactions associated with this {role.toLowerCase()}.</p>
                 </Field>
                 
                 <Field label={role === 'CUSTOMER' ? "Accounts Payable (A/P) fallback" : "Accounts Receivable (A/R) fallback"}>
                    <AccountSelector 
                        value={role === 'CUSTOMER' ? form.defaultAPAccountId : form.defaultARAccountId} 
                        onChange={(a: any) => setForm(p => ({ ...p, [role === 'CUSTOMER' ? 'defaultAPAccountId' : 'defaultARAccountId']: a?.id }))} 
                    />
                    <p className="text-[9px] text-slate-400 mt-1 italic uppercase tracking-tighter">Secondary account for contra-entries or special adjustments.</p>
                 </Field>
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
