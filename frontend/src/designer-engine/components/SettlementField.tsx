/**
 * SettlementField.tsx — designer-engine adapter for the `settlement` field type (Task 186).
 *
 * The Field Library registers a single `settlement` `system_core` HEADER entry as a
 * *placement marker*: the designer decides WHERE the settlement control sits, the behavior
 * lives in code. This adapter is how the runtime form renderer (DynamicFieldRenderer) maps
 * that marker onto the shared, reactive `<SettlementBlock>`.
 *
 * SettlementBlock is a controlled component with granular props (mode/onModeChange,
 * rows/onRowsChange) and is fed host context (party AR/AP account, outstanding, payment
 * configs) rather than reaching for it. The dynamic renderer only hands us a single
 * `value`/`onChange` pair, so this adapter:
 *   - stores the block's state as one `SettlementValue` ({ mode, rows }) on the field value,
 *   - resolves host context from `field.settlementContext` (the host form populates it),
 *   - bridges granular mode/rows callbacks back into the single controlled value.
 *
 * Contract: planning/tasks/186-shared-settlement-panel-and-overpayment.md (Part C).
 */
import React from 'react';
import { FieldDefinition } from '../types/FieldDefinition';
import {
  SettlementBlock,
  SettlementMode,
  SettlementRow,
} from '../../components/shared/settlement/SettlementBlock';

export interface SettlementValue {
  mode: SettlementMode;
  rows: SettlementRow[];
}

interface Props {
  field: FieldDefinition;
  value: any;
  onChange: (value: SettlementValue) => void;
  readOnly?: boolean;
}

const normalize = (value: any): SettlementValue =>
  value && typeof value === 'object' && value.mode
    ? { mode: value.mode as SettlementMode, rows: Array.isArray(value.rows) ? value.rows : [] }
    : { mode: 'DEFERRED', rows: [] };

export const SettlementField: React.FC<Props> = ({ field, value, onChange, readOnly }) => {
  const ctx = field.settlementContext || {};
  const current = normalize(value);

  return (
    <SettlementBlock
      variant="editor"
      module={ctx.module || 'sales'}
      mode={current.mode}
      onModeChange={(mode) => onChange({ ...current, mode })}
      rows={current.rows}
      onRowsChange={(rows) => onChange({ ...current, rows })}
      partyAccountId={ctx.partyAccountId || ''}
      partyAccountLabel={ctx.partyAccountLabel}
      outstandingBase={ctx.outstandingBase ?? 0}
      paymentMethodConfigs={ctx.paymentMethodConfigs}
      allowOverpayment={ctx.allowOverpayment}
      currencyCode={ctx.currencyCode}
      readOnly={readOnly || field.readOnly}
    />
  );
};

export default SettlementField;
