/**
 * Business Rules Panel
 * 
 * UI for configuring Layer 2 business rules in the Forms Designer.
 * Allows users to set rule outcomes: BLOCK / ALLOW_WITH_WARN / BLOCK_AND_WARN / ALLOW
 */

import React from 'react';
import { AlertTriangle, Shield, CheckCircle, XCircle, AlertCircle, Info } from 'lucide-react';
import { DocumentFormConfig } from '../types';

export interface BusinessRuleState {
  requirePositiveTotal?: {
    enabled: boolean;
    outcome: 'BLOCK' | 'ALLOW_WITH_WARN' | 'BLOCK_AND_WARN' | 'ALLOW';
  };
  preventBelowCost?: {
    enabled: boolean;
    outcome: 'BLOCK' | 'ALLOW_WITH_WARN' | 'BLOCK_AND_WARN' | 'ALLOW';
  };
  enforceCreditLimit?: {
    enabled: boolean;
    outcome: 'BLOCK' | 'ALLOW_WITH_WARN' | 'BLOCK_AND_WARN' | 'ALLOW';
  };
  requireWarehouse?: {
    enabled: boolean;
    outcome: 'BLOCK' | 'ALLOW_WITH_WARN' | 'BLOCK_AND_WARN' | 'ALLOW';
  };
  minLineCount?: {
    enabled: boolean;
    outcome: 'BLOCK' | 'ALLOW_WITH_WARN' | 'BLOCK_AND_WARN' | 'ALLOW';
    value?: number;
  };
}

interface Props {
  form: DocumentFormConfig;
  rules: BusinessRuleState;
  onChange: (rules: BusinessRuleState) => void;
}

const outcomeOptions = [
  { value: 'BLOCK', label: 'Block', icon: XCircle, description: 'Save disabled', color: 'text-red-600' },
  { value: 'ALLOW_WITH_WARN', label: 'Warn Only', icon: AlertTriangle, description: 'Save enabled, shows warning', color: 'text-amber-600' },
  { value: 'BLOCK_AND_WARN', label: 'Block + Warn', icon: Shield, description: 'Save disabled with detailed warning', color: 'text-orange-600' },
  { value: 'ALLOW', label: 'Allow', icon: CheckCircle, description: 'No validation', color: 'text-emerald-600' },
] as const;

export const BusinessRulesPanel: React.FC<Props> = ({ form, rules, onChange }) => {
  const handleRuleChange = (
    ruleKey: keyof BusinessRuleState,
    updates: Partial<NonNullable<BusinessRuleState[keyof BusinessRuleState]>>
  ) => {
    const currentRule = rules[ruleKey] || { enabled: false, outcome: 'BLOCK' as const };
    onChange({
      ...rules,
      [ruleKey]: { ...currentRule, ...updates },
    });
  };

  const RuleRow: React.FC<{
    ruleKey: keyof BusinessRuleState;
    title: string;
    description: string;
    showMinCount?: boolean;
  }> = ({ ruleKey, title, description, showMinCount }) => {
    const rule = rules[ruleKey] || { enabled: false, outcome: 'BLOCK' as const };
    const IconComponent = outcomeOptions.find(o => o.value === rule.outcome)?.icon || AlertCircle;

    return (
      <div className="border border-gray-200 rounded-lg p-4 bg-white hover:border-gray-300 transition-colors">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold text-gray-900">{title}</h4>
              {rule.enabled && (
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                  rule.outcome === 'BLOCK' ? 'bg-red-100 text-red-700' :
                  rule.outcome === 'ALLOW_WITH_WARN' ? 'bg-amber-100 text-amber-700' :
                  rule.outcome === 'BLOCK_AND_WARN' ? 'bg-orange-100 text-orange-700' :
                  'bg-emerald-100 text-emerald-700'
                }`}>
                  <IconComponent className="w-3 h-3" />
                  {outcomeOptions.find(o => o.value === rule.outcome)?.label}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">{description}</p>
            
            {showMinCount && rule.enabled && (
              <div className="mt-3 flex items-center gap-2">
                <label className="text-xs text-gray-600">Minimum lines:</label>
                <input
                  type="number"
                  min="1"
                  value={rule.value || 1}
                  onChange={(e) => handleRuleChange(ruleKey, { value: parseInt(e.target.value) || 1 })}
                  className="w-20 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Enable Toggle */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={rule.enabled || false}
                onChange={(e) => handleRuleChange(ruleKey, { enabled: e.target.checked })}
                className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
              />
              <span className="text-xs font-medium text-gray-700">Enabled</span>
            </label>

            {/* Outcome Dropdown */}
            {rule.enabled && (
              <div className="relative">
                <select
                  value={rule.outcome}
                  onChange={(e) => handleRuleChange(ruleKey, { outcome: e.target.value as any })}
                  className="appearance-none pl-8 pr-8 py-1.5 border border-gray-300 rounded-lg text-sm font-medium bg-white hover:border-gray-400 focus:ring-2 focus:ring-primary-500 outline-none cursor-pointer"
                >
                  {outcomeOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <IconComponent className={`absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 ${
                  rule.outcome === 'BLOCK' ? 'text-red-600' :
                  rule.outcome === 'ALLOW_WITH_WARN' ? 'text-amber-600' :
                  rule.outcome === 'BLOCK_AND_WARN' ? 'text-orange-600' :
                  'text-emerald-600'
                }`} />
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-900">Business Rules</h3>
          <p className="text-sm text-gray-500 mt-1">
            Configure validation rules for this form. Rules can block save or show warnings.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Info className="w-4 h-4" />
          <span>Rules apply after structural validation passes</span>
        </div>
      </div>

      {/* Rule Rows */}
      <div className="space-y-3">
        <RuleRow
          ruleKey="requirePositiveTotal"
          title="Require Positive Total"
          description="Document total amount must be greater than zero"
        />

        <RuleRow
          ruleKey="preventBelowCost"
          title="Prevent Below Cost Sales"
          description="Items cannot be priced below their cost"
        />

        <RuleRow
          ruleKey="enforceCreditLimit"
          title="Enforce Credit Limit"
          description="Check customer credit limit before saving"
        />

        <RuleRow
          ruleKey="requireWarehouse"
          title="Require Warehouse"
          description="Line items must have a warehouse assigned"
        />

        <RuleRow
          ruleKey="minLineCount"
          title="Minimum Line Count"
          description="Require a minimum number of line items"
          showMinCount
        />
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">Rule Outcomes</p>
            <ul className="space-y-1 text-blue-700">
              <li><strong>Block:</strong> Save button disabled until rule passes</li>
              <li><strong>Warn Only:</strong> Save enabled, warning shown with amber indicator</li>
              <li><strong>Block + Warn:</strong> Save disabled with detailed warning message</li>
              <li><strong>Allow:</strong> No validation (rule effectively disabled)</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
