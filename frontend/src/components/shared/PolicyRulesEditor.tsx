/**
 * PolicyRulesEditor.tsx — Shared business-language matrix editor for the
 * engine-owned typed `PolicyConfig` rules (Task 267-E).
 *
 * Reused by:
 *   - the company-wide Controls & Policies screen (no module lock)
 *   - the POS / Sales / Purchases per-module Controls tabs (module locked)
 *
 * Design rules (enforced by AGENTS.md):
 *   - business wording — the word "engine" never appears in user copy
 *   - module doorways lock the rule's module tag via `allowedModule` so
 *     rules can never accidentally be sent for another module
 *   - on save, the parent sends `{ rules }` to its own doorway; this
 *     component never forges a companyId (the axios client attaches
 *     `x-company-id` from the active company context)
 *   - module doorways never show or persist unscoped rules of other
 *     modules — the backend already filters GET and preserves other
 *     module rules on PUT; the editor simply renders what GET returns
 */
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { Card } from '../ui/Card';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import type {
  PolicyRule,
  PolicyEffect,
  PolicyRuleScope,
  PolicyAmountOp,
} from '../../api/controlsPoliciesApi';

export type AllowedModule = 'pos' | 'sales' | 'purchases' | 'accounting' | undefined;

const SCOPES: PolicyRuleScope[] = ['TENANT', 'MODULE', 'ROLE', 'USER', 'CONTEXT'];
const EFFECTS: PolicyEffect[] = ['ALLOW', 'BLOCK', 'REQUIRE_APPROVAL'];
const AMOUNT_OPS: PolicyAmountOp[] = ['>', '>=', '<', '<=', '==', '!='];

const newRuleId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `rule-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `rule-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
};

const cloneRule = (rule: PolicyRule): PolicyRule => ({ ...rule, conditions: { ...rule.conditions } });

interface PolicyRulesEditorProps {
  rules: PolicyRule[];
  onChange: (rules: PolicyRule[]) => void;
  /** When set, every rule is force-stamped with this module tag and the
   *  module cannot be changed. When unset (the company-wide matrix) the
   *  "Applies to area" dropdown lets the user pick any module. */
  allowedModule?: AllowedModule;
  /** Friendly labels for known actions (keyed by the action string). */
  knownActions?: string[];
  hasChanges: boolean;
}

export const PolicyRulesEditor: React.FC<PolicyRulesEditorProps> = ({
  rules,
  onChange,
  allowedModule,
  knownActions = ['directSale', 'invoicePosting', 'return', 'reprint', 'priceOverride', 'discountOverride', 'taxOverride', 'voidLine', 'belowCostSale'],
  hasChanges,
}) => {
  const { t } = useTranslation('controls');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);

  const moduleSelectOptions = useMemo(
    () => ['pos', 'sales', 'purchases', 'accounting'],
    []
  );

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const addRule = () => {
    const rule: PolicyRule = {
      id: newRuleId(),
      action: knownActions[0] || 'directSale',
      scope: 'MODULE',
      effect: 'ALLOW',
      ...(allowedModule ? { module: allowedModule } : {}),
    };
    onChange([...rules, rule]);
    setExpanded((prev) => new Set(prev).add(rule.id));
  };

  const removeRule = (id: string) => {
    onChange(rules.filter((r) => r.id !== id));
    setPendingRemoveId(null);
  };

  const patchRule = (id: string, patch: Partial<PolicyRule>) => {
    onChange(rules.map((r) => (r.id === id ? { ...cloneRule(r), ...patch } : r)));
  };

  const patchConditions = (id: string, patch: Partial<NonNullable<PolicyRule['conditions']>>) => {
    onChange(
      rules.map((r) =>
        r.id === id
          ? {
              ...cloneRule(r),
              conditions: { ...(r.conditions || {}), ...patch },
            }
          : r
      )
    );
  };

  const friendlyAction = (action: string): string =>
    t(`actionLabels.${action}`, { defaultValue: action });

  const friendlyModule = (module: string | undefined): string =>
    module ? t(`moduleLabels.${module}`, { defaultValue: module }) : t('scopes.TENANT');

  return (
    <Card padding="md" className="space-y-4">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-gray-900 dark:text-[var(--color-text-primary)]">
            {allowedModule ? t('moduleMatrixTitle', { module: t(`moduleLabels.${allowedModule}`) }) : t('companyMatrixTitle')}
          </h3>
          {allowedModule && (
            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-700">
              {t('moduleTagLocked', { module: t(`moduleLabels.${allowedModule}`) })}
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 dark:text-[var(--color-text-muted)]">
          {allowedModule
            ? t('moduleMatrixSubtitle', { module: t(`moduleLabels.${allowedModule}`) })
            : t('companyMatrixSubtitle')}
        </p>
      </div>

      {rules.length === 0 && !hasChanges ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/60 p-6 text-center dark:border-[var(--color-border)] dark:bg-[var(--color-bg-tertiary)]">
          <div className="text-sm font-semibold text-gray-700 dark:text-[var(--color-text-secondary)]">
            {t('empty.title')}
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-[var(--color-text-muted)]">
            {t('empty.description')}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-gray-500 dark:text-[var(--color-text-muted)]">
                <th className="px-2 py-2">{t('columns.whatItControls')}</th>
                <th className="px-2 py-2">{t('columns.appliesTo')}</th>
                <th className="px-2 py-2">{t('columns.behaviour')}</th>
                <th className="px-2 py-2">{t('columns.when')}</th>
                <th className="px-2 py-2 text-center">{t('columns.cannotBeOverridden')}</th>
                <th className="px-2 py-2 text-right">{t('columns.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => {
                const isOpen = expanded.has(rule.id);
                return (
                  <React.Fragment key={rule.id}>
                    <tr className="border-b last:border-b-0 align-top">
                      <td className="px-2 py-2">
                        <select
                          value={rule.action}
                          onChange={(e) => patchRule(rule.id, { action: e.target.value })}
                          className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-[var(--color-border)] dark:bg-[var(--color-bg-primary)]"
                        >
                          {knownActions.includes(rule.action) ? null : (
                            <option value={rule.action}>{rule.action}</option>
                          )}
                          {knownActions.map((action) => (
                            <option key={action} value={action}>
                              {friendlyAction(action)}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => toggleExpanded(rule.id)}
                          className="mt-1 inline-flex items-center gap-1 text-[11px] text-gray-400 hover:text-indigo-600"
                        >
                          {isOpen ? <ChevronRight className="h-3 w-3 rotate-90" /> : <ChevronDown className="h-3 w-3" />}
                          {t('advanced')}
                        </button>
                      </td>
                      <td className="px-2 py-2">
                        <select
                          value={rule.scope}
                          onChange={(e) => patchRule(rule.id, { scope: e.target.value as PolicyRuleScope })}
                          className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-[var(--color-border)] dark:bg-[var(--color-bg-primary)]"
                        >
                          {SCOPES.map((scope) => (
                            <option key={scope} value={scope}>
                              {t(`scopes.${scope}`)}
                            </option>
                          ))}
                        </select>
                        {!allowedModule && (
                          <select
                            value={rule.module ?? ''}
                            onChange={(e) => patchRule(rule.id, { module: e.target.value || undefined })}
                            className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 dark:border-[var(--color-border)] dark:bg-[var(--color-bg-primary)]"
                            aria-label={t('columns.appliesTo')}
                          >
                            <option value="">{t('scopes.TENANT')}</option>
                            {moduleSelectOptions.map((m) => (
                              <option key={m} value={m}>
                                {t(`moduleLabels.${m}`)}
                              </option>
                            ))}
                          </select>
                        )}
                        {allowedModule && (
                          <div className="mt-1 text-[10px] uppercase tracking-wide text-gray-400">
                            {friendlyModule(rule.module ?? allowedModule)}
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        <select
                          value={rule.effect}
                          onChange={(e) => patchRule(rule.id, { effect: e.target.value as PolicyEffect })}
                          className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-[var(--color-border)] dark:bg-[var(--color-bg-primary)]"
                        >
                          {EFFECTS.map((effect) => (
                            <option key={effect} value={effect}>
                              {t(`effects.${effect}`)}
                            </option>
                          ))}
                        </select>
                        {rule.effect === 'REQUIRE_APPROVAL' && (
                          <input
                            type="number"
                            value={rule.requireApprovalAbove ?? ''}
                            placeholder={t('fields.requireApprovalAbove')}
                            onChange={(e) =>
                              patchRule(rule.id, {
                                requireApprovalAbove: e.target.value === '' ? undefined : Number(e.target.value),
                              })
                            }
                            className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-xs dark:border-[var(--color-border)] dark:bg-[var(--color-bg-primary)]"
                            aria-label={t('fields.requireApprovalAbove')}
                          />
                        )}
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex gap-1">
                          <select
                            value={rule.conditions?.amount?.op ?? ''}
                            onChange={(e) =>
                              patchConditions(rule.id, {
                                amount: e.target.value
                                  ? { op: e.target.value as PolicyAmountOp, value: rule.conditions?.amount?.value ?? 0 }
                                  : undefined,
                              })
                            }
                            className="w-16 rounded border border-gray-300 px-1 py-1 text-xs dark:border-[var(--color-border)] dark:bg-[var(--color-bg-primary)]"
                            aria-label={t('fields.amountOp')}
                          >
                            <option value="">{t('fields.amountOp')}</option>
                            {AMOUNT_OPS.map((op) => (
                              <option key={op} value={op}>{op}</option>
                            ))}
                          </select>
                          <input
                            type="number"
                            value={rule.conditions?.amount?.value ?? ''}
                            placeholder={t('fields.amountValue')}
                            onChange={(e) => {
                              const v = e.target.value;
                              const op = rule.conditions?.amount?.op ?? '>';
                              patchConditions(rule.id, {
                                amount: v === '' ? undefined : { op, value: Number(v) },
                              });
                            }}
                            className="w-20 rounded border border-gray-300 px-1 py-1 text-xs dark:border-[var(--color-border)] dark:bg-[var(--color-bg-primary)]"
                            aria-label={t('fields.amountValue')}
                          />
                        </div>
                      </td>
                      <td className="px-2 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={rule.isHard === true}
                          onChange={(e) => patchRule(rule.id, { isHard: e.target.checked })}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                      </td>
                      <td className="px-2 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => setPendingRemoveId(rule.id)}
                          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          {t('removeRule')}
                        </button>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="border-b last:border-b-0">
                        <td colSpan={6} className="px-2 pb-3">
                          <div className="rounded-lg border border-gray-100 bg-gray-50/60 p-3 dark:border-[var(--color-border)] dark:bg-[var(--color-bg-tertiary)]">
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                              <label className="text-xs">
                                <span className="mb-1 block font-semibold text-gray-600 dark:text-[var(--color-text-secondary)]">{t('columns.id')}</span>
                                <input
                                  type="text"
                                  value={rule.id}
                                  onChange={(e) => patchRule(rule.id, { id: e.target.value })}
                                  className="w-full rounded border border-gray-300 px-2 py-1 font-mono text-xs dark:border-[var(--color-border)] dark:bg-[var(--color-bg-primary)]"
                                />
                              </label>
                              <label className="text-xs">
                                <span className="mb-1 block font-semibold text-gray-600 dark:text-[var(--color-text-secondary)]">{t('columns.priority')}</span>
                                <input
                                  type="number"
                                  value={rule.priority ?? 0}
                                  onChange={(e) => patchRule(rule.id, { priority: Number(e.target.value) })}
                                  className="w-full rounded border border-gray-300 px-2 py-1 text-xs dark:border-[var(--color-border)] dark:bg-[var(--color-bg-primary)]"
                                />
                              </label>
                              <label className="text-xs">
                                <span className="mb-1 block font-semibold text-gray-600 dark:text-[var(--color-text-secondary)]">{t('columns.reasonCode')}</span>
                                <input
                                  type="text"
                                  value={rule.reasonCode ?? ''}
                                  placeholder={t('fields.reasonCodePlaceholder')}
                                  onChange={(e) => patchRule(rule.id, { reasonCode: e.target.value || undefined })}
                                  className="w-full rounded border border-gray-300 px-2 py-1 font-mono text-xs dark:border-[var(--color-border)] dark:bg-[var(--color-bg-primary)]"
                                />
                              </label>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex justify-start">
        <button
          type="button"
          onClick={addRule}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" />
          {t('addRule')}
        </button>
      </div>

      <ConfirmDialog
        isOpen={pendingRemoveId !== null}
        title={t('confirmRemove.title')}
        message={t('confirmRemove.message')}
        confirmLabel={t('confirmRemove.confirm')}
        cancelLabel={t('confirmRemove.cancel')}
        tone="warning"
        onConfirm={() => pendingRemoveId && removeRule(pendingRemoveId)}
        onCancel={() => setPendingRemoveId(null)}
      />
    </Card>
  );
};

export default PolicyRulesEditor;