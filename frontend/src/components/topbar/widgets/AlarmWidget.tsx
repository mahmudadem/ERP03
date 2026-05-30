import React from 'react';
import { BellRing } from 'lucide-react';
import { clsx } from 'clsx';
import { useTranslation } from 'react-i18next';

import toast from 'react-hot-toast';

interface AlarmWidgetProps {
  showBorder?: boolean;
  showBackground?: boolean;
  compact?: boolean;
}

export const AlarmWidget: React.FC<AlarmWidgetProps> = ({ 
  showBorder = true, 
  showBackground = true,
  compact = false
}) => {
  const { t } = useTranslation('common');

  return (
    <button 
      className={clsx(
        "flex justify-center items-center gap-1.5 rounded-lg text-xs font-bold text-rose-700 transition-all h-full w-full overflow-hidden",
        !compact && "px-3",
        showBackground && "bg-rose-50 hover:bg-rose-100 shadow-sm",
        showBorder && "border border-rose-200"
      )}
      onClick={() => toast(t('widgets.alarm.clickMessage', 'Alarm widget clicked. Add an alarm.'), { icon: 'ℹ️' })}
    >
      {!compact && <BellRing className="w-3.5 h-3.5 shrink-0" />}
      {t('widgets.alarm.label', 'Alarm')}
    </button>
  );
};

