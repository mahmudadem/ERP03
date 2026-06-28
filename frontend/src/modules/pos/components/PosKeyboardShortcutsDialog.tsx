import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '../../../components/ui/Modal';
import { Keyboard, X, Save, RotateCcw } from 'lucide-react';
import { PosShortcutAction, DEFAULT_POS_SHORTCUTS } from '../hooks/usePosKeyboardShortcuts';

interface PosKeyboardShortcutsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  initialShortcuts: Record<string, string>;
  onSave: (shortcuts: Record<string, string>) => void;
  title?: string;
  subtitle?: string;
}

export const PosKeyboardShortcutsDialog: React.FC<PosKeyboardShortcutsDialogProps> = ({
  isOpen,
  onClose,
  initialShortcuts,
  onSave,
  title,
  subtitle
}) => {
  const { t } = useTranslation('pos');
  const [shortcuts, setShortcuts] = useState<Record<string, string>>({});
  const [capturingAction, setCapturingAction] = useState<PosShortcutAction | null>(null);

  useEffect(() => {
    if (isOpen) {
      setShortcuts({ ...initialShortcuts });
      setCapturingAction(null);
    }
  }, [isOpen, initialShortcuts]);

  useEffect(() => {
    if (!capturingAction) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === 'Escape') {
        setCapturingAction(null);
        return;
      }

      // Ignore modifier keys alone
      if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) {
        return;
      }

      let keyLabel = e.key;
      // Handle special keys mapping if necessary (e.g. " " -> "Space")
      if (e.key === ' ') keyLabel = 'Space';

      // We could capture combinations here (e.g. e.ctrlKey ? 'Ctrl+' : '')
      // For POS, single keys or function keys are preferred.
      
      setShortcuts(prev => ({ ...prev, [capturingAction]: keyLabel }));
      setCapturingAction(null);
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [capturingAction]);

  const handleSave = () => {
    onSave(shortcuts);
    onClose();
  };

  const handleReset = () => {
    setShortcuts({});
  };

  const actionLabels: Record<PosShortcutAction, string> = {
    SEARCH_ITEMS: t('shortcuts.actions.searchItems', { defaultValue: 'Search Items' }),
    CHECKOUT: t('shortcuts.actions.checkout', { defaultValue: 'Checkout / Pay' }),
    VOID_SALE: t('shortcuts.actions.voidSale', { defaultValue: 'Void Sale' }),
    HOLD_CART: t('shortcuts.actions.holdCart', { defaultValue: 'Hold Cart' }),
    ADD_CUSTOM_ITEM: t('shortcuts.actions.addCustomItem', { defaultValue: 'Add Custom Item' }),
    APPLY_DISCOUNT: t('shortcuts.actions.applyDiscount', { defaultValue: 'Apply Global Discount' }),
    CASH_PAYMENT: t('shortcuts.actions.cashPayment', { defaultValue: 'Quick Cash Payment' }),
    CARD_PAYMENT: t('shortcuts.actions.cardPayment', { defaultValue: 'Quick Card Payment' }),
  };

  const actions = Object.keys(DEFAULT_POS_SHORTCUTS) as PosShortcutAction[];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title || t('shortcuts.title', { defaultValue: 'Keyboard Shortcuts' })}>
      <div className="p-4 space-y-4">
        {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
        
        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {actions.map((action) => {
            const currentKey = shortcuts[action] || DEFAULT_POS_SHORTCUTS[action];
            const isCapturing = capturingAction === action;

            return (
              <div key={action} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="flex flex-col">
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {actionLabels[action]}
                  </span>
                  <span className="text-xs text-gray-500">
                    Default: <kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">{DEFAULT_POS_SHORTCUTS[action]}</kbd>
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setCapturingAction(isCapturing ? null : action)}
                    className={`min-w-[80px] px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      isCapturing 
                        ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-500 dark:bg-blue-900/30 dark:text-blue-400' 
                        : 'bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
                    {isCapturing ? t('shortcuts.listening', { defaultValue: 'Press key...' }) : currentKey}
                  </button>
                  {shortcuts[action] && (
                    <button
                      type="button"
                      onClick={() => {
                        const newShortcuts = { ...shortcuts };
                        delete newShortcuts[action];
                        setShortcuts(newShortcuts);
                      }}
                      className="p-1.5 text-gray-400 hover:text-red-500 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20"
                      title={t('shortcuts.resetAction', { defaultValue: 'Reset to default' })}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex justify-between rounded-b-xl">
        <button
          type="button"
          onClick={handleReset}
          className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          {t('shortcuts.resetAll', { defaultValue: 'Reset All' })}
        </button>
        <div className="flex space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            {t('common.cancel', { defaultValue: 'Cancel' })}
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {t('common.save', { defaultValue: 'Save' })}
          </button>
        </div>
      </div>
    </Modal>
  );
};
