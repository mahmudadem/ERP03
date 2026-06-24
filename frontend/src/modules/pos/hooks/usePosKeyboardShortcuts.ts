import { useEffect, useMemo } from 'react';
import { PosRegisterDTO } from '../../../api/posApi';
import { UserPreferencesDTO } from '../../../api/userPreferencesApi';

export type PosShortcutAction =
  | 'SEARCH_ITEMS'
  | 'CHECKOUT'
  | 'VOID_SALE'
  | 'HOLD_CART'
  | 'ADD_CUSTOM_ITEM'
  | 'APPLY_DISCOUNT'
  | 'CASH_PAYMENT'
  | 'CARD_PAYMENT';

export const DEFAULT_POS_SHORTCUTS: Record<PosShortcutAction, string> = {
  SEARCH_ITEMS: 'F3',
  CHECKOUT: 'F12',
  VOID_SALE: 'Escape',
  HOLD_CART: 'F4',
  ADD_CUSTOM_ITEM: '+',
  APPLY_DISCOUNT: 'F8',
  CASH_PAYMENT: '1',
  CARD_PAYMENT: '2',
};

export interface UsePosKeyboardShortcutsProps {
  register: PosRegisterDTO | null;
  userPreferences: UserPreferencesDTO | null;
  onAction: (action: PosShortcutAction) => void;
  disabled?: boolean;
}

export function usePosKeyboardShortcuts({
  register,
  userPreferences,
  onAction,
  disabled = false,
}: UsePosKeyboardShortcutsProps) {
  const activeShortcuts = useMemo(() => {
    // Merge order: Defaults < Register < User Preferences
    const merged: Record<string, string> = { ...DEFAULT_POS_SHORTCUTS };

    if (register?.keyboardShortcuts) {
      Object.entries(register.keyboardShortcuts).forEach(([action, key]) => {
        if (key) merged[action] = key;
      });
    }

    if (userPreferences?.posShortcuts) {
      Object.entries(userPreferences.posShortcuts).forEach(([action, key]) => {
        if (key) merged[action] = key;
      });
    }

    // Invert mapping for quick lookup: { "F12": "CHECKOUT" }
    const keyToAction: Record<string, PosShortcutAction> = {};
    Object.entries(merged).forEach(([action, key]) => {
      keyToAction[key.toLowerCase()] = action as PosShortcutAction;
    });

    return keyToAction;
  }, [register?.keyboardShortcuts, userPreferences?.posShortcuts]);

  useEffect(() => {
    if (disabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in an input field
      // Exception: Function keys and Escape are usually fine to capture globally
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
      const isSelect = target.tagName === 'SELECT';
      
      const key = e.key.toLowerCase();
      
      // If user is typing in a text field, ignore single character shortcuts like '1' or '+'
      if ((isInput || isSelect) && key.length === 1) {
        return;
      }

      const action = activeShortcuts[key];
      if (action) {
        e.preventDefault();
        e.stopPropagation();
        onAction(action);
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [activeShortcuts, onAction, disabled]);

  return {
    activeShortcuts,
    defaultShortcuts: DEFAULT_POS_SHORTCUTS,
  };
}
