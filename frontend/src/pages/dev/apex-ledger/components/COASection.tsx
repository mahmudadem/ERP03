import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { COAAccount, AccountType, AccountClassification } from '../types';
import { 
  Folder, 
  FileText, 
  Plus, 
  Search, 
  ChevronDown, 
  ChevronRight, 
  HelpCircle,
  Sliders,
  X,
  AlertCircle
} from 'lucide-react';

interface COASectionProps {
  accounts: COAAccount[];
  setAccounts: React.Dispatch<React.SetStateAction<COAAccount[]>>;
}

export default function COASection({ accounts, setAccounts }: COASectionProps) {
  const { t } = useTranslation('common');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<AccountType | 'All'>('All');
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({
    '1': true,
    '101': true,
    '102': true,
    '103': true,
    '2': true,
    '201': true,
    '3': true,
    '4': true,
    '5': true
  });
  
  // Modal states
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedAccountForLedger, setSelectedAccountForLedger] = useState<COAAccount | null>(null);

  // Form states for New Account
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<AccountType>('Asset');
  const [newClass, setNewClass] = useState<AccountClassification>('Posting');
  const [newParentId, setNewParentId] = useState<string>('');
  const [newCurrency, setNewCurrency] = useState('SYP');
  const [newBalance, setNewBalance] = useState(0);
  const [newNotes, setNewNotes] = useState('');
  const [formError, setFormError] = useState('');

  // Handle manual code suggestion from parent match
  const handleParentSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const parentVal = e.target.value;
    setNewParentId(parentVal);
    if (!parentVal) {
      setNewCode('');
      return;
    }
    const parentAcct = accounts.find(a => a.id === parentVal);
    if (parentAcct) {
      setNewType(parentAcct.type);
      // Give a sensible code proposal based on standard hierarchy
      const children = accounts.filter(a => a.parentId === parentVal);
      if (children.length > 0) {
        // Increment the highest child code
        const maxCodeNum = Math.max(...children.map(c => parseInt(c.code) || 0));
        setNewCode((maxCodeNum + 1).toString());
      } else {
        // Appending to parent code
        setNewCode(`${parentAcct.code}01`);
      }
    }
  };

  const handleAddAccountSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!newCode || !newName) {
      setFormError(t('apex.coa.validationError', { defaultValue: 'Please fill in both the unique Account Code and Account Name.' }));
      return;
    }

    // Check code duplication
    if (accounts.some(a => a.code === newCode)) {
      setFormError(t('apex.coa.duplicateError', { defaultValue: `An account with code "${newCode}" already exists.`, code: newCode }));
      return;
    }

    const createdAccount: COAAccount = {
      id: Math.random().toString(36).substring(2, 11),
      code: newCode,
      name: newName,
      type: newType,
      classification: newClass,
      currency: newCurrency,
      parentId: newParentId || null,
      balance: Number(newBalance),
      isActive: true,
      notes: newNotes
    };

    setAccounts(prev => [...prev, createdAccount]);
    
    // Automatically expand the parent to make the new child visible
    if (newParentId) {
      setExpandedIds(prev => ({ ...prev, [newParentId]: true }));
    }

    // Reset Form
    setIsAddOpen(false);
    setNewCode('');
    setNewName('');
    setNewParentId('');
    setNewBalance(0);
    setNewNotes('');
  };

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleExpandAll = () => {
    const next: Record<string, boolean> = {};
    accounts.forEach(a => {
      if (a.classification === 'Header') {
        next[a.id] = true;
      }
    });
    setExpandedIds(next);
  };

  const handleCollapseAll = () => {
    setExpandedIds({});
  };

  const fmt = (num: number) => num.toLocaleString('en-US');

  // Filter accounts initially based on input & selection
  const visibleAccounts = useMemo(() => {
    return accounts.filter(a => {
      const matchesSearch = a.code.includes(searchTerm) || a.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = selectedType === 'All' || a.type === selectedType;
      return matchesSearch && matchesType;
    });
  }, [accounts, searchTerm, selectedType]);

  // Hierarchical helper to render recursively
  const buildTree = (parentId: string | null): COAAccount[] => {
    return accounts
      .filter(a => a.parentId === parentId)
      .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true, sensitivity: 'base' }));
  };

  // Render Row with correct level padding
  const renderAccountRow = (account: COAAccount, depth: number) => {
    const children = accounts.filter(a => a.parentId === account.id);
    const hasChildren = children.length > 0;
    const isExpanded = !!expandedIds[account.id];

    // If search term is active, we don't apply tree nesting because all matches are listed together
    const isSearching = searchTerm.trim().length > 0 || selectedType !== 'All';
    if (isSearching) {
      // check if it's already in our visible filtered array, if not we skip
      const isVisible = visibleAccounts.some(v => v.id === account.id);
      if (!isVisible) return null;
    }

    // Determine typography styles depending on node depth and level
    const isMainHeader = account.classification === 'Header' && depth === 0;
    const isSubHeader = account.classification === 'Header' && depth > 0;

    return (
      <React.Fragment key={account.id}>
        <div 
          onClick={() => setSelectedAccountForLedger(account)}
          className={`group flex items-center justify-between py-2 border-b border-zinc-100 hover:bg-slate-50 cursor-pointer transition-colors ${
            isMainHeader ? 'bg-zinc-50 border-t border-zinc-100' : ''
          }`}
          style={{ paddingLeft: isSearching ? '12px' : `${depth * 20 + 12}px` }}
        >
          {/* Code & Name Left portion */}
          <div className="flex items-center space-x-2.5 flex-1 min-w-0 pr-4">
            {!isSearching ? (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExpand(account.id);
                }}
                className={`w-5 h-5 rounded hover:bg-slate-200 flex items-center justify-center transition-colors ${
                  !hasChildren ? 'opacity-0 pointer-events-none' : ''
                }`}
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-zinc-500" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-zinc-500" />
                )}
              </button>
            ) : (
              <div className="w-2.5"></div>
            )}

            <span className="text-zinc-400 font-mono text-[11px] font-semibold tracking-wider tabular-nums w-14 block">
              {account.code}
            </span>

            {/* Folder/File Icon */}
            {account.classification === 'Header' ? (
              <Folder className={`w-4 h-4 ${isMainHeader ? 'text-blue-500' : 'text-amber-500'} flex-shrink-0`} />
            ) : (
              <FileText className="w-4 h-4 text-emerald-500 flex-shrink-0" />
            )}

            <span className={`truncate text-xs ${
              isMainHeader ? 'font-bold text-slate-800 text-[13px]' : isSubHeader ? 'font-bold text-slate-700' : 'font-medium text-slate-600'
            }`}>
              {account.name}
            </span>

            {/* Account Type Pills */}
            <span className={`text-[9px] font-bold font-mono px-1.5 py-0.5 rounded-full invisible group-hover:visible ${
              account.type === 'Asset' ? 'bg-blue-50 text-blue-600' :
              account.type === 'Liability' ? 'bg-amber-50 text-amber-600' :
              account.type === 'Equity' ? 'bg-purple-50 text-purple-600' :
              account.type === 'Revenue' ? 'bg-emerald-50 text-emerald-600' :
              'bg-rose-50 text-rose-600'
            }`}>
              {account.type.toUpperCase()}
            </span>
          </div>

          {/* Right portion: Classification & Balance */}
          <div className="flex items-center space-x-6 pr-3">
            <span className={`text-[10px] font-semibold tracking-wide font-sans rounded px-2 py-0.5 ${
              account.classification === 'Header' ? 'bg-[#F4F4F5] text-zinc-500' : 'bg-emerald-50 text-emerald-700'
            }`}>
              {account.classification}
            </span>

            <span className="text-[10px] font-mono text-slate-400 border border-slate-100 rounded px-1.5 py-0.5 font-bold uppercase">
              {account.currency}
            </span>

            <span className={`w-32 text-right font-mono text-xs tabular-nums ${
              isMainHeader ? 'font-black text-slate-800' : 'font-bold text-slate-700'
            }`}>
              {fmt(account.balance)}
            </span>
          </div>
        </div>

        {/* Child rendering recursively */}
        {!isSearching && isExpanded && hasChildren && (
          buildTree(account.id).map(child => renderAccountRow(child, depth + 1))
        )}
      </React.Fragment>
    );
  };

  return (
    <div className="space-y-4">
      {/* Search Header and Action Buttons */}
      <div className="bg-white p-4 rounded-lg border border-[#E2E8F0] shadow-[0_1px_3px_rgba(0,0,0,0.01)] space-y-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex-1 max-w-md relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              placeholder={t('apex.coa.searchPlaceholder', { defaultValue: 'Search by accounts code or name...' })}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-xs text-slate-700 placeholder-zinc-400 bg-zinc-50 hover:bg-zinc-100 focus:bg-white border border-[#E2E8F0] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-md py-2 pl-9 pr-3 outline-none"
            />
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={handleExpandAll}
              className="text-[11px] font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-1.5 rounded transition-all"
            >
              {t('apex.coa.expandAll', { defaultValue: 'Expand All' })}
            </button>
            <button
              onClick={handleCollapseAll}
              className="text-[11px] font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-1.5 rounded transition-all"
            >
              {t('apex.coa.collapseAll', { defaultValue: 'Collapse All' })}
            </button>
            <button
              onClick={() => setIsAddOpen(true)}
              className="inline-flex items-center text-[11px] font-bold text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded shadow-sm transition-all"
            >
              <Plus className="w-4 h-4 mr-1 text-white" />
              {t('apex.coa.newAccount', { defaultValue: 'New Account' })}
            </button>
          </div>
        </div>

        {/* Account Types Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 border-t border-zinc-100 pt-3">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mr-2 flex items-center gap-1">
            <Sliders className="w-3.5 h-3.5 inline" /> {t('apex.coa.filter', { defaultValue: 'Filter:' })}
          </span>
          {(['All', 'Asset', 'Liability', 'Equity', 'Revenue', 'Expense'] as const).map(type => (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              className={`text-[11px] font-bold px-2.5 py-1 rounded transition-colors ${
                selectedType === type
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {type === 'All' ? t('apex.coa.allClasses', { defaultValue: 'All Classes' }) : type}
            </button>
          ))}
        </div>
      </div>

      {/* Main Tree structure box */}
      <div className="bg-white rounded-lg border border-[#E2E8F0] shadow-sm overflow-hidden">
        {/* Header line of list */}
        <div className="flex items-center justify-between py-2.5 px-3 bg-zinc-50 border-b border-zinc-200 text-[10px] font-mono font-black text-slate-500 uppercase tracking-wider">
          <span>{t('apex.coa.codeAndName', { defaultValue: 'Account Code & Name' })}</span>
          <div className="flex items-center space-x-6 pr-3">
            <span className="w-20 text-center col-span-1">{t('apex.coa.class', { defaultValue: 'Class' })}</span>
            <span className="w-12 text-center col-span-1">{t('apex.coa.ccy', { defaultValue: 'CCY' })}</span>
            <span className="w-24 text-right col-span-1">{t('apex.coa.balance', { defaultValue: 'Balance SYP' })}</span>
          </div>
        </div>

        <div className="divide-y divide-zinc-150">
          {(searchTerm.trim() || selectedType !== 'All') ? (
            visibleAccounts.length > 0 ? (
              visibleAccounts.map(acct => renderAccountRow(acct, 0))
            ) : (
              <div className="p-8 text-center bg-[#FAFCFD]">
                <HelpCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <span className="text-xs text-slate-500 block">{t('apex.coa.noMatches', { defaultValue: 'No accounts match search criterion.' })}</span>
              </div>
            )
          ) : (
            buildTree(null).map(rootAcct => renderAccountRow(rootAcct, 0))
          )}
        </div>

        {/* Ledger Details Overlay / Bottom Side-Sheet drawer */}
        {selectedAccountForLedger && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex justify-end z-50 animate-fade-in">
            <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col p-6 overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
                <div>
                  <span className="text-[10px] font-bold tracking-widest font-mono text-zinc-400 block uppercase">
                    {t('apex.coa.drilldownTitle', { defaultValue: 'Account Ledger Drilldown' })}
                  </span>
                  <h3 className="text-sm font-black text-slate-800 mt-1">
                    [{selectedAccountForLedger.code}] - {selectedAccountForLedger.name}
                  </h3>
                </div>
                <button 
                  onClick={() => setSelectedAccountForLedger(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Drilldown metadata card */}
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-150 space-y-3 mb-6">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 font-medium block text-[10px]">{t('apex.coa.accountType', { defaultValue: 'ACCOUNT TYPE' })}</span>
                    <span className="font-bold text-slate-700">{selectedAccountForLedger.type}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-medium block text-[10px]">{t('apex.coa.classification', { defaultValue: 'CLASSIFICATION' })}</span>
                    <span className="font-bold text-slate-700">{selectedAccountForLedger.classification}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-medium block text-[10px]">{t('apex.coa.operationalValue', { defaultValue: 'OPERATIONAL VALUE' })}</span>
                    <span className="font-bold text-slate-800 font-mono text-xs">{fmt(selectedAccountForLedger.balance)} {selectedAccountForLedger.currency}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-medium block text-[10px]">{t('apex.coa.status', { defaultValue: 'STATUS' })}</span>
                    <span className="text-emerald-600 font-bold flex items-center gap-1 text-[11px]">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> {t('apex.coa.activeLedger', { defaultValue: 'Active Ledger' })}
                    </span>
                  </div>
                </div>

                {selectedAccountForLedger.notes && (
                  <div className="border-t border-slate-200/80 pt-2 text-[11px] text-slate-500">
                    <span className="font-bold text-[10px] text-zinc-400 block uppercase mb-0.5">{t('apex.coa.notesTitle', { defaultValue: 'Notes / Description' })}</span>
                    {selectedAccountForLedger.notes}
                  </div>
                )}
              </div>

              {/* Transactions/Ledger simulation table (Global standard look) */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 mb-2.5 uppercase tracking-wide">{t('apex.coa.postingEntries', { defaultValue: 'Journal Posting Entries Audited' })}</h4>
                <div className="border border-slate-150 rounded-lg overflow-hidden text-[11px]">
                  <div className="grid grid-cols-3 bg-slate-100 p-2 text-slate-500 font-mono font-bold border-b border-slate-200">
                    <span>{t('apex.coa.entryDate', { defaultValue: 'Entry / Date' })}</span>
                    <span className="text-right">{t('apex.coa.debitSyp', { defaultValue: 'Debit SYP' })}</span>
                    <span className="text-right">{t('apex.coa.creditSyp', { defaultValue: 'Credit SYP' })}</span>
                  </div>
                  
                  {/* Simulate detailed balancing book logs */}
                  <div className="divide-y divide-slate-100 bg-white font-mono text-[11px]">
                    <div className="grid grid-cols-3 p-2 hover:bg-slate-50">
                      <div>
                        <span className="block font-sans font-bold text-slate-700">JV-2026-081</span>
                        <span className="text-[10px] text-slate-400">2026-05-28</span>
                      </div>
                      <span className="text-right tabular-nums text-emerald-600">{selectedAccountForLedger.classification === 'Posting' ? fmt(selectedAccountForLedger.balance * 0.1) : '–'}</span>
                      <span className="text-right tabular-nums text-slate-400">–</span>
                    </div>
                    <div className="grid grid-cols-3 p-2 hover:bg-slate-50">
                      <div>
                        <span className="block font-sans font-bold text-slate-700">JV-2026-042</span>
                        <span className="text-[10px] text-slate-400">2026-05-15</span>
                      </div>
                      <span className="text-right tabular-nums text-slate-400">–</span>
                      <span className="text-right tabular-nums text-rose-600">{selectedAccountForLedger.classification === 'Posting' ? fmt(selectedAccountForLedger.balance * 0.05) : '–'}</span>
                    </div>
                    <div className="grid grid-cols-3 p-2 bg-slate-50 font-bold">
                      <span className="font-sans text-slate-600">{t('apex.coa.calcBalance', { defaultValue: 'Calculated Balance' })}</span>
                      <span className="text-right tabular-nums block font-black text-slate-800 col-span-2">{fmt(selectedAccountForLedger.balance)} SYP</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Create Account Drawer Module */}
        {isAddOpen && (
          <div className="fixed inset-0 bg-slate-900/45 backdrop-blur-xs flex justify-end z-50 animate-fade-in">
            <form 
              onSubmit={handleAddAccountSubmit}
              className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col p-6 overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
                <div>
                  <h3 className="text-sm font-black text-slate-800">
                    {t('apex.coa.configureTitle', { defaultValue: 'Configure & Register Account Node' })}
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">{t('apex.coa.configureDesc', { defaultValue: 'Define double-entry structural hierarchy following accounting rules.' })}</p>
                </div>
                <button 
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {formError && (
                <div className="bg-rose-50 text-rose-700 border border-rose-150 p-3 rounded-md text-xs flex items-start gap-2 mb-4">
                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="space-y-4 flex-1">
                {/* Parent Account selector */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">{t('apex.coa.parentNode', { defaultValue: 'Parent Node (Hierarchy)' })}</label>
                  <select
                    value={newParentId}
                    onChange={handleParentSelect}
                    className="w-full text-xs text-slate-700 bg-zinc-50 border border-[#E2E8F0] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-md p-2 outline-none"
                  >
                    <option value="">{t('apex.coa.noParent', { defaultValue: 'No Parent (Root Header Level)' })}</option>
                    {accounts.filter(a => a.classification === 'Header').map(parent => (
                      <option key={parent.id} value={parent.id}>
                        [{parent.code}] – {parent.name} ({parent.type})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Code */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">{t('apex.coa.accountCode', { defaultValue: 'Account Code' })}</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 10103"
                      value={newCode}
                      onChange={(e) => setNewCode(e.target.value)}
                      className="w-full text-xs text-slate-700 bg-zinc-50 border border-[#E2E8F0] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-md p-2 outline-none"
                    />
                  </div>

                  {/* Name */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">{t('apex.coa.accountName', { defaultValue: 'Account Name' })}</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Cash - Safe Box #3"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="w-full text-xs text-slate-700 bg-zinc-50 border border-[#E2E8F0] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-md p-2 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Account Classification */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">{t('apex.coa.classTarget', { defaultValue: 'Classification Target' })}</label>
                    <select
                      value={newClass}
                      onChange={(e) => setNewClass(e.target.value as AccountClassification)}
                      className="w-full text-xs text-slate-700 bg-zinc-50 border border-[#E2E8F0] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-md p-2 outline-none"
                    >
                      <option value="Posting">{t('apex.coa.classPosting', { defaultValue: 'Posting (Collects Ledger postings)' })}</option>
                      <option value="Header">{t('apex.coa.classHeader', { defaultValue: 'Header (Consolidation node only)' })}</option>
                    </select>
                  </div>

                  {/* Account Type */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">{t('apex.coa.accountType', { defaultValue: 'Account Type' })}</label>
                    <select
                      value={newType}
                      disabled={!!newParentId}
                      onChange={(e) => setNewType(e.target.value as AccountType)}
                      className="w-full text-xs text-slate-700 bg-zinc-50 border border-[#E2E8F0] disabled:bg-slate-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-md p-2 outline-none"
                    >
                      <option value="Asset">Asset</option>
                      <option value="Liability">Liability</option>
                      <option value="Equity">Equity</option>
                      <option value="Revenue">Revenue</option>
                      <option value="Expense">Expense</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Starting Balance */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">{t('apex.coa.openingBalance', { defaultValue: 'Opening Balance' })}</label>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={newBalance}
                      onChange={(e) => setNewBalance(Number(e.target.value))}
                      className="w-full text-xs text-slate-700 bg-zinc-50 border border-[#E2E8F0] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-md p-2 outline-none"
                    />
                  </div>

                  {/* Currency */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">{t('apex.coa.currencyOp', { defaultValue: 'Currency (Operational)' })}</label>
                    <select
                      value={newCurrency}
                      onChange={(e) => setNewCurrency(e.target.value)}
                      className="w-full text-xs text-slate-700 bg-zinc-50 border border-[#E2E8F0] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-md p-2 outline-none"
                    >
                      <option value="SYP">SYP (Syrian Pound)</option>
                      <option value="USD">USD (US Dollar)</option>
                      <option value="AED">AED (Emirati Dirham)</option>
                    </select>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">{t('apex.coa.descNotes', { defaultValue: 'Description / Notes' })}</label>
                  <textarea
                    placeholder="Enter details on the intended usage of this general ledger node..."
                    value={newNotes}
                    onChange={(e) => setNewNotes(e.target.value)}
                    rows={3}
                    className="w-full text-xs text-slate-700 bg-zinc-50 border border-[#E2E8F0] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-md p-2 outline-none resize-none"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-2 border-t border-slate-100 pt-4 mt-4">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="flex-1 text-[11px] font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 py-2 rounded-md transition-colors"
                >
                  {t('apex.coa.cancel', { defaultValue: 'Cancel' })}
                </button>
                <button
                  type="submit"
                  className="flex-1 text-[11px] font-bold text-white bg-blue-600 hover:bg-blue-700 py-2 rounded-md shadow-sm transition-colors"
                >
                  {t('apex.coa.createAndSave', { defaultValue: 'Create & Save Account' })}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
