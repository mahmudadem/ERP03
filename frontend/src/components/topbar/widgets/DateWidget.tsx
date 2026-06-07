import React from 'react';
import { Calendar } from 'lucide-react';
import { clsx } from 'clsx';
import { useTranslation } from 'react-i18next';

interface DateWidgetProps {
  showBorder?: boolean;
  showBackground?: boolean;
  dateFormat?: string;
  compact?: boolean;
}

const FORMAT_MAP: Record<string, Intl.DateTimeFormatOptions> = {
  "EEE, MMM d": { weekday: 'short', month: 'short', day: 'numeric' },
  "MMM d, yyyy": { month: 'short', day: 'numeric', year: 'numeric' },
  "dd/MM/yyyy": { day: '2-digit', month: '2-digit', year: 'numeric' },
  "MM/dd/yyyy": { month: '2-digit', day: '2-digit', year: 'numeric' },
  "yyyy-MM-dd": { year: 'numeric', month: '2-digit', day: '2-digit' },
  "EEEE, MMMM d, yyyy": { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' },
  "d MMM yyyy": { day: 'numeric', month: 'short', year: 'numeric' },
};

export const DateWidget: React.FC<DateWidgetProps> = ({
  showBorder = true,
  showBackground = true,
  dateFormat = "EEE, MMM d",
  compact = false
}) => {
  const { i18n } = useTranslation('common');
  const date = new Date();

  const options = FORMAT_MAP[dateFormat] ?? FORMAT_MAP["EEE, MMM d"];

  return (
    <div className={clsx(
      "flex justify-center items-center gap-1.5 rounded-lg text-xs font-bold text-slate-700 uppercase tracking-widest h-full w-full overflow-hidden transition-all",
      !compact && "px-3",
      showBackground && "bg-slate-100 shadow-sm",
      showBorder && "border border-slate-200"
    )}>
      {!compact && <Calendar className="w-3.5 h-3.5 text-blue-500 shrink-0" />}
      {date.toLocaleDateString(i18n.language, options)}
    </div>
  );
};
