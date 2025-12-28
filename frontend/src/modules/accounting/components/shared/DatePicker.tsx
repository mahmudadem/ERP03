import React, { useState, useEffect } from 'react';
import { useCompanySettings } from '../../../../hooks/useCompanySettings';
import { formatCompanyDate, parseCompanyDate } from '../../../../utils/dateUtils';
import { Calendar } from 'lucide-react';

interface Props {
  value: string; // ISO format (YYYY-MM-DD)
  onChange: (val: string) => void;
  className?: string;
  disabled?: boolean;
}

/**
 * DatePicker Component
 * Provides a localized text input for dates that respects company settings.
 * Includes a calendar icon to trigger a native date picker.
 */
export const DatePicker: React.FC<Props> = ({ value, onChange, className = '', disabled = false }) => {
  const { settings } = useCompanySettings();
  const dateInputRef = React.useRef<HTMLInputElement>(null);
  
  // Initial display value based on ISO string
  const getDisplayValue = (iso: string) => formatCompanyDate(iso, settings);
  
  const [inputValue, setInputValue] = useState(getDisplayValue(value));

  // Sync with value if it changes from outside
  useEffect(() => {
    setInputValue(getDisplayValue(value));
  }, [value, settings]);

  const handleBlur = () => {
    const parsed = parseCompanyDate(inputValue, settings);
    if (parsed) {
      onChange(parsed);
      // This will also "translate" delimiters (e.g., 30-10 to 30/10)
      setInputValue(getDisplayValue(parsed));
    } else {
      // Revert to original if invalid
      setInputValue(getDisplayValue(value));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleBlur();
    }
  };

  const handleIconClick = () => {
    if (disabled) return;
    // Trigger native date picker
    try {
      if (dateInputRef.current?.showPicker) {
        dateInputRef.current.showPicker();
      } else {
        dateInputRef.current?.click();
      }
    } catch (e) {
      dateInputRef.current?.click();
    }
  };

  return (
    <div className={`relative ${className}`}>
      {/* Hidden native input for calendar functionality */}
      <input 
        type="date"
        ref={dateInputRef}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 w-full h-full opacity-0 pointer-events-none"
        tabIndex={-1}
      />
      
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={settings?.dateFormat || 'YYYY-MM-DD'}
        className={`w-full p-1.5 border border-[var(--color-border)] rounded text-xs focus:ring-1 focus:ring-primary-500 outline-none shadow-sm transition-colors duration-200 text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] ${
          disabled ? 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] cursor-not-allowed' : 'bg-[var(--color-bg-primary)]'
        }`}
      />
      <button
        type="button"
        onClick={handleIconClick}
        disabled={disabled}
        className={`absolute right-2 top-2 text-[var(--color-text-muted)] hover:text-primary-600 dark:hover:text-primary-400 transition-colors ${disabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <Calendar size={14} />
      </button>
    </div>
  );
};
