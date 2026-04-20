/**
 * DynamicFieldRenderer.tsx
 * Renders a single input based on FieldDefinition.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { FieldDefinition } from '../types/FieldDefinition';
import { useCompanySettings } from '../../hooks/useCompanySettings';
import { formatCompanyDate } from '../../utils/dateUtils';
import { DatePicker } from '../../modules/accounting/components/shared/DatePicker';
import { PartySelector, ItemSelector, WarehouseSelector } from '../../components/shared/selectors';
import { AccountSelector } from '../../modules/accounting/components/shared/AccountSelector';
import { CostCenterSelector } from '../../modules/accounting/components/shared/CostCenterSelector';

interface Props {
  field: FieldDefinition;
  value: any;
  error?: string;
  onChange: (value: any) => void;
  customComponents?: Record<string, React.ComponentType<any>>;
  className?: string;
  noBorder?: boolean;
  readOnly?: boolean;
}

export const DynamicFieldRenderer: React.FC<Props> = ({ field, value, error, onChange, customComponents, className, noBorder, readOnly }) => {
  const { settings } = useCompanySettings();
  const { t } = useTranslation('accounting');

  const label = React.useMemo(() => {
    const key = (field as any).labelTranslationKey || `voucherRenderer.fields.${field.id}`;
    return t(key, { defaultValue: field.label || field.name || field.id });
  }, [field.label, (field as any).labelTranslationKey, field.name, field.id, t]);
  
  // Custom Styles from Definition
  const style = field.style || {};
  const customInputStyle = {
    color: style.color,
    backgroundColor: style.backgroundColor,
    fontWeight: style.fontWeight as any,
    fontSize: style.fontSize === 'sm' ? '0.875rem' : style.fontSize === 'lg' ? '1.125rem' : style.fontSize === 'xl' ? '1.25rem' : undefined,
    padding: style.padding,
    borderWidth: style.borderWidth,
    borderColor: style.borderColor,
    borderRadius: style.borderRadius,
    textAlign: style.textAlign as any,
    textTransform: style.textTransform as any,
  };

  const baseInputClass = `
    w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors
    ${error ? 'border-red-500 bg-red-50' : (style.borderColor ? '' : 'border-gray-300')}
    ${(field.readOnly || readOnly) ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : (style.backgroundColor ? '' : 'bg-white')}
  `;

  const renderInput = () => {
    if (customComponents && customComponents[field.type]) {
      const Component = customComponents[field.type];
      return (
        <Component
          value={value}
          onChange={onChange}
          field={field}
          error={error}
          disabled={field.readOnly}
          noBorder={noBorder}
        />
      );
    }

    switch (field.type) {
      case 'TEXT':
      case 'RELATION': 
      case 'party-selector':
      case 'item-selector':
      case 'warehouse-selector':
        {
          const lowerId = field.id.toLowerCase();
          const lowerName = (field.name || '').toLowerCase();
          const lowerLabel = (label || '').toLowerCase();
          const target = (field as any).relationTarget?.toLowerCase() || '';
          const type = field.type as string;
          
          const isLineItemsField = lowerId === 'lineitems' || lowerName === 'lineitems';

          // Auto-detect Party Selectors
          if (type === 'party-selector' || 
              target === 'customers' || target === 'vendors' || target === 'parties' ||
              lowerId.includes('customer') || lowerId.includes('vendor') || lowerId.includes('party') ||
              lowerName.includes('customer') || lowerName.includes('vendor') || lowerName.includes('party') ||
              lowerLabel.includes('customer') || lowerLabel.includes('vendor') || lowerLabel.includes('party')) {
            return (
              <PartySelector 
                value={value || ''}
                onChange={(party) => onChange(party?.id || party?.code || '')}
                disabled={field.readOnly || readOnly}
              />
            );
          }

          // Auto-detect Item Selectors
          if (!isLineItemsField && (type === 'item-selector' || 
              target === 'items' || target === 'products' ||
              lowerId.includes('item') || lowerId.includes('sku') || lowerId.includes('product') ||
              lowerName.includes('item') || lowerName.includes('sku') || lowerName.includes('product') ||
              lowerLabel.includes('item') || lowerLabel.includes('sku') || lowerLabel.includes('product'))) {
            return (
              <ItemSelector 
                value={value || ''}
                onChange={(item) => onChange(item?.id || item?.code || '')}
                disabled={field.readOnly || readOnly}
              />
            );
          }

          // Auto-detect Warehouse Selectors
          if (type === 'warehouse-selector' || 
              target === 'warehouses' || target === 'stores' ||
              lowerId.includes('warehouse') || lowerId.includes('store') ||
              lowerName.includes('warehouse') || lowerName.includes('store') ||
              lowerLabel.includes('warehouse') || lowerLabel.includes('store')) {
            return (
              <WarehouseSelector 
                value={value || ''}
                onChange={(wh) => onChange(wh?.id || wh?.code || '')}
                disabled={field.readOnly || readOnly}
              />
            );
          }

          return (
            <input
              type="text"
              className={baseInputClass}
              style={customInputStyle}
              placeholder={field.placeholder || t('voucherRenderer.selectPlaceholder')}
              value={value || ''}
              onChange={(e) => onChange(e.target.value)}
              disabled={field.readOnly || readOnly}
            />
          );
        }

      case 'NUMBER':
        return (
          <input
            type="number"
            className={baseInputClass}
            style={customInputStyle}
            placeholder={field.placeholder}
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={field.readOnly || readOnly}
          />
        );

      case 'DATE':
        return (
          <DatePicker
            value={value || ''}
            onChange={onChange}
            disabled={field.readOnly || readOnly}
          />
        );

      case 'account-selector':
        return (
          <AccountSelector 
            value={value || ''}
            onChange={(accId) => onChange(accId)}
            disabled={field.readOnly || readOnly}
          />
        );

      case 'cost-center-selector':
        return (
          <CostCenterSelector 
            value={value || ''}
            onChange={(ccId) => onChange(ccId)}
            disabled={field.readOnly || readOnly}
          />
        );

      case 'CHECKBOX':
        return (
          <div className="flex items-center h-full">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              checked={!!value}
              onChange={(e) => onChange(e.target.checked)}
              disabled={field.readOnly || readOnly}
            />
            <span className="ml-2 text-sm text-gray-700" style={{ color: style.color }}>{field.placeholder || t('voucherRenderer.checkboxYes')}</span>
          </div>
        );

      case 'SELECT':
        return (
          <select
            className={baseInputClass}
            style={customInputStyle}
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={field.readOnly || readOnly}
          >
            <option value="">{t('voucherRenderer.selectPlaceholder')}</option>
            {field.options?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        );

      case 'TEXTAREA':
        return (
          <textarea
            className={baseInputClass}
            style={customInputStyle}
            rows={3}
            placeholder={field.placeholder}
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={field.readOnly || readOnly}
          />
        );

      default:
        return <div className="text-red-500 text-xs">{t('voucherRenderer.unknownType')}</div>;
    }
  };

  return (
    <div className={`flex flex-col ${field.hidden ? 'hidden' : ''} ${className || ''}`}>
      <label 
        className="mb-1 text-xs font-medium text-gray-700"
        style={{
            color: style.color, 
            fontWeight: style.fontWeight,
            fontSize: style.fontSize,
            fontStyle: style.fontStyle,
            textAlign: style.textAlign,
            textTransform: style.textTransform
        }}
      >
        {label} {field.required && <span className="text-red-500">*</span>}
      </label>
      {renderInput()}
      {error && <span className="mt-1 text-xs text-red-500">{error}</span>}
    </div>
  );
};
