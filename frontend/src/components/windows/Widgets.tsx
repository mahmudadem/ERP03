import React from 'react';
import { WindowWidget } from '../../types/WindowConfig';

interface WidgetProps {
  widget: WindowWidget;
  data?: any;
}

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
    <div className="flex flex-col">
      <span className="text-xs text-gray-500">{widget.label}</span>
      <span className={`text-lg font-semibold ${widget.color || 'text-gray-900'}`}>
        {formatValue(value)}
      </span>
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
    <div className="flex flex-col">
      <span className="text-xs text-gray-500">{widget.label}</span>
      <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${statusColors[status] || statusColors.pending}`}>
        {status.toUpperCase()}
      </span>
    </div>
  );
};

export const CounterWidget: React.FC<WidgetProps> = ({ widget, data }) => {
  const count = data?.[widget.dataSource || ''] || 0;

  return (
    <div className="flex flex-col">
      <span className="text-xs text-gray-500">{widget.label}</span>
      <span className="text-lg font-semibold text-gray-900">
        {count}
      </span>
    </div>
  );
};

export const BadgeWidget: React.FC<WidgetProps> = ({ widget, data }) => {
  const value = data?.[widget.dataSource || ''] || '';

  return (
    <div className="flex items-center gap-2">
      <span className={`px-3 py-1 rounded-full text-xs font-medium ${widget.color || 'bg-blue-100 text-blue-700'}`}>
        {value}
      </span>
    </div>
  );
};

export const TextWidget: React.FC<WidgetProps> = ({ widget, data }) => {
  const value = data?.[widget.dataSource || ''] || '';

  return (
    <div className="flex flex-col">
      <span className="text-xs text-gray-500">{widget.label}</span>
      <span className="text-sm text-gray-900">{value}</span>
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
