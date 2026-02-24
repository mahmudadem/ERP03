/**
 * Cost Center Selector Component
 * 
 * Mimics AccountSelector behavior:
 * - Type cost center code/name directly
 * - Exact match: auto-selects on blur/Enter
 * - No exact match: opens search modal with closest matches
 */

import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useTranslation } from 'react-i18next';
import { useCostCenters } from '../../../../context/CostCentersContext';
import { CostCenterDTO } from '../../../../api/accountingApi';
import { Search, X } from 'lucide-react';

interface CostCenterSelectorProps {
  value?: string;  // Cost center code or ID
  onChange: (cc: CostCenterDTO | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  noBorder?: boolean;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  onBlur?: () => void;
}

export const CostCenterSelector = forwardRef<HTMLInputElement, CostCenterSelectorProps>(({
  value,
  onChange,
  placeholder = 'Cost center...',
  disabled = false,
  className = '',
  noBorder = false,
  onKeyDown: externalKeyDown,
  onBlur: externalBlur
}, ref) => {
  const { t } = useTranslation('accounting');
  const { costCenters, loading } = useCostCenters();
  const [inputValue, setInputValue] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [modalSearch, setModalSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const modalInputRef = useRef<HTMLInputElement>(null);

  // Forward the ref
  useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);

  // Only show active cost centers
  const activeCenters = costCenters.filter(cc => cc.status === 'ACTIVE' || (cc as any).active === true || (cc as any).status === undefined);

  // Helper to find a cost center by code or ID
  const getCCByCode = (code: string): CostCenterDTO | undefined => {
    if (!code || typeof code !== 'string') return undefined;
    const lowerCode = code.toLowerCase();
    return activeCenters.find(cc => cc && typeof cc.code === 'string' && cc.code.toLowerCase() === lowerCode);
  };

  const getCCById = (id: string): CostCenterDTO | undefined => {
    if (!id) return undefined;
    return activeCenters.find(cc => cc.id === id);
  };

  // Sync input value with external value
  useEffect(() => {
    if (value) {
      const cc = getCCByCode(value) || getCCById(value);
      setInputValue(cc ? `${cc.code} — ${cc.name}` : value);
    } else {
      setInputValue('');
    }
  }, [value, costCenters]);

  // Focus modal input when modal opens
  useEffect(() => {
    if (showModal && modalInputRef.current) {
      modalInputRef.current.focus();
      modalInputRef.current.select();
    }
  }, [showModal]);

  // Find exact match by code or name
  const findExactMatch = (searchText: string): CostCenterDTO | null => {
    if (!searchText || typeof searchText !== 'string') return null;
    const search = searchText.trim().toLowerCase();
    if (!search) return null;

    // Try exact code match first
    const codeMatch = activeCenters.find(cc => cc && typeof cc.code === 'string' && cc.code.toLowerCase() === search);
    if (codeMatch) return codeMatch;

    // Try exact name match
    const nameMatch = activeCenters.find(cc => cc && typeof cc.name === 'string' && cc.name.toLowerCase() === search);
    if (nameMatch) return nameMatch;

    return null;
  };

  // Find closest matches for modal
  const getFilteredCenters = (searchText: string): CostCenterDTO[] => {
    if (!searchText || typeof searchText !== 'string') return activeCenters.slice(0, 20);
    const search = searchText.trim().toLowerCase();
    if (!search) return activeCenters.slice(0, 20);

    return activeCenters
      .filter(cc =>
        (cc && typeof cc.code === 'string' && cc.code.toLowerCase().includes(search)) ||
        (cc && typeof cc.name === 'string' && cc.name.toLowerCase().includes(search))
      )
      .sort((a, b) => {
        const aCode = a && typeof a.code === 'string' ? a.code.toLowerCase() : '';
        const bCode = b && typeof b.code === 'string' ? b.code.toLowerCase() : '';

        if (aCode === search) return -1;
        if (bCode === search) return 1;
        if (aCode.startsWith(search) && !bCode.startsWith(search)) return -1;
        if (bCode.startsWith(search) && !aCode.startsWith(search)) return 1;

        return aCode.localeCompare(bCode);
      })
      .slice(0, 20);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleInputBlur = () => {
    // If empty, just clear
    if (!inputValue.trim()) {
      if (value) onChange(null);
      return;
    }

    // If input matches the current selected CC display text, do nothing
    if (value) {
      const currentCC = getCCByCode(value) || getCCById(value);
      if (currentCC && inputValue === `${currentCC.code} — ${currentCC.name}`) {
        return;
      }
    }

    // Try to find exact match
    const exactMatch = findExactMatch(inputValue);

    if (exactMatch) {
      if (exactMatch.code !== value && exactMatch.id !== value) {
        onChange(exactMatch);
      }
      setInputValue(`${exactMatch.code} — ${exactMatch.name}`);
    } else {
      // No exact match - open modal to resolve
      setHighlightedIndex(0);
      setModalSearch(inputValue.trim());
      setShowModal(true);
    }

    if (externalBlur) {
      externalBlur();
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Alt+Down to explicitly open modal
    if (e.altKey && e.key === 'ArrowDown') {
      e.preventDefault();
      setModalSearch(inputValue.trim());
      setHighlightedIndex(0);
      setShowModal(true);
      return;
    }

    // Enter key handling
    if (e.key === 'Enter') {
      if (inputValue.trim()) {
        const exactMatch = findExactMatch(inputValue);
        if (exactMatch) {
          onChange(exactMatch);
          setInputValue(`${exactMatch.code} — ${exactMatch.name}`);
          if (externalKeyDown) externalKeyDown(e);
        } else {
          e.preventDefault();
          setModalSearch(inputValue.trim());
          setHighlightedIndex(0);
          setShowModal(true);
        }
      } else {
        if (externalKeyDown) externalKeyDown(e);
      }
      return;
    }

    // Navigation keys - pass to grid
    const isNavKey = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key);
    if (isNavKey) {
      if (externalKeyDown) {
        externalKeyDown(e);
        return;
      }
    }
  };

  const handleModalKeyDown = (e: React.KeyboardEvent) => {
    const filtered = getFilteredCenters(modalSearch);

    switch (e.key) {
      case 'ArrowDown':
        setHighlightedIndex(prev => Math.min(prev + 1, filtered.length - 1));
        e.preventDefault();
        break;
      case 'ArrowUp':
        setHighlightedIndex(prev => Math.max(prev - 1, 0));
        e.preventDefault();
        break;
      case 'Enter':
        if (filtered[highlightedIndex]) {
          handleSelectCC(filtered[highlightedIndex]);
        }
        e.preventDefault();
        break;
      case 'Escape':
        setShowModal(false);
        inputRef.current?.focus();
        break;
    }
  };

  const handleSelectCC = (cc: CostCenterDTO) => {
    onChange(cc);
    setInputValue(`${cc.code} — ${cc.name}`);
    setShowModal(false);
    inputRef.current?.focus();
  };

  const handleClear = () => {
    onChange(null);
    setInputValue('');
    inputRef.current?.focus();
  };

  const filteredCenters = getFilteredCenters(modalSearch);

  return (
    <>
      {/* Input Field */}
      <div className={`relative flex items-center ${className}`}>
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          onKeyDown={handleInputKeyDown}
          placeholder={placeholder || t('costCenterSelector.placeholder', 'Cost center...')}
          disabled={disabled}
          className={`w-full text-xs transition-colors duration-200 ${noBorder ? 'p-1 border-none bg-transparent' : 'p-2 border border-[var(--color-border)] rounded bg-[var(--color-bg-primary)]'} 
            focus:ring-1 focus:ring-primary-500 focus:border-primary-500 outline-none text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]
            ${disabled ? 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] cursor-not-allowed' : ''}`}
        />
        {inputValue && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-1 p-0.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Search Modal */}
      {showModal && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-[1px] z-[9998]"
            onClick={() => setShowModal(false)}
          />

          {/* Modal */}
          <div className="fixed inset-0 flex items-center justify-center z-[9999] pointer-events-none p-4">
            <div className="bg-[var(--color-bg-primary)] rounded-lg shadow-2xl border border-[var(--color-border)] w-full max-w-md max-h-[450px] pointer-events-auto flex flex-col transition-colors duration-300">
              {/* Header */}
              <div className="p-4 border-b border-[var(--color-border)]">
                <div className="flex items-center gap-3">
                  <Search className="w-5 h-5 text-[var(--color-text-muted)]" />
                  <input
                    ref={modalInputRef}
                    type="text"
                    value={modalSearch}
                    onChange={(e) => {
                      setModalSearch(e.target.value);
                      setHighlightedIndex(0);
                    }}
                    onKeyDown={handleModalKeyDown}
                    placeholder={t('costCenterSelector.searchPlaceholder', 'Search cost centers...')}
                    className="flex-1 bg-transparent border-none outline-none text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]"
                    autoFocus
                  />
                  <button
                    onClick={() => setShowModal(false)}
                    className="p-1.5 hover:bg-[var(--color-bg-tertiary)] rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-[var(--color-text-secondary)]" />
                  </button>
                </div>
              </div>

              {/* Results */}
              <div className="flex-1 overflow-y-auto custom-scroll p-1">
                {loading ? (
                  <div className="p-8 text-center text-[var(--color-text-muted)] text-sm flex flex-col items-center gap-3">
                    <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                    {t('costCenterSelector.loading', 'Loading cost centers...')}
                  </div>
                ) : filteredCenters.length === 0 ? (
                  <div className="p-8 text-center text-[var(--color-text-muted)] text-sm">
                    {t('costCenterSelector.noResults', 'No cost centers found')}
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {filteredCenters.map((cc, index) => (
                      <div
                        key={cc.id}
                        onClick={() => handleSelectCC(cc)}
                        onMouseEnter={() => setHighlightedIndex(index)}
                        className={`px-4 py-3 cursor-pointer flex justify-between items-center text-sm rounded-md transition-colors
                          ${index === highlightedIndex ? 'bg-primary-50 dark:bg-primary-900/20' : 'hover:bg-[var(--color-bg-tertiary)]'}
                          ${(cc.code === value || cc.id === value) ? 'border-l-2 border-primary-500 bg-primary-50/50 dark:bg-primary-900/30' : ''}`}
                      >
                        <div className="flex flex-col">
                          <span className="font-bold text-[var(--color-text-primary)]">
                            {cc.code}
                          </span>
                          <span className="text-xs text-[var(--color-text-secondary)] truncate">
                            {cc.name}
                          </span>
                        </div>
                        {(cc.code === value || cc.id === value) && (
                          <div className="w-2 h-2 rounded-full bg-primary-500 shadow-sm shadow-primary-500/50" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
});

CostCenterSelector.displayName = 'CostCenterSelector';

export default CostCenterSelector;
