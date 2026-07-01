import React from 'react';
import { X } from 'lucide-react';
import { Account } from '../../../api/accounting';
import { useTranslation } from 'react-i18next';

interface AccountDrilldownModalProps {
    isOpen: boolean;
    onClose: () => void;
    account: Account | null;
    currencyCode?: string;
}

export function AccountInfoPanel({ account, onClose, currencyCode, embedded = false }: AccountDrilldownModalProps & { embedded?: boolean }) {
    const { t } = useTranslation('accounting');

    if (!account) {
        return (
            <div className="h-full rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                    {t('accountsList.sidePanel.title', { defaultValue: 'Account Details' })}
                </p>
                <p className="mt-3 leading-relaxed">
                    {t('accountsList.sidePanel.empty', { defaultValue: 'Select an account from the tree to review its role, currency policy, status, and accounting controls.' })}
                </p>
            </div>
        );
    }

    const accountCurrency = currencyCode || account.fixedCurrencyCode || account.currency || '—';
    const isActive = account.status === 'ACTIVE' || account.isActive;

    return (
        <div className={`${embedded ? 'h-full rounded-lg border border-slate-200 shadow-sm' : 'h-full'} bg-white flex flex-col`}>
            <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between">
                <div className="min-w-0">
                    <p className="text-[11px] font-bold text-slate-400 tracking-widest uppercase mb-1">
                        {t('accountsList.sidePanel.title', { defaultValue: 'Account Details' })}
                    </p>
                    <h2 className="text-base font-extrabold text-slate-900 tracking-tight truncate">
                        {account.userCode} — {account.name}
                    </h2>
                </div>
                {!embedded && (
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                )}
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50/40">
                <div className="grid grid-cols-2 gap-3">
                    <InfoTile label={t('accountsList.sidePanel.role', { defaultValue: 'Role' })} value={account.accountRole || '—'} />
                    <InfoTile label={t('accountsList.sidePanel.classification', { defaultValue: 'Class' })} value={account.classification || account.type || '—'} />
                    <InfoTile label={t('accountsList.sidePanel.currency', { defaultValue: 'Currency' })} value={accountCurrency} />
                    <InfoTile label={t('accountsList.sidePanel.balanceNature', { defaultValue: 'Balance Nature' })} value={account.balanceNature || '—'} />
                    <InfoTile label={t('accountsList.sidePanel.currencyPolicy', { defaultValue: 'Currency Policy' })} value={account.currencyPolicy || '—'} />
                    <div className="rounded-lg border border-slate-200 bg-white p-3">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                            {t('accountsList.sidePanel.status', { defaultValue: 'Status' })}
                        </p>
                        <div className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-bold ${isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                            {isActive
                                ? t('accountsList.sidePanel.active', { defaultValue: 'Active' })
                                : t('accountsList.sidePanel.inactive', { defaultValue: 'Inactive' })}
                        </div>
                    </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-4">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                        {t('accountsList.sidePanel.controls', { defaultValue: 'Accounting Controls' })}
                    </p>
                    <div className="space-y-2 text-xs text-slate-600">
                        <ControlRow label={t('accountsList.sidePanel.postingAllowed', { defaultValue: 'Posting allowed' })} value={account.accountRole === 'POSTING' ? t('common.yes', { defaultValue: 'Yes' }) : t('common.no', { defaultValue: 'No' })} />
                        <ControlRow label={t('accountsList.sidePanel.protected', { defaultValue: 'Protected account' })} value={account.isProtected ? t('common.yes', { defaultValue: 'Yes' }) : t('common.no', { defaultValue: 'No' })} />
                        <ControlRow label={t('accountsList.sidePanel.approval', { defaultValue: 'Requires approval' })} value={account.requiresApproval ? t('common.yes', { defaultValue: 'Yes' }) : t('common.no', { defaultValue: 'No' })} />
                        <ControlRow label={t('accountsList.sidePanel.custody', { defaultValue: 'Custody confirmation' })} value={account.requiresCustodyConfirmation ? t('common.yes', { defaultValue: 'Yes' }) : t('common.no', { defaultValue: 'No' })} />
                    </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-4">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                        {t('accountsList.sidePanel.description', { defaultValue: 'Description' })}
                    </p>
                    <p className="text-sm leading-relaxed text-slate-600">
                        {account.description || t('accountsList.sidePanel.noDescription', { defaultValue: 'No description is recorded for this account.' })}
                    </p>
                </div>

                <div className="rounded-lg border border-dashed border-slate-300 bg-white/70 p-4 text-xs text-slate-500">
                    {t('accountsList.sidePanel.ledgerHint', { defaultValue: 'Ledger balances and recent journal entries should be loaded from the account statement/report flow, not hardcoded in this panel.' })}
                </div>
            </div>
        </div>
    );
}

function InfoTile({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="rounded-lg border border-slate-200 bg-white p-3">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{label}</p>
            <p className="font-semibold text-slate-900 text-sm capitalize">{value}</p>
        </div>
    );
}

function ControlRow({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="flex items-center justify-between gap-3">
            <span>{label}</span>
            <span className="font-bold text-slate-800">{value}</span>
        </div>
    );
}

export function AccountDrilldownModal({ isOpen, onClose, account, currencyCode }: AccountDrilldownModalProps) {
    if (!isOpen || !account) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/40 z-40 transition-opacity xl:hidden"
                onClick={onClose}
            />

            {/* Slide-over panel */}
            <div className="fixed inset-y-0 end-0 z-50 w-full max-w-md shadow-xl transform transition-transform duration-300 ease-in-out border-s border-gray-200 flex flex-col h-full xl:hidden">
                <AccountInfoPanel isOpen={isOpen} onClose={onClose} account={account} currencyCode={currencyCode} />
            </div>
        </>
    );
}
