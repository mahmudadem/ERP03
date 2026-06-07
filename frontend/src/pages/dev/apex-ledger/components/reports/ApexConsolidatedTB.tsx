import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Settings, ArrowUpRight, Info } from 'lucide-react';

/**
 * ApexConsolidatedTB — Placeholder
 *
 * Consolidated Trial Balance requires multi-company configuration.
 * This report aggregates trial balances across multiple tenant companies
 * and is only meaningful when the platform has subsidiary companies set up.
 */
export default function ApexConsolidatedTB() {
  const navigate = useNavigate();

  return (
    <div className="space-y-4 font-sans">
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-10 text-center space-y-5 max-w-lg mx-auto">
        <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto">
          <Building2 className="w-7 h-7 text-indigo-500" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-slate-800 mb-1">Consolidated Trial Balance</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            This report consolidates trial balances across multiple subsidiary companies.
            It requires multi-company configuration to be enabled.
          </p>
        </div>

        <div className="bg-indigo-50 border border-indigo-100 rounded-lg px-4 py-3 flex items-start gap-3 text-left">
          <Info className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
          <div className="text-xs text-indigo-700 leading-relaxed">
            <span className="font-bold block mb-0.5">Setup Required</span>
            To use this report, you need to:<br />
            1. Configure subsidiary companies in Admin<br />
            2. Set up inter-company elimination accounts<br />
            3. Define consolidation rules per fiscal year
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-2">
          <button
            onClick={() => navigate('/dev/apex-ledger/reports/trial-balance')}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2.5 rounded-lg transition-colors"
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            View Single-Company Trial Balance
          </button>
          <button
            onClick={() => navigate('/accounting/settings')}
            className="w-full flex items-center justify-center gap-2 bg-white border border-[#E2E8F0] hover:bg-slate-50 text-slate-700 text-xs font-semibold px-4 py-2.5 rounded-lg transition-colors"
          >
            <Settings className="w-3.5 h-3.5" />
            Go to Accounting Settings
          </button>
        </div>
      </div>
    </div>
  );
}
