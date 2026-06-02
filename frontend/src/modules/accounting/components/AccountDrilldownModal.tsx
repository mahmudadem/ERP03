import React from 'react';
import { X } from 'lucide-react';
import { Account } from '../../../api/accounting';

interface AccountDrilldownModalProps {
    isOpen: boolean;
    onClose: () => void;
    account: Account | null;
}

export function AccountDrilldownModal({ isOpen, onClose, account }: AccountDrilldownModalProps) {
    if (!isOpen || !account) return null;

    return (
        <>
            {/* Backdrop */}
            <div 
                className="fixed inset-0 bg-black/40 z-40 transition-opacity"
                onClick={onClose}
            />

            {/* Slide-over panel */}
            <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-xl transform transition-transform duration-300 ease-in-out border-l border-gray-200 flex flex-col h-full">
                
                {/* Header */}
                <div className="px-6 py-5 border-b border-gray-100 flex items-start justify-between">
                    <div>
                        <p className="text-[11px] font-bold text-gray-400 tracking-widest uppercase mb-1">
                            Account Ledger Drilldown
                        </p>
                        <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">
                            [{account.userCode}] - {account.name}
                        </h2>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-1 rounded-full text-gray-400 hover:text-gray-500 hover:bg-gray-100 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50/30">
                    
                    {/* Summary Card */}
                    <div className="bg-white border border-gray-900 rounded-xl overflow-hidden shadow-sm">
                        <div className="grid grid-cols-2 gap-4 p-5">
                            <div>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Account Type</p>
                                <p className="font-semibold text-gray-900 capitalize">
                                    {account.classification?.toLowerCase() || 'Asset'}
                                </p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Classification</p>
                                <p className="font-semibold text-gray-900 capitalize">
                                    {account.accountRole?.toLowerCase() || 'Posting'}
                                </p>
                            </div>
                            <div className="pt-2">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Operational Value</p>
                                <p className="font-bold text-gray-900">
                                    -
                                </p>
                            </div>
                            <div className="pt-2">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Status</p>
                                <div className="flex items-center gap-1.5 font-semibold text-emerald-600 text-sm">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                                    {account.status === 'ACTIVE' || account.isActive ? 'Active Ledger' : 'Inactive'}
                                </div>
                            </div>
                        </div>
                        
                        <div className="px-5 py-4 border-t border-gray-100 bg-gray-50/50">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Notes / Description</p>
                            <p className="text-sm text-gray-600">
                                {account.description || 'Main safe vault at corporate headquarters'}
                            </p>
                        </div>
                    </div>

                    {/* Journal Entries Section */}
                    <div>
                        <h3 className="text-xs font-bold text-gray-600 uppercase tracking-widest mb-3">
                            Journal Posting Entries Audited
                        </h3>
                        
                        <div className="bg-white border border-gray-900 rounded-xl overflow-hidden shadow-sm">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50/80 border-b border-gray-200">
                                    <tr>
                                        <th className="px-4 py-3 font-semibold text-gray-600">Entry / Date</th>
                                        <th className="px-4 py-3 font-semibold text-gray-600 text-right">Debit SYP</th>
                                        <th className="px-4 py-3 font-semibold text-gray-600 text-right">Credit SYP</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td colSpan={3} className="px-4 py-8 text-center text-gray-400 font-medium">
                                            No recent entries found.
                                        </td>
                                    </tr>
                                </tbody>
                                <tfoot className="bg-gray-50 border-t border-gray-200">
                                    <tr>
                                        <td className="px-4 py-3 font-bold text-gray-700">Calculated Ledger<br/>Balance</td>
                                        <td colSpan={2} className="px-4 py-3 text-right font-extrabold text-gray-900">
                                            -
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                    
                </div>
            </div>
        </>
    );
}
