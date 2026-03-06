import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { clsx } from 'clsx';
import { useTranslation } from 'react-i18next';

interface ClockWidgetProps {
  showBorder?: boolean;
  showBackground?: boolean;
}

export const ClockWidget: React.FC<ClockWidgetProps> = ({ 
  showBorder = true, 
  showBackground = true 
}) => {
  const { i18n } = useTranslation('common');
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className={clsx(
      "flex justify-center items-center gap-1.5 px-3 rounded-lg text-xs font-bold text-slate-700 h-full w-full overflow-hidden transition-all",
      showBackground && "bg-slate-100 shadow-sm",
      showBorder && "border border-slate-200"
    )}>
      <Clock className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
      {time.toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
    </div>
  );
};
