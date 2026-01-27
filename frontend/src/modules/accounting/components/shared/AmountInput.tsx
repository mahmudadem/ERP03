import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';

interface AmountInputProps {
  value: number;
  onChange: (value: number) => void;
  onBlur?: () => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

export const AmountInput = forwardRef<HTMLInputElement, AmountInputProps>(({
  value,
  onChange,
  onBlur,
  disabled = false,
  className = '',
  placeholder = '',
  onKeyDown: externalKeyDown
}, ref) => {
  const [displayValue, setDisplayValue] = useState<string>('');
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Forward the ref
  useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);

  // Update display value when external value changes
  useEffect(() => {
    if (!isFocused) {
      setDisplayValue(value === 0 ? '' : value.toString());
    } else {
      // If focused, only update if the external value is numerically different 
      // from what we interpret the current input as.
      // This handles cases like Alt+B auto-balance updates while ignoring
      // formatting differences during typing (e.g. "10." vs 10).
      const currentParsed = parseFloat(displayValue) || 0;
      // Use epsilon for float comparison to avoid jitter
      if (Math.abs(currentParsed - value) > 0.0001) {
          setDisplayValue(value === 0 ? '' : value.toString());
      }
    }
  }, [value, isFocused]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    // Select all text on focus
    e.target.select();
    // If value is 0, clear it
    if (value === 0) {
      setDisplayValue('');
    }
  };

  const evaluateMathExpression = (expression: string): number | null => {
    if (!expression) return null;
    const normalized = expression.replace(/,/g, '.');
    // Allow digits, dots, operators, parens, spaces
    if (!/^[\d\.\+\-\*\/\(\)\s]+$/.test(normalized)) return null;
    try {
      // eslint-disable-next-line
      const result = new Function(`return (${normalized})`)();
      if (typeof result === 'number' && !isNaN(result) && isFinite(result)) return result;
    } catch (err) { /* ignore */ }
    return null;
  };

  const handleBlur = () => {
    setIsFocused(false);
    
    let finalValue = parseFloat(displayValue);
    
    // Check for math expression
    if (/[\+\-\*\/]/.test(displayValue)) {
       const res = evaluateMathExpression(displayValue);
       if (res !== null) finalValue = res;
    }
    
    // Default to 0 if invalid
    if (isNaN(finalValue)) finalValue = 0;
    
    // Round to 6 decimals for higher precision in FX calculations
    finalValue = Math.round(finalValue * 1000000) / 1000000;

    onChange(finalValue);
    // Update display to show original input or formatted value, but don't force 2 decimals anymore
    setDisplayValue(finalValue === 0 ? '' : finalValue.toString());
    
    // Trigger external blur
    if (onBlur) {
      onBlur();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    // Allow typical math characters
    if (newValue === '' || /^[\d\.\+\-\*\/\(\)\s]*$/.test(newValue)) {
      setDisplayValue(newValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // 1. Auto-Balance Shortcut (Alt+B)
    if ((e.altKey && e.key.toLowerCase() === 'b') || (e.key === 'c' && e.ctrlKey)) { 
       // Keeping Ctrl+C logic from parent if passed? 
       // Actually GenericVoucherRenderer handles the logic by looking at the event?
       // No, GenericVoucherRenderer passes `handleCellKeyDown`. I need to let it bubble or call it?
       // `onKeyDown: externalKeyDown` is passed.
       // The original logic called externalKeyDown.
    }

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
    
    // Pass other key events to external handler (CRITICAL for Alt+B handled by parent)
    if (externalKeyDown && e.key !== 'ArrowUp' && e.key !== 'ArrowDown' && e.key !== 'Enter') {
      externalKeyDown(e);
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLInputElement>) => {
    // Prevent mouse wheel from changing value
    e.currentTarget.blur();
  };

  // Determine if we are "calculating" (showing formula vs number)
  const isCalculating = isFocused && /[\+\-\*\/]/.test(displayValue);

  return (
    <div className="relative w-full h-full">
      <input
        ref={inputRef}
        type="text"
        inputMode="text"
        autoComplete="off"
        spellCheck="false"
        value={displayValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        onWheel={handleWheel}
        disabled={disabled}
        placeholder={placeholder}
        className={`w-full h-full px-2 py-1.5 text-right font-mono border-none outline-none bg-transparent 
          focus:bg-primary-50/30 dark:focus:bg-primary-900/20 focus:ring-1 focus:ring-inset focus:ring-primary-500 transition-all
          text-base text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] ${disabled ? 'opacity-70 cursor-not-allowed' : ''} ${className}`}
        style={{
          WebkitAppearance: 'none',
          MozAppearance: 'textfield'
        }}
      />
      {isCalculating && (
         <div className="absolute right-0 -top-5 bg-primary-600 text-white text-[10px] px-1.5 py-0.5 rounded shadow-lg pointer-events-none opacity-90 font-bold z-10">
           {evaluateMathExpression(displayValue)?.toLocaleString() ?? '...'}
         </div>
      )}
    </div>
  );
});

AmountInput.displayName = 'AmountInput';
