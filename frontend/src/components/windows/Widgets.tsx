import React from 'react';
import { WindowComponent } from '../../types/WindowConfig';

interface WidgetProps {
  widget: WindowComponent;
  data?: any;
}

const applyContainerStyle = (style: any = {}) => ({
  width: style.width,
  height: style.height,
  padding: style.padding || '8px',
  border: `${style.borderWidth || '0px'} ${style.borderStyle || 'solid'} ${style.borderColor || 'transparent'}`,
  borderRadius: style.borderRadius || '0px',
});

const applyLabelStyle = (style: any = {}) => ({
  fontSize: style.labelFontSize || '12px',
  color: style.labelColor || '#666666',
  backgroundColor: style.labelBackground || 'transparent',
  fontWeight: style.labelFontWeight || 'normal',
});

const applyValueStyle = (style: any = {}) => ({
  fontSize: style.valueFontSize || '16px',
  color: style.valueColor || '#000000',
  backgroundColor: style.valueBackground || 'transparent',
  fontWeight: style.valueFontWeight || '600',
});

export const TotalWidget: React.FC<WidgetProps> = ({ widget, data }) => {
  const value = data?.[widget.dataSource || ''] || 0;
  
  const formatValue = (val: number) => {
    switch (widget.format) {
      case 'currency':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
        }).format(val);
      case 'percentage':
        return `${val}%`;
      case 'number':
        return val.toLocaleString();
      default:
        return val;
    }
  };

  return (
    <div className="flex flex-col" style={applyContainerStyle(widget.style)}>
      <span style={applyLabelStyle(widget.style)}>{widget.label}</span>
      <span style={applyValueStyle(widget.style)}>{formatValue(value)}</span>
    </div>
  );
};

export const StatusWidget: React.FC<WidgetProps> = ({ widget, data }) => {
  const status = data?.[widget.dataSource || ''] || 'pending';
  
  const statusColors: Record<string, string> = {
    draft: 'bg-gray-200 text-gray-700',
    pending: 'bg-yellow-100 text-yellow-700',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
  };

  return (
    <div className="flex flex-col" style={applyContainerStyle(widget.style)}>
      <span style={applyLabelStyle(widget.style)}>{widget.label}</span>
      <span 
        className={`inline-block px-2 py-1 rounded text-xs font-medium ${statusColors[status] || statusColors.pending}`}
        style={applyValueStyle(widget.style)}
      >
        {status.toUpperCase()}
      </span>
    </div>
  );
};

export const CounterWidget: React.FC<WidgetProps> = ({ widget, data }) => {
  const count = data?.[widget.dataSource || ''] || 0;

  return (
    <div className="flex flex-col" style={applyContainerStyle(widget.style)}>
      <span style={applyLabelStyle(widget.style)}>{widget.label}</span>
      <span style={applyValueStyle(widget.style)}>{count}</span>
    </div>
  );
};

export const BadgeWidget: React.FC<WidgetProps> = ({ widget, data }) => {
  const value = data?.[widget.dataSource || ''] || '';

  return (
    <div className="flex items-center gap-2" style={applyContainerStyle(widget.style)}>
      <span style={applyLabelStyle(widget.style)}>{widget.label}:</span>
      <span 
        className="px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700"
        style={applyValueStyle(widget.style)}
      >
        {value}
      </span>
    </div>
  );
};

export const TextWidget: React.FC<WidgetProps> = ({ widget, data }) => {
  const value = data?.[widget.dataSource || ''] || '';

  return (
    <div className="flex flex-col" style={applyContainerStyle(widget.style)}>
      <span style={applyLabelStyle(widget.style)}>{widget.label}</span>
      <span style={applyValueStyle(widget.style)}>{value}</span>
    </div>
  );
};

// Widget Registry
export const WidgetRegistry: Record<string, React.FC<WidgetProps>> = {
  total: TotalWidget,
  status: StatusWidget,
  counter: CounterWidget,
  badge: BadgeWidget,
  text: TextWidget,
};
