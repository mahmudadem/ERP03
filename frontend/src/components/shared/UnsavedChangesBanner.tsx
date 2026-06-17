import React from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, RotateCcw, Save } from 'lucide-react';
import { Spinner } from '../ui/Spinner';

interface UnsavedChangesBannerProps {
  hasChanges: boolean;
  onSave: () => void;
  onDiscard?: () => void;
  saving?: boolean;
}

export const UnsavedChangesBanner: React.FC<UnsavedChangesBannerProps> = ({
  hasChanges,
  onSave,
  onDiscard,
  saving = false
}) => {
  const { t } = useTranslation('common');

  if (!hasChanges) return null;

  return (
    <div className="fixed inset-x-0 bottom-4 z-[100] mx-auto w-full max-w-2xl px-4 transition-all duration-300 sm:bottom-6 sm:px-6">
      <div className="flex flex-col gap-4 rounded-xl border border-slate-800/80 bg-slate-900 p-4 text-white shadow-2xl dark:bg-slate-950 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-500/20 text-amber-400 rounded-lg shrink-0">
            <AlertTriangle size={18} />
          </div>
          <div className="text-left">
            <div className="text-xs font-bold text-slate-100">
              {t('settings.layout.unsavedTitle', { defaultValue: 'Unsaved Settings Changes' })}
            </div>
            <div className="text-[10px] text-slate-400">
              {t('settings.layout.unsavedDescription', { defaultValue: 'You have unsaved changes in this module.' })}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 shrink-0">
          {onDiscard && (
            <button
              type="button"
              onClick={onDiscard}
              className="flex items-center gap-1.5 px-4 py-2 border border-slate-800 hover:bg-slate-800 text-xs font-bold rounded-lg transition-all active:scale-95 text-slate-200"
            >
              <RotateCcw size={14} />
              {t('settings.layout.discard', { defaultValue: 'Discard' })}
            </button>
          )}
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-xs font-bold rounded-lg shadow-lg transition-all active:scale-95 text-white"
          >
            {saving ? (
              <Spinner size="xs" variant="white" />
            ) : (
              <Save size={14} />
            )}
            {t('settings.layout.saveChanges', { defaultValue: 'Save Changes' })}
          </button>
        </div>
      </div>
    </div>
  );
};
