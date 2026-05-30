import React from 'react';
import { StickyNote } from 'lucide-react';
import { clsx } from 'clsx';
import { useTranslation } from 'react-i18next';

import toast from 'react-hot-toast';

interface NotesWidgetProps {
  showBorder?: boolean;
  showBackground?: boolean;
  compact?: boolean;
}

export const NotesWidget: React.FC<NotesWidgetProps> = ({ 
  showBorder = true, 
  showBackground = true,
  compact = false
}) => {
  const { t } = useTranslation('common');

  return (
    <button 
      className={clsx(
        "flex justify-center items-center gap-1.5 rounded-lg text-xs font-bold text-amber-700 transition-all h-full w-full overflow-hidden",
        !compact && "px-3",
        showBackground && "bg-amber-50 hover:bg-amber-100 shadow-sm",
        showBorder && "border border-amber-200"
      )}
      onClick={() => toast(t('widgets.notes.clickMessage', 'Notes widget clicked. Not fully implemented yet.'), { icon: 'ℹ️' })}
    >
      {!compact && <StickyNote className="w-3.5 h-3.5 shrink-0" />}
      {t('widgets.notes.label', 'Notes')}
    </button>
  );
};
