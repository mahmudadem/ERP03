import React from 'react';

interface ToggleSwitchProps {
  label?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  activeColor?: string;
  inactiveColor?: string;
  className?: string;
}

export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  label,
  checked,
  onChange,
  disabled = false,
  activeColor = 'bg-indigo-600',
  inactiveColor = 'bg-gray-200',
  className = '',
}) => {
  return (
    <label className={`flex items-center cursor-pointer select-none gap-3 ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}>
      <div className="relative shrink-0" dir="ltr">
        <input
          type="checkbox"
          className="sr-only"
          checked={checked}
          onChange={(e) => !disabled && onChange(e.target.checked)}
          disabled={disabled}
        />
        <div className={`w-12 h-6 rounded-full transition-colors ${checked ? activeColor : inactiveColor}`}></div>
        <div className={`absolute top-[2px] left-[2px] bg-white w-5 h-5 rounded-full shadow-md transition-transform ${checked ? 'translate-x-6' : 'translate-x-0'}`}></div>
      </div>
      {label && (
        <span className="text-sm font-medium text-gray-700 dark:text-[var(--color-text-secondary)]">
          {label}
        </span>
      )}
    </label>
  );
};
