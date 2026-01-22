import React from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { UserCompany } from './api';
import { formatCompanyDate } from '../../utils/dateUtils';

interface Props {
  company: UserCompany;
  onEnter: (companyId: string) => void;
}

export const CompanyCard: React.FC<Props> = ({ company, onEnter }) => {
  // Use the first letter of each word for the fallback avatar, up to 2 letters
  const initials = company.name
    .split(/\s+/)
    .map(word => word.charAt(0))
    .join('')
    .substring(0, 2)
    .toUpperCase() || '?';

  // Role display mapping
  const roleDisplay = company.roleId || company.role || 'Member';

  return (
    <Card 
      className="p-5 flex flex-col justify-between hover:shadow-xl hover:border-blue-200 transition-all duration-300 group cursor-pointer bg-white min-h-[220px]" 
      onClick={() => onEnter(company.id)}
    >
      <div className="space-y-5">
        <div className="flex items-start gap-4">
          {/* Logo Container - Fixed size with strict constraints */}
          <div className="h-16 w-16 rounded-2xl border border-gray-100 bg-gray-50 flex items-center justify-center overflow-hidden flex-shrink-0 shadow-sm group-hover:shadow transition-all duration-300">
            {company.logoUrl && company.logoUrl.length > 10 ? (
              <img 
                src={company.logoUrl} 
                alt={`${company.name} Logo`} 
                className="max-h-full max-w-full object-contain p-2 transition-transform duration-500 group-hover:scale-110" 
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  const parent = e.currentTarget.parentElement;
                  if (parent && !parent.querySelector('.fallback-avatar')) {
                    const fallback = document.createElement('div');
                    fallback.className = "fallback-avatar h-full w-full bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center font-bold text-xl";
                    fallback.innerText = initials;
                    parent.appendChild(fallback);
                  }
                }}
              />
            ) : (
              <div className="h-full w-full bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center font-bold text-xl tracking-wider">
                {initials}
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0 pt-1">
            <h3 className="text-lg font-bold text-gray-900 truncate group-hover:text-blue-600 transition-colors leading-tight">
              {company.name}
            </h3>
            <div className="mt-1 flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                {company.model || 'Business'} • {roleDisplay}
              </p>
            </div>
          </div>
        </div>
        
        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-50/80 p-2.5 rounded-xl border border-slate-100/50">
            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-tight mb-0.5">Created</p>
            <p className="text-xs text-slate-700 font-medium">{formatCompanyDate(company.createdAt, null)}</p>
          </div>
          {company.lastAccessedAt && (
            <div className="bg-blue-50/50 p-2.5 rounded-xl border border-blue-100/30">
              <p className="text-[10px] text-blue-400 uppercase font-bold tracking-tight mb-0.5">Last active</p>
              <p className="text-xs text-blue-700 font-medium">{formatCompanyDate(company.lastAccessedAt, null)}</p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 pt-4 border-t border-gray-50">
        <Button 
          onClick={(e) => {
            e.stopPropagation();
            onEnter(company.id);
          }} 
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-11 rounded-xl shadow-md shadow-blue-100 transition-all flex items-center justify-center gap-2 group/btn"
        >
          Enter Workspace
          <span className="transition-transform duration-300 group-hover/btn:translate-x-1">→</span>
        </Button>
      </div>
    </Card>
  );
};
