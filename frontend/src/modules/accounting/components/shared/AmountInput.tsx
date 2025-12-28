import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';

interface AmountInputProps {
  value: number;
  onChange: (value: number) => void;
  className?: string;
  placeholder?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

export const AmountInput = forwardRef<HTMLInputElement, AmountInputProps>(({
  value,
  onChange,
  className = '',
  placeholder = '0.00',
  onKeyDown: externalKeyDown
}, ref) => {
  const [displayValue, setDisplayValue] = useState<string>('');
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Forward the ref
  useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);

  // Update display value when external value changes (but not when focused)
  useEffect(() => {
    if (!isFocused) {
      setDisplayValue(value === 0 ? '' : value.toString());
    }
  }, [value, isFocused]);

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    // Select all text on focus
    e.target.select();
    // If value is 0, clear it
    if (value === 0) {
      setDisplayValue('');
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    // Parse the value and update (ensure non-negative)
    const numValue = Math.max(0, parseFloat(displayValue) || 0);
    onChange(numValue);
    // Update display to show formatted value or empty if 0
    setDisplayValue(numValue === 0 ? '' : numValue.toString());
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    // Allow empty, positive numbers, and decimal point (no negative sign)
    if (newValue === '' || /^\d*\.?\d*$/.test(newValue)) {
      setDisplayValue(newValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Handle arrow navigation if external handler is provided
    if (externalKeyDown && (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      externalKeyDown(e);
      if (e.defaultPrevented) return;
    }
    
    // Prevent arrow up/down from changing value (if not already handled)
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
    }
    
    // Submit on Enter - pass to external handler first
    if (e.key === 'Enter') {
      if (externalKeyDown) {
        externalKeyDown(e);
        if (e.defaultPrevented) return;
      }
      inputRef.current?.blur();
    }
    
    // Pass other key events to external handler
    if (externalKeyDown && e.key !== 'ArrowUp' && e.key !== 'ArrowDown' && e.key !== 'Enter') {
      externalKeyDown(e);
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLInputElement>) => {
    // Prevent mouse wheel from changing value
    e.currentTarget.blur();
  };

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      value={displayValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      onWheel={handleWheel}
      placeholder={placeholder}
      className={`w-full h-full px-2 py-1.5 text-right font-mono border-none outline-none bg-transparent 
        focus:bg-primary-50/30 dark:focus:bg-primary-900/20 focus:ring-1 focus:ring-inset focus:ring-primary-500 transition-all
        text-base text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] ${className}`}
      style={{
        // Hide number input arrows
        WebkitAppearance: 'none',
        MozAppearance: 'textfield'
      }}
    />
  );
});

AmountInput.displayName = 'AmountInput';
