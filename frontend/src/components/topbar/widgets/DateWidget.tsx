import React from 'react';
import { Calendar } from 'lucide-react';
import { clsx } from 'clsx';

interface DateWidgetProps {
  showBorder?: boolean;
  showBackground?: boolean;
}

export const DateWidget: React.FC<DateWidgetProps> = ({ 
  showBorder = true, 
  showBackground = true 
}) => {
  const date = new Date();
  
  return (
    <div className={clsx(
      "flex justify-center items-center gap-1.5 px-3 rounded-lg text-xs font-bold text-slate-700 uppercase tracking-widest h-full w-full overflow-hidden transition-all",
      showBackground && "bg-slate-100 shadow-sm",
      showBorder && "border border-slate-200"
    )}>
      <Calendar className="w-3.5 h-3.5 text-blue-500 shrink-0" />
      {date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
    </div>
  );
};
