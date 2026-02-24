import React, { useState, useEffect, useRef } from 'react';
import { useCompanySettings } from '../../../../hooks/useCompanySettings';
import { formatCompanyDate, parseCompanyDate } from '../../../../utils/dateUtils';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';

interface Props {
  value: string; // ISO format (YYYY-MM-DD)
  onChange: (val: string) => void;
  className?: string;
  disabled?: boolean;
}

/**
 * DatePicker Component
 * Provides a localized text input for dates that respects company settings.
 * Includes a custom popover calendar for selecting dates format agnostically.
 */
export const DatePicker: React.FC<Props> = ({ value, onChange, className = '', disabled = false }) => {
  const { settings } = useCompanySettings();
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Display value formatting
  const getDisplayValue = (iso: string) => formatCompanyDate(iso, settings);
  const [inputValue, setInputValue] = useState(getDisplayValue(value));
  const [isOpen, setIsOpen] = useState(false);
  
  // Calendar state
  const [viewDate, setViewDate] = useState(() => {
    const d = new Date(value || new Date());
    if (isNaN(d.getTime())) return new Date();
    // Use local time for picker view
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  });

  // Sync with value if it changes from outside
  useEffect(() => {
    setInputValue(getDisplayValue(value));
  }, [value, settings]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleBlur = () => {
    const parsed = parseCompanyDate(inputValue, settings);
    if (parsed) {
      onChange(parsed);
      setInputValue(getDisplayValue(parsed));
      
      const parts = parsed.split('-');
      if (parts.length === 3) {
        setViewDate(new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])));
      }
    } else {
      // Revert to original if invalid
      setInputValue(getDisplayValue(value));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
        handleBlur();
        setIsOpen(false);
    }
    if (e.key === 'Escape') setIsOpen(false);
  };

  const handleIconClick = () => {
    if (disabled) return;
    setIsOpen(!isOpen);
    if (!isOpen && value) {
       const parts = value.split('-');
       if (parts.length === 3) {
         setViewDate(new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])));
       }
    }
  };

  const selectDate = (year: number, month: number, day: number) => {
    const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    onChange(iso);
    setIsOpen(false);
  };

  const changeMonth = (diff: number) => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + diff, 1));
  };

  // Calendar rendering logic
  const renderCalendar = () => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    
    const days = [];
    const weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

    // Prev month days
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
      days.push({ day: daysInPrevMonth - i, month: month - 1, current: false });
    }
    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ day: i, month: month, current: true });
    }
    // Next month days
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({ day: i, month: month + 1, current: false });
    }

    // Selected Date
    let selY = -1, selM = -1, selD = -1;
    if (value) {
      const parts = value.split('-');
      if (parts.length === 3) {
        selY = Number(parts[0]);
        selM = Number(parts[1]) - 1;
        selD = Number(parts[2]);
      }
    }
    
    // Today
    const todayObj = new Date();
    const todayY = todayObj.getFullYear(), todayM = todayObj.getMonth(), todayD = todayObj.getDate();

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    return (
      <div className="absolute z-50 top-full right-0 mt-1 bg-white dark:bg-[var(--color-bg-primary)] border border-slate-200 dark:border-[var(--color-border)] rounded-xl shadow-lg p-3 w-64 select-none animate-in fade-in slide-in-from-top-2 duration-200">
        <div className="flex justify-between items-center mb-4 px-1">
          <button type="button" onClick={() => changeMonth(-1)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors text-slate-500">
            <ChevronLeft size={16} />
          </button>
          <div className="font-semibold text-sm text-slate-800 dark:text-slate-100">
            {monthNames[month]} {year}
          </div>
          <button type="button" onClick={() => changeMonth(1)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors text-slate-500">
            <ChevronRight size={16} />
          </button>
        </div>
        
        <div className="grid grid-cols-7 gap-1 text-center mb-2">
          {weekDays.map(wd => (
            <div key={wd} className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{wd}</div>
          ))}
        </div>
        
        <div className="grid grid-cols-7 gap-1 w-full text-center">
          {days.map((dObj, idx) => {
            let itemY = year;
            let itemM = dObj.month;
            if (itemM < 0) { itemM = 11; itemY--; }
            else if (itemM > 11) { itemM = 0; itemY++; }
            
            const isSelected = itemY === selY && itemM === selM && dObj.day === selD;
            const isToday = itemY === todayY && itemM === todayM && dObj.day === todayD;
            
            return (
              <button
                key={idx}
                type="button"
                onClick={() => selectDate(itemY, itemM, dObj.day)}
                className={`flex items-center justify-center h-8 w-full text-xs rounded-full transition-all ${
                  isSelected 
                    ? 'bg-primary-600 text-white font-bold shadow-md shadow-primary-500/30'
                    : isToday
                      ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300 font-bold hover:bg-primary-100'
                      : dObj.current 
                        ? 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                        : 'text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                {dObj.day}
              </button>
            );
          })}
        </div>
        
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-center">
            <button 
              type="button" 
              onClick={() => selectDate(todayY, todayM, todayD)} 
              className="text-xs font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400 hover:underline"
            >
              Today
            </button>
        </div>
      </div>
    );
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        onClick={() => !disabled && !isOpen && setIsOpen(true)}
        placeholder={settings?.dateFormat || 'YYYY-MM-DD'}
        className={`w-full h-[36px] px-3 pr-8 border border-[var(--color-border)] rounded text-sm focus:ring-1 focus:ring-primary-500 outline-none shadow-sm transition-colors duration-200 text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] ${
          disabled ? 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] cursor-not-allowed' : 'bg-[var(--color-bg-primary)]'
        }`}
      />
      <button
        type="button"
        onClick={handleIconClick}
        disabled={disabled}
        className={`absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-primary-600 dark:hover:text-primary-400 transition-colors ${disabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <CalendarIcon size={14} />
      </button>
      
      {isOpen && !disabled && renderCalendar()}
    </div>
  );
};
