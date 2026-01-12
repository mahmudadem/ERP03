import React, { useState, useEffect, forwardRef, useImperativeHandle, useRef, useMemo } from 'react';
import { VoucherTypeDefinition } from '../../../../designer-engine/types/VoucherTypeDefinition';
import { JournalRow } from '../../forms-designer/types';
import { Plus, Trash2, Calendar, ChevronDown, Download, Image as ImageIcon, Loader2, Printer, Mail, Save } from 'lucide-react';
import { CurrencyExchangeWidget } from './CurrencyExchangeWidget';
import { AccountSelector } from './AccountSelector';
import { CurrencySelector } from './CurrencySelector';
import { AmountInput } from './AmountInput';
import { CustomComponentRegistry } from './registry';
import { Account } from '../../../../context/AccountsContext';
import { useAccounts } from '../../../../context/AccountsContext';
import { useCompanySettings } from '../../../../hooks/useCompanySettings';
import { formatCompanyDate, formatCompanyTime, formatForInput, getCompanyToday } from '../../../../utils/dateUtils';
import { DatePicker } from './DatePicker';
import { useCompanyAccess } from '../../../../context/CompanyAccessContext';
import { accountingApi } from '../../../../api/accountingApi';

interface GenericVoucherRendererProps {
  definition: VoucherTypeDefinition;
  mode?: 'classic' | 'windows';
  initialData?: any;
  onChange?: (data: any) => void;
  onBlur?: () => void;
  readOnly?: boolean;
}

const INITIAL_ROWS: JournalRow[] = Array.from({ length: 50 }).map((_, i) => ({
  id: i + 1,
  account: '',
  notes: '',
  debit: 0,
  credit: 0,
  currency: 'USD',
  parity: 1.0,
  equivalent: 0,
  category: ''
}));

export interface GenericVoucherRendererRef {
  getData: () => any;
  getRows: () => JournalRow[];
  resetData: () => void;
}

export const GenericVoucherRenderer = React.memo(forwardRef<GenericVoucherRendererRef, GenericVoucherRendererProps>(({ definition, mode = 'windows', initialData, onChange, onBlur, readOnly }, ref) => {
  // GUARD: Validate canonical (only if schemaVersion is present)
  if (definition.schemaVersion && definition.schemaVersion !== 2) {
    throw new Error('Cleanup violation: legacy view type detected. Only Schema V2 allowed.');
  }

  const { settings } = useCompanySettings();
  const { getAccountByCode } = useAccounts();
  const { company } = useCompanyAccess();

  // Language support with fallback (works without LanguageProvider)
  const t = (key: string) => key; // Simple fallback - just return key
  const isRTL = false; // Default LTR
  
  const [formData, setFormData] = useState<any>(initialData || {});
  const [rows, setRows] = useState<JournalRow[]>(INITIAL_ROWS);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isFirstRender = useRef(true);

  // Sync state with initialData updates (e.g. after fetch completes)
  useEffect(() => {
    if (initialData) {
      setFormData((prev: any) => {
        // Only update if ID changed or we were empty (basic equality check logic is complex, 
        // but for now we trust parent passes canonical data updates)
        // Actually, preventing overwrite of dirty state is hard.
        // But usually initialData goes null -> value.
        // We will simple overwrite if the ID changes or we have no ID.
        if (prev?.id !== initialData.id || !prev?.id) {
           return initialData;
        }
        return prev;
      });
      
      if (initialData.lines) {
         setRows((prev) => {
             // Only if lines are significantly different or we are switching records
             if (!initialData.lines) return prev;
             // If we have no rows or different voucher ID, take it.
             if (initialData.id !== formData.id) {
                 return initialData.lines.map((l: any, i: number) => ({...l, id: l.id || i + 1, _rowId: i + 1}));
             }
             return prev;
         });
      }
    }
  }, [initialData?.id]); // Only re-sync if the ID changes largely.
  
  // Recalculate parities when voucher currency or exchange rate changes
  useEffect(() => {
    const voucherRate = parseFloat(formData.exchangeRate as any) || 1.0;
    const voucherCurrency = formData.currency || company?.baseCurrency || 'USD';
    const baseCurrency = company?.baseCurrency || 'USD';
    
    console.log('[PARITY RECALC] Voucher currency or rate changed:', { voucherCurrency, voucherRate });
    
    // Fetch rates for all foreign currency lines (Optimized to batch requests)
    const recalculateAllParities = async () => {
      console.log('[PARITY RECALC] Starting recalculation. Voucher:', voucherCurrency, 'Rate:', voucherRate);
      
      // 1. Identify unique currencies that need updating
      const currenciesToFetch = new Set<string>();
      
      rows.forEach(row => {
        const lineCurrency = (row.currency || voucherCurrency).toUpperCase();
        // Only fetch if line currency DIFFERS from voucher currency
        if (lineCurrency !== voucherCurrency.toUpperCase()) {
           currenciesToFetch.add(lineCurrency);
        }
      });
      
      const uniqueCurrencies = Array.from(currenciesToFetch);
      console.log('[PARITY RECALC] Unique currencies to fetch:', uniqueCurrencies);
      
      // 2. Fetch rates for unique currencies (if any)
      const ratesMap = new Map<string, number>();
      
      if (uniqueCurrencies.length > 0) {
        await Promise.all(uniqueCurrencies.map(async (currency) => {
          try {
            // Optimization: If voucher is Foreign and Line is Base (USD), use inverse of voucher rate
            // This avoids an API call if we already have the rate in the header
            if (currency === baseCurrency.toUpperCase() && voucherCurrency.toUpperCase() !== baseCurrency.toUpperCase() && voucherRate !== 1.0) {
              const inverse = 1 / voucherRate;
              console.log('[PARITY RECALC] Using inverse calc for', currency, ':', inverse);
              ratesMap.set(currency, inverse);
              return;
            }

            console.log('[PARITY RECALC] Fetching API rate for:', currency);
            const result = await accountingApi.getSuggestedRate(
              currency,
              voucherCurrency,
              formData.date || getCompanyToday(settings)
            );
            
            if (result.rate) {
              console.log('[PARITY RECALC] API rate for', currency, ':', result.rate);
              ratesMap.set(currency, result.rate);
            }
          } catch (error) {
            console.error(`[PARITY RECALC] Failed to fetch rate for ${currency}:`, error);
          }
        }));
      }

      // 3. Update all lines with correct rates
      const updatedRows = rows.map(row => {
        const lineCurrency = (row.currency || voucherCurrency).toUpperCase();
        const vCurrency = voucherCurrency.toUpperCase();
        const amount = parseFloat(row.debit as any) || parseFloat(row.credit as any) || 0;
        
        // Case 1: Line Currency MATCHES Voucher Currency -> Force Parity 1.0
        if (lineCurrency === vCurrency) {
           if (row.parity !== 1.0) {
             console.log('[PARITY RECALC] Resetting line (matches voucher) to 1.0. ID:', row.id);
             return { ...row, parity: 1.0, equivalent: amount };
           }
           return row;
        }
        
        // Case 2: Line Currency DIFFERENT -> Apply fetched/calculated rate
        if (ratesMap.has(lineCurrency)) {
            const rate = ratesMap.get(lineCurrency)!;
            // Only update if rate differs significantly
            if (Math.abs((row.parity || 0) - rate) > 0.000001) {
                console.log('[PARITY RECALC] Updating line', row.id, 'curr:', lineCurrency, 'to rate:', rate);
                return {
                    ...row,
                    parity: rate,
                    equivalent: Math.round(amount * rate * 100) / 100
                };
            }
        }
        
        return row;
      });

      // 4. Update state if changed
      const hasChanges = updatedRows.some((row, i) => row.parity !== rows[i]?.parity);
      if (hasChanges) {
        console.log('[PARITY RECALC] Applying changes to rows.');
        setRows(updatedRows);
        onChangeRef.current?.({ ...formData, lines: updatedRows });
      } else {
        console.log('[PARITY RECALC] No changes needed.');
      }
    };
    
    recalculateAllParities();
  }, [formData.exchangeRate, formData.currency]);
  
  // Column resize state (for Classic table)
  const storageKey = `columnWidths_${definition.id}`;
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem(storageKey);
    return saved ? JSON.parse(saved) : {};
  });
  const [resizing, setResizing] = useState<{ columnId: string; startX: number; startWidth: number } | null>(null);
  
  // Line context menu state
  const [lineContextMenu, setLineContextMenu] = useState<{ x: number; y: number; rowId: number } | null>(null);
  const [highlightedRows, setHighlightedRows] = useState<Set<number>>(new Set());
  const [copiedLineData, setCopiedLineData] = useState<JournalRow | null>(null);
  
  // Line context menu handlers
  const handleLineContextMenu = (e: React.MouseEvent, rowId: number) => {
    e.preventDefault();
    e.stopPropagation();
    setLineContextMenu({ x: e.clientX, y: e.clientY, rowId });
  };
  
  const closeLineContextMenu = () => setLineContextMenu(null);
  
  const handleDeleteLine = (rowId: number) => {
    setRows((prev: JournalRow[]) => {
      const next = prev.filter(r => r.id !== rowId);
      onChangeRef.current?.({ ...formData, lines: next });
      return next;
    });
    closeLineContextMenu();
  };
  
  const handleCopyLine = (rowId: number) => {
    const row = rows.find(r => r.id === rowId);
    if (row) {
      setCopiedLineData(row);
      navigator.clipboard.writeText(JSON.stringify(row, null, 2));
    }
    closeLineContextMenu();
  };
  
  const handlePasteLine = async (rowId: number) => {
    try {
      const clipboardText = await navigator.clipboard.readText();
      const data = JSON.parse(clipboardText);
      if (data && typeof data === 'object') {
        setRows((prev: JournalRow[]) => {
          const next = prev.map(r => r.id === rowId ? { ...r, ...data, id: rowId } : r);
          onChangeRef.current?.({ ...formData, lines: next });
          return next;
        });
      }
    } catch (err) {
      // If clipboard doesn't have valid JSON, use internal copied data
      if (copiedLineData) {
        setRows((prev: JournalRow[]) => {
          const next = prev.map(r => r.id === rowId ? { ...copiedLineData, id: rowId } : r);
          onChangeRef.current?.({ ...formData, lines: next });
          return next;
        });
      }
    }
    closeLineContextMenu();
  };
  
  const handleInsertLine = (rowId: number) => {
    const rowIndex = rows.findIndex(r => r.id === rowId);
    const newRow: JournalRow = {
      id: Date.now(), // Unique ID
      account: '', notes: '', debit: 0, credit: 0, currency: 'USD', parity: 1, equivalent: 0, category: ''
    };
    setRows((prev: JournalRow[]) => {
      const next = [
        ...prev.slice(0, rowIndex + 1),
        newRow,
        ...prev.slice(rowIndex + 1)
      ];
      onChangeRef.current?.({ ...formData, lines: next });
      return next;
    });
    closeLineContextMenu();
  };
  
  const handleHighlightLine = (rowId: number) => {
    setHighlightedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(rowId)) {
        newSet.delete(rowId);
      } else {
        newSet.add(rowId);
      }
      return newSet;
    });
    closeLineContextMenu();
  };
  
  const handleOpenStatement = (rowId: number) => {
    const row = rows.find(r => r.id === rowId);
    if (row?.account) {
      // TODO: Open account statement window
      console.log('Open statement for account:', row.account);
      alert(`Account Statement for: ${row.account}\n(Feature to be implemented)`);
    }
    closeLineContextMenu();
  };
  
  const handleAccountBalance = (rowId: number) => {
    const row = rows.find(r => r.id === rowId);
    if (row?.account) {
      // TODO: Show account balance
      console.log('Show balance for account:', row.account);
      alert(`Account Balance for: ${row.account}\n(Feature to be implemented)`);
    }
    closeLineContextMenu();
  };
  
  // Cell navigation - refs for all focusable cells
  const cellRefs = useRef<Map<string, HTMLInputElement | HTMLSelectElement>>(new Map());
  
  const getCellKey = (rowIndex: number, colIndex: number) => `${rowIndex}-${colIndex}`;
  
  const handleCellKeyDown = (e: React.KeyboardEvent, rowIndex: number, colIndex: number, totalCols: number) => {
    const totalRows = rows.length;
    let newRowIndex = rowIndex;
    let newColIndex = colIndex;
    
    switch (e.key) {
      case 'ArrowUp':
        if (rowIndex > 0) {
          newRowIndex = rowIndex - 1;
          e.preventDefault();
        }
        break;
      case 'ArrowDown':
        if (rowIndex < totalRows - 1) {
          newRowIndex = rowIndex + 1;
          e.preventDefault();
        }
        break;
      case 'ArrowLeft':
        if (colIndex > 0) {
          newColIndex = colIndex - 1;
          e.preventDefault();
        }
        break;
      case 'ArrowRight':
        if (colIndex < totalCols - 1) {
          newColIndex = colIndex + 1;
          e.preventDefault();
        }
        break;
      case 'Tab':
        // Let Tab work naturally for form navigation
        return;
      case 'Enter':
        // Move to same column, next row
        if (rowIndex < totalRows - 1) {
          newRowIndex = rowIndex + 1;
          e.preventDefault();
        }
        break;
      default:
        return;
    }
    
    // Focus the new cell
    const newKey = getCellKey(newRowIndex, newColIndex);
    const newCell = cellRefs.current.get(newKey);
    if (newCell) {
      newCell.focus();
      if (newCell instanceof HTMLInputElement) {
        newCell.select();
      }
    }
  };
  
  const registerCellRef = (rowIndex: number, colIndex: number, el: HTMLInputElement | HTMLSelectElement | null) => {
    const key = getCellKey(rowIndex, colIndex);
    if (el) {
      cellRefs.current.set(key, el);
    } else {
      cellRefs.current.delete(key);
    }
  };
  
  // Save column widths to localStorage
  useEffect(() => {
    if (Object.keys(columnWidths).length > 0) {
      localStorage.setItem(storageKey, JSON.stringify(columnWidths));
    }
  }, [columnWidths, storageKey]);

  // Ref to hold the latest onChange callback to avoid effect dependencies
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const onBlurRef = useRef(onBlur);
  useEffect(() => {
    onBlurRef.current = onBlur;
  }, [onBlur]);

  
  // Handle column resize
  useEffect(() => {
    if (!resizing) return;
    
    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - resizing.startX;
      const newWidth = Math.max(50, resizing.startWidth + delta);
      setColumnWidths((prev: Record<string, number>) => ({ ...prev, [resizing.columnId]: newWidth }));
    };
    
    const handleMouseUp = () => {
      setResizing(null);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizing]);
  
  // Initialize form data: merge initialData with defaults
  useEffect(() => {
    const today = getCompanyToday(settings);
    
    // System field defaults - show proper fallbacks for unsaved vouchers
    const systemDefaults = {
      voucherNumber: 'Auto-generated',
      status: 'Draft',
      createdBy: 'Current User',
      createdAt: 'On Save',
      updatedAt: 'On Save',
      updatedBy: 'Current User'
    };
    
    // User input field defaults
    const inputDefaults = {
      date: today,
      currency: 'USD',
      exchangeRate: 1,
      paymentMethod: 'Bank Transfer',
      reference: '',
      description: '',
      notes: ''
    };
    
    const defaults = { ...systemDefaults, ...inputDefaults };
    
    // Convert dates from ISO to yyyy-MM-dd format for HTML date inputs
    const processedInitialData = initialData ? {
      ...initialData,
      // Only transform if it exists, don't set to undefined here
      ...(initialData.date ? { date: formatForInput(initialData.date) } : {}),
      // Keep system values if they exist, but don't overwrite if they don't
      voucherNumber: initialData.voucherNumber || initialData.voucherNo || initialData.id,
      status: initialData.status,
      createdBy: initialData.createdBy,
      createdAt: initialData.createdAt, // Keep original timestamp for proper date+time display
      updatedBy: initialData.updatedBy,
      updatedAt: initialData.updatedAt
    } : {};
    
    // Remove undefined keys to prevent them from overwriting defaults in the next spread
    Object.keys(processedInitialData).forEach(key => {
      if (processedInitialData[key] === undefined) {
        delete processedInitialData[key];
      }
    });
    
    // Merge: initialData takes precedence over defaults
    const mergedData = { ...defaults, ...processedInitialData };
    setFormData(mergedData);
    
    // If initialData has lines, populate rows
    if (initialData?.lines && Array.isArray(initialData.lines)) {
      const loadedRows = initialData.lines.map((line: any, index: number) => {
        // Strict V2 format: use side to determine debit/credit
        const amt = Math.abs(Number(line.amount) || 0);
        return {
          id: index + 1,
          account: line.accountId || line.account || '',
          notes: line.notes || line.description || '',
          debit: line.side === 'Debit' ? amt : 0,
          credit: line.side === 'Credit' ? amt : 0,
          currency: line.currency || line.lineCurrency || 'USD',
          parity: line.exchangeRate || line.parity || 1.0,
          equivalent: line.baseAmount || line.equivalent || 0,
          category: line.costCenterId || line.category || ''
        };
      });
      setRows(loadedRows);
    }
  }, [initialData, settings]); // Re-run when settings arrive to refresh 'Today' date
  
  // Expose getData method to parent via ref
  useImperativeHandle(ref, () => ({
    getData: () => {
      // Map designer codes to backend types
      const typeMap: Record<string, string> = {
        'JOURNAL': 'journal_entry',
        'JOURNAL_ENTRY': 'journal_entry',
        'PAYMENT': 'payment',
        'RECEIPT': 'receipt',
        'OPENING_BALANCE': 'opening_balance',
        'OPENING': 'opening_balance'
      };
      
      // Try to resolve backend type from multiple sources
      const defAny = definition as any;
      let backendType = 'journal_entry'; // Default fallback
      
      // 0. Check explicit baseType (stored when form is cloned/created)
      if (defAny.baseType && typeMap[defAny.baseType.toUpperCase()]) {
        backendType = typeMap[defAny.baseType.toUpperCase()];
      }
      // 1. Check explicit _typeId (from custom forms)
      else if (defAny._typeId && typeMap[defAny._typeId.toUpperCase()]) {
        backendType = typeMap[defAny._typeId.toUpperCase()];
      }
      // 2. Check code directly
      else if (definition.code && typeMap[definition.code.toUpperCase()]) {
        backendType = typeMap[definition.code.toUpperCase()];
      }
      // 3. Try to infer from name (for cloned forms like "Journal Entry - Copy")
      else if (definition.name) {
        const nameLower = definition.name.toLowerCase();
        if (nameLower.includes('journal')) backendType = 'journal_entry';
        else if (nameLower.includes('payment')) backendType = 'payment';
        else if (nameLower.includes('receipt')) backendType = 'receipt';
        else if (nameLower.includes('opening')) backendType = 'opening_balance';
      }
      // 4. Check if code contains a base type pattern
      else if (definition.code) {
        const codeLower = definition.code.toLowerCase();
        if (codeLower.includes('journal')) backendType = 'journal_entry';
        else if (codeLower.includes('payment')) backendType = 'payment';
        else if (codeLower.includes('receipt')) backendType = 'receipt';
        else if (codeLower.includes('opening')) backendType = 'opening_balance';
      }

      // 5. REVERSAL PROTECTION: If this voucher is already identified as a reversal (e.g., from backend or correction flow),
      // do NOT let the form definition override it back to 'journal_entry' or 'payment'.
      if (formData.type === 'reversal' || formData.reversalOfVoucherId) {
        backendType = 'reversal';
      }
      
      // Map rows to backend VoucherLine format
      const backendLines = rows
        .filter(row => row.account && (row.debit > 0 || row.credit > 0))
        .map(row => {
          const isDebit = (row.debit || 0) > 0;
          const amt = isDebit ? row.debit : row.credit;
          
          return {
            accountId: row.account,
            description: row.notes || '',
            side: isDebit ? 'Debit' : 'Credit',
            amount: Math.abs(Number(amt) || 0),
            baseAmount: Math.round((Math.abs(Number(amt) || 0) * (row.parity || 1)) * 100) / 100,
            lineCurrency: row.currency || 'USD',
            exchangeRate: row.parity || 1
          };
        });
      
      const resultFormId = definition.id;
      const resultPrefix = (definition as any).prefix || definition.code?.slice(0, 3).toUpperCase() || 'V';
      
      return {
        ...formData,
        lines: backendLines,
        type: backendType,  // Backend type for strategy (payment, receipt, journal_entry, opening_balance)
        formId: resultFormId, // Which form was used for rendering
        prefix: resultPrefix // Voucher number prefix
      };
    },
    getRows: () => rows,
    resetData: () => {
      const today = getCompanyToday(settings);
      
      setRows(INITIAL_ROWS);
      setFormData({
        date: today,
        currency: 'USD',
        exchangeRate: 1,
        status: 'Draft',
        voucherNumber: 'Auto-generated'
      });
    }
  }));
  
  const handleInputChange = (fieldId: string, value: any) => {
    setFormData((prev: any) => {
      const next = { ...prev, [fieldId]: value };
      
      // If header-level exchange rate changes, we might want to update all lines
      // that are using the default currency parity. But for now, lines handle their own parity.
      
      onChangeRef.current?.({ ...next, lines: rows });
      return next;
    });
  };

  const handleRowChange = async (id: number, field: keyof JournalRow, value: any) => {
    // 1. Update state synchronously for snappiness
    let targetRow: JournalRow | undefined;

    setRows((prev: JournalRow[]) => {
      const next = prev.map(row => {
        if (row.id === id) {
          const updated = { ...row, [field]: value };
          
          // ACCOUNT-CURRENCY SYNC: If account changes, sync currency
          if (field === 'account') {
            const acc = value as Account | null | string;
            if (acc && typeof acc === 'object') {
              updated.account = acc.code;
              if (acc.currency) {
                updated.currency = acc.currency;
              }
            } else {
              updated.account = acc as string;
              // If it's just a code, resolve currency from context
              const resolvedAcc = getAccountByCode(updated.account);
              if (resolvedAcc?.currency) {
                updated.currency = resolvedAcc.currency;
              }
            }
          }

          // Mutual exclusion: debit and credit cannot both have values
          if (field === 'debit' && value > 0) {
            updated.credit = 0;
          } else if (field === 'credit' && value > 0) {
            updated.debit = 0;
          }

          // Handle numeric fields safely without stripping partial decimals
          if (['debit', 'credit', 'parity'].includes(field as string)) {
            updated[field as 'debit' | 'credit' | 'parity'] = value as any;
          }

          // MULTI-CURRENCY LOGIC: Re-calculate equivalent (Base Amount)
          const debit = parseFloat(updated.debit as any) || 0;
          const credit = parseFloat(updated.credit as any) || 0;
          const parity = parseFloat(updated.parity as any) || 1.0;
          const amount = debit || credit || 0;
          updated.equivalent = Math.round(amount * parity * 100) / 100;
          
          targetRow = updated;
          return updated;
        }
        return row;
      });
      onChangeRef.current?.({ ...formData, lines: next });
      return next;
    });

    // 2. CALCULATE PARITY using voucher's exchange rate
    if ((field === 'currency' || field === 'account') && targetRow) {
      const lineCurrency = targetRow.currency || 'USD';
      const voucherCurrency = formData.currency || company?.baseCurrency || 'USD';
      const baseCurrency = company?.baseCurrency || 'USD';
      
      console.log('[PARITY CALC] Full formData:', JSON.stringify(formData, null, 2));
      console.log('[PARITY CALC]', {
        field,
        lineCurrency,
        voucherCurrency,
        baseCurrency,
        voucherRate: formData.exchangeRate
      });
      
      if (lineCurrency.toUpperCase() === voucherCurrency.toUpperCase()) {
        // Same as voucher currency → parity = 1
        if (targetRow.parity !== 1.0) {
          setRows((prev: JournalRow[]) => {
            const next = prev.map(r => {
              if (r.id === id) {
                const debit = parseFloat(r.debit as any) || 0;
                const credit = parseFloat(r.credit as any) || 0;
                console.log('[PARITY CALC] Same as voucher currency, parity = 1');
                return { ...r, parity: 1.0, equivalent: debit || credit || 0 };
              }
              return r;
            });
            onChangeRef.current?.({ ...formData, lines: next });
            return next;
          });
        }
      } else if (lineCurrency.toUpperCase() === baseCurrency.toUpperCase()) {
        // Line is in base currency (USD), voucher is in foreign currency (EUR)
        // Use inverse of voucher rate: if EUR→USD = 1.13, then USD→EUR = 1/1.13 = 0.885
        const voucherRate = parseFloat(formData.exchangeRate as any) || 1.0;
        const parity = voucherRate !== 1.0 ? (1 / voucherRate) : 1.0;
        
        setRows((prev: JournalRow[]) => {
          const next = prev.map(r => {
            if (r.id === id) {
              const debit = parseFloat(r.debit as any) || 0;
              const credit = parseFloat(r.credit as any) || 0;
              const amount = debit || credit || 0;
              console.log('[PARITY CALC] Base currency line, using inverse of voucher rate:', parity);
              return { 
                ...r, 
                parity, 
                equivalent: Math.round(amount * parity * 100) / 100 
              };
            }
            return r;
          });
          onChangeRef.current?.({ ...formData, lines: next });
          return next;
        });
      } else {
        // Line is in different foreign currency (e.g., TRY in EUR voucher)
        // Need to fetch TRY→EUR rate from database
        try {
          console.log('[PARITY CALC] Fetching rate from database:', lineCurrency, '→', voucherCurrency);
          const result = await accountingApi.getSuggestedRate(
            lineCurrency, 
            voucherCurrency,
            formData.date || getCompanyToday(settings)
          );
          
          console.log('[PARITY CALC] Database result:', result);
          
          if (result.rate) {
            setRows((prev: JournalRow[]) => {
              const next = prev.map(r => {
                if (r.id === id) {
                  const parity = result.rate || 1.0;
                  const debit = parseFloat(r.debit as any) || 0;
                  const credit = parseFloat(r.credit as any) || 0;
                  const amount = debit || credit || 0;
                  console.log('[PARITY CALC] Setting parity from database:', parity);
                  return { 
                    ...r, 
                    parity, 
                    equivalent: Math.round(amount * parity * 100) / 100 
                  };
                }
                return r;
              });
              onChangeRef.current?.({ ...formData, lines: next });
              return next;
            });
          }
        } catch (error) {
          console.error('[PARITY CALC] Failed to fetch rate:', error);
        }
      }
    }
  };

  const addRow = () => {
    setRows(prev => {
      const next = [...prev, {
        id: prev.length + 1,
        account: '', notes: '', debit: 0, credit: 0, currency: 'USD', parity: 1, equivalent: 0, category: ''
      }];
      onChangeRef.current?.({ ...formData, lines: next });
      return next;
    });
  };

  // Helper: Get display prefix from definition
  const getVoucherPrefix = (): string => {
    return definition.code?.substring(0, 3) || 'VOC';
  };

  // Helper: Detect format and get table columns
  const getTableColumns = (): any[] => {
    const rawColumns = (definition as any).tableColumns;
    
    // Only return defaults if property is missing entirely
    if (rawColumns === undefined || rawColumns === null) {
      const baseColumns = [
        { id: 'account', label: t('account') || 'Account', width: '25%' },
        { id: 'debit', label: t('debit') || 'Debit', width: '15%' },
        { id: 'credit', label: t('credit') || 'Credit', width: '15%' }
      ];
      
      // Safety Net: If it's a Journal Entry, include multi-currency columns in the default view
      const isJE = definition.code?.toLowerCase().includes('journal') || 
                   (definition as any).baseType?.toLowerCase().includes('journal-entry');
                   
      if (isJE) {
        baseColumns.push(
          { id: 'currency', label: t('currency') || 'Currency', width: '80px' },
          { id: 'parity', label: t('parity') || 'Parity', width: '80px' },
          { id: 'equivalent', label: t('equivalent') || 'Equivalent', width: '100px' }
        );
      }
      
      baseColumns.push({ id: 'notes', label: t('notes') || 'Notes', width: 'auto' });
      return baseColumns;
    }

    if (!Array.isArray(rawColumns) || rawColumns.length === 0) {
      return [];
    }

    return rawColumns.map((col: any) => {
      // Handle legacy string array
      if (typeof col === 'string') {
        const fallbackLabel = col.charAt(0).toUpperCase() + col.slice(1);
        return { 
          id: col, 
          label: t(col) || fallbackLabel,
          width: 'auto'
        };
      }
      
      // Handle structured object array (Schema V2)
      const colId = col.id || col.fieldId;
      // If we have no ID at all, then "Column" is the last resort fallback
      const fallbackLabel = colId ? (colId.charAt(0).toUpperCase() + colId.slice(1)) : 'Column';
      
      return {
        id: colId,
        label: col.labelOverride || col.label || (colId ? t(colId) : undefined) || fallbackLabel,
        width: col.width || 'auto'
      };
    });
  };

  // --- Field Renderers ---

  const renderField = (fieldId: string, labelOverride?: string, typeOverride?: string) => {
    // Helper to get field value with case-insensitive lookup
    const getFieldValue = (fid: string) => {
      const lower = fid.toLowerCase();
      return formData[fid] ?? formData[lower] ?? '';
    };

    // SAFETY: Strip any legacy debug labels if they come from the database/override
    const cleanLabel = (label: string) => {
      if (!label) return label;
      return label.replace(/🔴\s*TEST:\s*/gi, '').replace(/TEST:\s*/gi, '');
    };

    const finalLabel = cleanLabel(labelOverride || t(fieldId) || fieldId);
    
    // 0. Suppress standalone exchangeRate if it's handled by CurrencyExchangeWidget (at currency slot)
    if (fieldId === 'exchangeRate') {
      const hasCurrency = (definition.headerFields || []).some(f => f.id === 'currency' || f.id === 'currencyExchange');
      const hasCurrencyInUI = (definition as any).uiModeOverrides?.[mode]?.sections?.HEADER?.fields?.some((f: any) => f.fieldId === 'currency' || f.fieldId === 'currencyExchange');
      
      if (hasCurrency || hasCurrencyInUI) {
        return null;
      }
    }

    // 0. Special Components (Currency Exchange Widget via Registry)
    if (fieldId === 'currencyExchange' || fieldId === 'exchangeRate') {
      const CurrencyComp = CustomComponentRegistry.currencyExchange;
      return (
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wide">{finalLabel}</label>
          <CurrencyComp
            currency={formData.currency || 'USD'}
            value={formData.exchangeRate}
            disabled={readOnly}
            onChange={(rate: number) => {
              handleInputChange('exchangeRate', rate);
            }}
          />
        </div>
      );
    }

    // 0.5. Custom Components from Registry
    if (CustomComponentRegistry[fieldId] || fieldId === 'account' || fieldId === 'accountSelector') {
      const Component = CustomComponentRegistry[fieldId] || CustomComponentRegistry.account;
      return (
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wide">{finalLabel}</label>
          <Component
            value={formData[fieldId]}
            disabled={readOnly}
            onChange={(val: any) => {
               // Adaptation for AccountSelector which returns an account object
               if ((fieldId === 'account' || fieldId === 'accountSelector') && val?.code) {
                  handleInputChange(fieldId, val.code);
               } else {
                  handleInputChange(fieldId, val);
               }
            }}
          />
        </div>
      );
    }
    
    // 1. System Fields (Read Only)
    // Removed 'date' from this list as it should be editable via CompanyDatePicker
    const lowerFid = fieldId.toLowerCase();
    if (['vouchernumber', 'voucherno', 'status', 'createdby', 'createdat', 'updatedby', 'updatedat'].includes(lowerFid)) {
       const isDate = lowerFid === 'createdat' || lowerFid === 'updatedat';
       // Case-insensitive value lookup
       const rawValue = formData[fieldId] ?? formData[lowerFid] ?? '';
       
       let displayValue;
       if (isDate) {
           // If it's already a formatted string (e.g., "31/12/2025"), use it directly
           // Otherwise, format it using formatCompanyDate and add time
           if (typeof rawValue === 'string' && rawValue.includes('/')) {
               displayValue = rawValue;
           } else if (rawValue) {
               // Parse ISO timestamp and format with date + time
               const date = new Date(rawValue);
               if (!isNaN(date.getTime())) {
                   const dateStr = formatCompanyDate(rawValue, settings);
                   const timeStr = date.toLocaleTimeString('en-US', { 
                       hour: '2-digit', 
                       minute: '2-digit',
                       hour12: true 
                   });
                   displayValue = `${dateStr} ${timeStr}`;
               } else {
                   displayValue = formatCompanyDate(rawValue, settings);
               }
           } else {
               displayValue = '-';
           }
       } else if ((lowerFid === 'createdby' || lowerFid === 'updatedby') && typeof rawValue === 'string' && rawValue.length > 15) {
           // Truncate long user IDs
           displayValue = rawValue.substring(0, 12) + '...';
       } else {
           displayValue = rawValue || 'Pending';
       }
       
       return (
          <div className="space-y-0.5">
             <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wide">{finalLabel}</label>
             <div 
                 className="w-full p-1.5 border border-[var(--color-border)] rounded bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] text-xs shadow-sm min-h-[30px] flex items-center transition-colors"
                 style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                 title={rawValue}
             >
               {displayValue}
             </div>
          </div>
       );
    }

    // 2. Line Items Table
    if (fieldId === 'lineItems') {
        const columns = getTableColumns();
        const isClassic = (definition as any).tableStyle === 'classic';
        
        // Handle resize start
        const handleResizeStart = (e: React.MouseEvent, columnId: string, currentWidth: number) => {
            e.preventDefault();
            setResizing({ columnId, startX: e.clientX, startWidth: currentWidth });
        };

        if (isClassic) {
            return (
                <div className="border border-[var(--color-border)] rounded overflow-hidden shadow-sm bg-[var(--color-bg-primary)] transition-colors">
                    <div className="max-h-[300px] overflow-y-auto custom-scroll">
                    <table className="w-full text-sm min-w-[600px] border-collapse">
                        <thead className="sticky top-0 bg-[var(--color-bg-tertiary)] z-10 transition-colors">
                             <tr className="border-b-2 border-[var(--color-border)]">
                                 <th className="p-2 text-center w-10 text-[11px] font-bold text-[var(--color-text-primary)] border-r border-[var(--color-border)] bg-[var(--color-bg-secondary)]/30">#</th>
                                 {columns.map(col => {
                                     // Parse initial width from column definition
                                     let initialWidth = 150; // Default
                                     if (col.width) {
                                       if (typeof col.width === 'number') {
                                         initialWidth = col.width;
                                       } else if (typeof col.width === 'string') {
                                         const parsed = parseInt(col.width);
                                         if (!isNaN(parsed)) initialWidth = parsed;
                                       }
                                     }
                                     
                                     const colWidth = columnWidths[col.id] || initialWidth;
                                     
                                     return (
                                         <th 
                                           key={col.id} 
                                           className="p-2 text-start text-[11px] font-bold text-[var(--color-text-primary)] uppercase tracking-wide border-r border-[var(--color-border)] relative group transition-colors"
                                           style={{ width: `${colWidth}px`, minWidth: `${colWidth}px` }}
                                         >
                                           {col.label}
                                           {/* Resize handle */}
                                           <div
                                             className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                             onMouseDown={(e) => handleResizeStart(e, col.id, colWidth)}
                                           />
                                         </th>
                                     );
                                 })}
                                 <th className="p-2 w-8 border-[var(--color-border)] border-r-0"></th>
                             </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--color-border)] transition-colors">
                            {rows.map((row, index) => (
                                 <tr 
                                   key={row.id} 
                                   className={`hover:bg-primary-50/40 dark:hover:bg-primary-900/10 hover:shadow-sm transition-all duration-150 border-b border-[var(--color-border)] group ${highlightedRows.has(row.id) ? 'bg-warning-100/50 dark:bg-warning-900/30' : ''}`}
                                 >
                                    <td 
                                      className="p-2 text-[var(--color-text-muted)] text-[11px] font-medium text-center border-r border-[var(--color-border)] bg-[var(--color-bg-secondary)]/30 cursor-pointer hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                                      onContextMenu={(e) => handleLineContextMenu(e, row.id)}
                                    >
                                      {index + 1}
                                    </td>
                                     {columns.map((col, colIndex) => {
                                         const colId = col.id;
                                         const totalCols = columns.length;
                                         
                                         // Parse initial width (same logic as header)
                                         let initialWidth = 150;
                                         if (col.width) {
                                           if (typeof col.width === 'number') {
                                             initialWidth = col.width;
                                           } else if (typeof col.width === 'string') {
                                             const parsed = parseInt(col.width);
                                             if (!isNaN(parsed)) initialWidth = parsed;
                                           }
                                         }
                                         const colWidth = columnWidths[colId] || initialWidth;
                                         
                                         return (
                                             <td 
                                               key={`${row.id}-${colId}`} 
                                               className="p-0 border-r border-[var(--color-border)]"
                                               style={{ width: `${colWidth}px`, minWidth: `${colWidth}px` }}
                                             >
                                                 {(colId === 'account' || colId === 'accountSelector' || col.type === 'account-selector') ? (
                                                     <div className="p-0.5">
                                                        <AccountSelector 
                                                            ref={(el) => registerCellRef(index, colIndex, el)}
                                                            value={row.account} 
                                                            onChange={(val) => handleRowChange(row.id, 'account', val)} 
                                                            noBorder={true}
                                                            disabled={readOnly}
                                                            onKeyDown={(e) => handleCellKeyDown(e, index, colIndex, totalCols)}
                                                            onBlur={() => onBlurRef.current?.()}
                                                        />
                                                     </div>
                                                 ) : colId === 'debit' || colId === 'credit' ? (
                                                     <AmountInput
                                                         ref={(el) => registerCellRef(index, colIndex, el)}
                                                         value={row[colId as 'debit' | 'credit'] || 0}
                                                         disabled={readOnly}
                                                         onChange={(val) => handleRowChange(row.id, colId as 'debit' | 'credit', val)}
                                                         onKeyDown={(e) => handleCellKeyDown(e, index, colIndex, totalCols)}
                                                         onBlur={() => onBlurRef.current?.()}
                                                      />
                                                 ) : (colId === 'currency' || col.type === 'currency' || col.type === 'currency-selector') ? (
                                                     <div className="p-0.5">
                                                        <CurrencySelector 
                                                            ref={(el) => registerCellRef(index, colIndex, el)}
                                                            value={(row as any)[colId] || ''}
                                                            disabled={readOnly || !!getAccountByCode(row.account)?.currency}
                                                            onChange={(val) => handleRowChange(row.id, colId as any, val)} 
                                                            noBorder={true}
                                                            onKeyDown={(e) => handleCellKeyDown(e, index, colIndex, totalCols)}
                                                            onBlur={() => onBlurRef.current?.()}
                                                        />
                                                     </div>
                                                 ) : (
                                                     <input 
                                                       ref={(el) => registerCellRef(index, colIndex, el)}
                                                       type="text" 
                                                       value={(row as any)[colId] || ''}
                                                       disabled={readOnly}
                                                       onChange={(e) => handleRowChange(row.id, colId as any, e.target.value)}
                                                       onKeyDown={(e) => handleCellKeyDown(e, index, colIndex, totalCols)}
                                                       onBlur={() => onBlurRef.current?.()}
                                                       className={`w-full h-9 p-2 border-none bg-transparent text-xs focus:ring-2 focus:ring-primary-500 outline-none text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] transition-colors ${readOnly ? 'cursor-not-allowed opacity-70' : ''}`} 
                                                     />
                                                 )}
                                         </td>
                                     );
                                 })}
                                <td className="p-1 text-center w-8">
                                    {!readOnly && (
                                      <button 
                                        onClick={() => setRows(prev => prev.filter(r => r.id !== row.id))}
                                        className="p-1.5 text-[var(--color-text-muted)] hover:text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-900/20 rounded transition-all"
                                      >
                                          <Trash2 size={14} />
                                      </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                </div>
                {!readOnly && (
                  <button onClick={addRow} className="w-full py-2.5 text-center text-[11px] font-bold text-primary-600 bg-[var(--color-bg-secondary)] border-t border-[var(--color-border)] hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all uppercase tracking-widest">
                      + {t('addLine')}
                  </button>
                )}
                
                {/* Line Context Menu */}
                {lineContextMenu && (
                  <>
                    <div 
                      className="fixed inset-0 z-[9998]" 
                      onClick={closeLineContextMenu}
                      onContextMenu={(e) => { e.preventDefault(); closeLineContextMenu(); }}
                    />
                    <div 
                      className="fixed bg-[var(--color-bg-primary)] rounded-lg shadow-2xl border border-[var(--color-border)] z-[9999] py-1.5 w-52 transition-colors animate-in fade-in zoom-in duration-200"
                      style={{ left: lineContextMenu.x, top: lineContextMenu.y }}
                    >
                      <button
                        onClick={() => handleDeleteLine(lineContextMenu.rowId)}
                        className="w-full px-4 py-2 text-left text-sm text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-900/20 flex items-center gap-3 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete Line
                      </button>
                      <div className="border-t border-[var(--color-border)] my-1.5 opacity-50"></div>
                      <button
                        onClick={() => handleCopyLine(lineContextMenu.rowId)}
                        className="w-full px-4 py-2 text-left text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] flex items-center gap-3 transition-colors"
                      >
                        <Download className="w-4 h-4 text-[var(--color-text-secondary)]" />
                        Copy
                      </button>
                      <button
                        onClick={() => handlePasteLine(lineContextMenu.rowId)}
                        className="w-full px-4 py-2 text-left text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] flex items-center gap-3 transition-colors"
                      >
                        <Plus className="w-4 h-4 text-[var(--color-text-secondary)]" />
                        Paste
                      </button>
                      <button
                        onClick={() => handleInsertLine(lineContextMenu.rowId)}
                        className="w-full px-4 py-2 text-left text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] flex items-center gap-3 transition-colors"
                      >
                        <Plus className="w-4 h-4 text-[var(--color-text-secondary)]" />
                        Insert Below
                      </button>
                      <div className="border-t border-[var(--color-border)] my-1.5 opacity-50"></div>
                      <button
                        onClick={() => handleHighlightLine(lineContextMenu.rowId)}
                        className="w-full px-4 py-2 text-left text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] flex items-center gap-3 transition-colors"
                      >
                        <span className={`w-4 h-4 rounded-sm ${highlightedRows.has(lineContextMenu.rowId) ? 'bg-warning-500' : 'bg-warning-300'} border border-warning-400`}></span>
                        {highlightedRows.has(lineContextMenu.rowId) ? 'Remove Highlight' : 'Highlight'}
                      </button>
                      <div className="border-t border-[var(--color-border)] my-1.5 opacity-50"></div>
                      <button
                        onClick={() => handleOpenStatement(lineContextMenu.rowId)}
                        className="w-full px-4 py-2 text-left text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] flex items-center gap-3 transition-colors"
                      >
                        <Calendar className="w-4 h-4 text-[var(--color-text-secondary)]" />
                        Statement
                      </button>
                      <button
                        onClick={() => handleAccountBalance(lineContextMenu.rowId)}
                        className="w-full px-4 py-2 text-left text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] flex items-center gap-3 transition-colors"
                      >
                        <ChevronDown className="w-4 h-4 text-[var(--color-text-secondary)]" />
                        Account Balance
                      </button>
                    </div>
                  </>
                )}
            </div>
        );
    }

    // Default Web Style
    return (
        <div className="border border-[var(--color-border)] rounded-lg overflow-x-auto shadow-sm min-h-[200px] bg-[var(--color-bg-primary)] transition-colors">
            <table className="w-full text-sm min-w-[600px]">
                <thead className="bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] font-medium">
                     <tr>
                         <th className="p-2 text-start w-10 text-xs">#</th>
                         {columns.map(col => (
                             <th 
                               key={col.id} 
                               className="p-2 text-start text-xs capitalize"
                               style={col.width ? { width: col.width, minWidth: col.width === 'auto' ? '150px' : col.width } : {}}
                             >
                               {col.label}
                             </th>
                         ))}
                         <th className="p-2 w-8"></th>
                     </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)] opacity-80">
                    {rows.map((row, index) => (
                        <tr key={row.id} className="hover:bg-primary-50/30 dark:hover:bg-primary-900/10 transition-colors">
                            <td className="p-2 text-[var(--color-text-muted)] text-xs text-center">{index + 1}</td>
                             {columns.map((col, colIdx) => {
                                 const colId = col.id;
                                 return (
                                     <td 
                                       key={`${row.id}-${colId}`} 
                                       className="p-1"
                                       style={col.width ? { width: col.width } : {}}
                                     >
                                         {(colId === 'account' || colId === 'accountSelector' || col.type === 'account-selector') ? (
                                             <AccountSelector 
                                                 ref={(el) => registerCellRef(index, colIdx, el)}
                                                 value={row.account} 
                                                 disabled={readOnly}
                                                 onChange={(val) => handleRowChange(row.id, 'account', val)} 
                                                 onKeyDown={(e) => handleCellKeyDown(e, index, colIdx, columns.length)}
                                                 onBlur={() => onBlurRef.current?.()}
                                             />
                                         ) : colId === 'currency' ? (
                                             <CurrencySelector
                                                 ref={(el) => registerCellRef(index, colIdx, el)}
                                                 value={row.currency}
                                                 disabled={readOnly || !!getAccountByCode(row.account)?.currency}
                                                 onChange={(val) => handleRowChange(row.id, 'currency', val)}
                                                 onKeyDown={(e) => handleCellKeyDown(e, index, colIdx, columns.length)}
                                                 onBlur={() => onBlurRef.current?.()}
                                                 noBorder
                                             />
                                         ) : colId === 'debit' || colId === 'credit' || colId === 'equivalent' || colId === 'parity' ? (
                                             <input 
                                                 ref={(el) => registerCellRef(index, colIdx, el)}
                                                 type="number" 
                                                 step="any"
                                                 disabled={readOnly || colId === 'equivalent'}
                                                 value={colId === 'equivalent' ? (parseFloat(row[colId as keyof JournalRow] as any) || 0).toFixed(2) : (row[colId as keyof JournalRow] ?? '')}
                                                 onChange={(e) => handleRowChange(row.id, colId as any, e.target.value)}
                                                 onKeyDown={(e) => handleCellKeyDown(e, index, colIdx, columns.length)}
                                                 onBlur={() => onBlurRef.current?.()}
                                                 readOnly={colId === 'equivalent'}
                                                 title={colId === 'equivalent' ? "Equivalent = Amount * Parity (Read-only)" : ""}
                                                 className={`w-full p-1.5 border border-[var(--color-border)] rounded text-xs text-end focus:ring-1 focus:ring-primary-500 outline-none font-mono bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] ${colId === 'equivalent' || readOnly ? 'bg-[var(--color-bg-secondary)] cursor-not-allowed opacity-80' : ''}`} 
                                             />
                                         ) : (
                                             <input 
                                               ref={(el) => registerCellRef(index, colIdx, el)}
                                               type="text" 
                                               value={(row as any)[colId] || ''}
                                               disabled={readOnly}
                                               onChange={(e) => handleRowChange(row.id, colId as any, e.target.value)}
                                               onKeyDown={(e) => handleCellKeyDown(e, index, colIdx, columns.length)}
                                               onBlur={() => onBlurRef.current?.()}
                                               className={`w-full p-1.5 border border-[var(--color-border)] rounded text-xs focus:ring-1 focus:ring-primary-500 outline-none bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] transition-colors ${readOnly ? 'bg-[var(--color-bg-secondary)] cursor-not-allowed opacity-80' : ''}`} 
                                               />
                                         )}
                                     </td>
                                 );
                             })}
                            <td className="p-2 text-center w-8">
                                {!readOnly && (
                                  <button 
                                    onClick={() => setRows(prev => prev.filter(r => r.id !== row.id))}
                                     className="text-[var(--color-text-muted)] hover:text-danger-500 transition-colors"
                                  >
                                      <Trash2 size={14} />
                                  </button>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
                <tfoot className="bg-[var(--color-bg-secondary)] border-t-2 border-[var(--color-border)] sticky bottom-0 z-10">
                    <tr>
                        <td className="p-2 text-center text-[10px] font-bold text-[var(--color-text-muted)]">∑</td>
                        {columns.map((col, idx) => {
                            const isDebitCol = col.id === 'debit';
                            const isCreditCol = col.id === 'credit';
                            const isEquivCol = col.id === 'equivalent';
                            
                            // Calculate simple transaction totals for Debit/Credit columns
                            if (isDebitCol || isCreditCol) {
                                const total = rows.reduce((sum, r) => sum + (r[col.id as 'debit' | 'credit'] || 0), 0);
                                return (
                                    <td key={`total-${col.id}`} className="p-2 text-end font-mono text-xs font-bold text-[var(--color-text-primary)]">
                                        {total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                );
                            }

                            // Calculate Equivalent (Base Currency) totals for the Equivalent column
                            if (isEquivCol) {
                                const equivDebit = rows.reduce((sum, r) => sum + ((parseFloat(r.debit as any) || 0) * (parseFloat(r.parity as any) || 1)), 0);
                                const equivCredit = rows.reduce((sum, r) => sum + ((parseFloat(r.credit as any) || 0) * (parseFloat(r.parity as any) || 1)), 0);
                                const balanced = Math.abs(equivDebit - equivCredit) < 0.01;
                                
                                return (
                                    <td key={`total-${col.id}`} className="p-2 text-end">
                                      <div className="flex flex-col items-end">
                                        <div className="flex gap-2 text-[10px] text-[var(--color-text-muted)] font-bold uppercase">
                                          <span>D: {equivDebit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                          <span>C: {equivCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                        </div>
                                        <div className={`text-xs font-mono font-bold ${balanced ? 'text-success-600' : 'text-danger-600'}`}>
                                          Diff: {(equivDebit - equivCredit).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </div>
                                      </div>
                                    </td>
                                );
                            }

                            return <td key={`total-empty-${idx}`} className="p-2"></td>;
                        })}
                        <td></td>
                    </tr>
                </tfoot>
            </table>
              {!readOnly && (
               <button onClick={addRow} className="w-full py-2 text-center text-xs font-medium text-primary-600 bg-[var(--color-bg-secondary)] border-t border-[var(--color-border)] hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-all">
                   + {t('addLine')}
               </button>
              )}
        </div>
    );
}

    // 3. Standard Inputs (from canonical headerFields)
    
    // System fields list - these are read-only display fields
    const systemFields = ['voucherNumber', 'voucherNo', 'status', 'createdBy', 'createdAt', 'updatedAt', 'updatedBy'];
    const lowerFieldId = fieldId.toLowerCase();
    const isSystemField = systemFields.some(sf => sf.toLowerCase() === lowerFieldId) || 
                          lowerFieldId.endsWith('createdat') || 
                          lowerFieldId.endsWith('updatedat') || 
                          lowerFieldId.endsWith('createdby') || 
                          lowerFieldId.endsWith('updatedby');
    
    // DEBUG: Log for system fields
    if (fieldId.toLowerCase().includes('created') || fieldId.toLowerCase().includes('updated')) {
        console.log(`🔍 ${fieldId} → isSystemField: ${isSystemField}, lowerFieldId: ${lowerFieldId}`);
    }

    return (
        <div className="space-y-0.5">
            <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wide">{finalLabel}</label>
            {/* System fields - display as read-only */}
            {(isSystemField || lowerFieldId.includes('created') || lowerFieldId.includes('updated')) ? (
                <div 
                    className="w-full p-1.5 border border-[var(--color-border)] rounded bg-[var(--color-bg-secondary)] text-xs text-[var(--color-text-secondary)] italic transition-colors block" 
                    style={{ maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    title={getFieldValue(fieldId)}
                >
                    {(() => {
                        // Normalize field name for checks
                        const normId = lowerFieldId.includes('createdby') ? 'createdBy' : 
                                      lowerFieldId.includes('updatedby') ? 'updatedBy' : 
                                      lowerFieldId.includes('createdat') ? 'createdAt' : 
                                      lowerFieldId.includes('updatedat') ? 'updatedAt' : fieldId;
                        
                        // Get value using helper
                        const rawVal = getFieldValue(fieldId);

                        /* Removed forced min0dXFj test */

                        const val = (normId === 'createdAt' || normId === 'updatedAt')
                            ? formatCompanyDate(rawVal, settings) 
                            : (normId === 'createdBy' && formData.createdByName) ? formData.createdByName
                            : (normId === 'updatedBy' && formData.updatedByName) ? formData.updatedByName
                            : rawVal || 'Pending';
                        
                        // Aggressive truncation for user ID fields
                        if ((normId === 'createdBy' || normId === 'updatedBy') && typeof val === 'string' && val.length > 15) {
                            return val.substring(0, 12) + '...';
                        }
                        return val;
                    })()}
                </div>
            ) : fieldId === 'currency' || fieldId === 'paymentMethod' ? (
                 <div className="relative">
                     <select 
                       value={formData[fieldId] || ''}
                       disabled={readOnly}
                       onChange={(e) => handleInputChange(fieldId, e.target.value)}
                       onBlur={() => onBlurRef.current?.()}
                       className={`w-full p-1.5 border border-[var(--color-border)] rounded bg-[var(--color-bg-primary)] text-xs text-[var(--color-text-primary)] focus:ring-1 focus:ring-primary-500 outline-none shadow-sm appearance-none pr-6 transition-colors ${readOnly ? 'bg-[var(--color-bg-secondary)] cursor-not-allowed opacity-80' : ''}`}
                     >
                        {fieldId === 'currency' ? (
                          <>
                            <option value="USD">USD</option>
                            <option value="EUR">EUR</option>
                            <option value="TRY">TRY</option>
                          </>
                        ) : (
                          <>
                            <option value="Bank Transfer">Bank Transfer</option>
                            <option value="Cash">Cash</option>
                            <option value="Check">Check</option>
                          </>
                        )}
                    </select>
                     <ChevronDown className={`absolute top-2 ${isRTL ? 'left-2' : 'right-2'} text-[var(--color-text-muted)] pointer-events-none`} size={14} />
                 </div>
            ) : fieldId === 'date' ? (
                 <div className="relative">
            <DatePicker 
              value={formData[fieldId] || ''}
              disabled={readOnly}
              onChange={(val: string) => handleInputChange(fieldId, val)}
            />
                 </div>
            ) : (typeOverride === 'textarea' || (!typeOverride && (fieldId === 'notes' || fieldId === 'description'))) ? (
                  <textarea 
                    value={formData[fieldId] || ''}
                    disabled={readOnly}
                    onChange={(e) => handleInputChange(fieldId, e.target.value)}
                    onBlur={() => onBlurRef.current?.()}
                    className={`w-full p-1.5 border border-[var(--color-border)] rounded bg-[var(--color-bg-primary)] text-xs text-[var(--color-text-primary)] focus:ring-1 focus:ring-primary-500 outline-none shadow-sm min-h-[60px] transition-colors ${readOnly ? 'bg-[var(--color-bg-secondary)] cursor-not-allowed opacity-80' : ''}`} 
                  />
            ) : (
                <input 
                    type={fieldId === 'exchangeRate' || fieldId === 'amount' ? 'number' : 'text'}
                    value={getFieldValue(fieldId)}
                    disabled={readOnly}
                    onChange={(e) => handleInputChange(fieldId, e.target.value)}
                    onBlur={() => onBlurRef.current?.()}
                    className={`w-full p-1.5 border border-[var(--color-border)] rounded bg-[var(--color-bg-primary)] text-xs text-[var(--color-text-primary)] focus:ring-1 focus:ring-primary-500 outline-none shadow-sm transition-colors ${readOnly ? 'bg-[var(--color-bg-secondary)] cursor-not-allowed opacity-80' : ''}`}
                />
            )}
        </div>
    );
  };

  // Render header fields - supports both formats
  const renderHeaderFields = () => {
    const configDef = definition as any;
    
    // Format 1: VoucherFormConfig (designer) - uses uiModeOverrides.sections
    // PRIORITY: If custom layout exists, use it!
    if (configDef.uiModeOverrides && configDef.uiModeOverrides[mode]) {
      const sections = configDef.uiModeOverrides[mode].sections;
      const headerSection = sections.HEADER;
      
      if (headerSection && headerSection.fields && headerSection.fields.length > 0) {
        // Sort fields by row and col
        const sortedFields = [...headerSection.fields].sort((a: any, b: any) => {
          if (a.row !== b.row) return a.row - b.row;
          return a.col - b.col;
        });
        
         return (
           <div className="bg-[var(--color-bg-primary)] px-4 py-3 border-b border-[var(--color-border)] mb-4 transition-colors">
            <div className="grid grid-cols-12 gap-x-4 gap-y-2">
              {sortedFields.map((field: any) => (
                <div 
                  key={field.fieldId} 
                  className={`col-span-${field.colSpan || 4}`}
                  style={{ 
                    gridColumnStart: (field.col || 0) + 1,
                    gridColumnEnd: `span ${field.colSpan || 4}`,
                    gridRowStart: (field.row || 0) + 1,
                    gridRowEnd: `span ${field.rowSpan || 1}`
                  }}
                >
                  {renderField(field.fieldId, field.labelOverride, field.typeOverride)}
                </div>
              ))}
            </div>
          </div>
        );
      }
    }

    // Format 2: VoucherTypeDefinition (canonical system) - fallback if no UI override
    if (definition.headerFields && definition.headerFields.length > 0) {
      return (
        <div className="bg-[var(--color-bg-primary)] px-4 py-3 border-b border-[var(--color-border)] mb-4 transition-colors">
          <div className="grid grid-cols-12 gap-x-4 gap-y-2">
            {definition.headerFields.map((field: any) => (
              <div key={field.id} className="col-span-6 md:col-span-4">
                {renderField(field.id, field.label)}
              </div>
            ))}
          </div>
        </div>
      );
    }
    
    return null;
  };

  // Render table if multi-line - supports both formats
  const renderLineItems = () => {
    const configDef = definition as any;
    
    // Check VoucherTypeDefinition format
    const hasTableColumns = definition.tableColumns && definition.tableColumns.length > 0;
    // Check VoucherFormConfig format
    const isMultiLine = configDef.isMultiLine || configDef.tableColumns;
    
    if (!hasTableColumns && !isMultiLine) {
      return null;
    }

    return (
       <div className="bg-[var(--color-bg-primary)] px-4 py-3 border-b border-[var(--color-border)] mb-4 transition-colors">
         <h3 className="text-xs font-bold text-[var(--color-text-muted)] mb-3 uppercase tracking-wider">Line Items</h3>
        {renderField('lineItems')}
      </div>
    );
  };

  // Render any section from uiModeOverrides (BODY, EXTRA, etc.)
  const renderSection = (sectionKey: string, title?: string) => {
    const configDef = definition as any;
    
    if (!configDef.uiModeOverrides || !configDef.uiModeOverrides[mode]) {
      return null;
    }
    
    const sections = configDef.uiModeOverrides[mode].sections;
    const section = sections?.[sectionKey];
    
    if (!section || !section.fields || section.fields.length === 0) {
      return null;
    }
    
    // Sort fields by row and col
    const sortedFields = [...section.fields].sort((a: any, b: any) => {
      if (a.row !== b.row) return a.row - b.row;
      return a.col - b.col;
    });
    
    return (
       <div className="bg-[var(--color-bg-primary)] px-4 py-3 border-b border-[var(--color-border)] mb-4 transition-colors">
         {title && <h3 className="text-xs font-bold text-[var(--color-text-muted)] mb-3 uppercase tracking-wider">{title}</h3>}
        <div className="grid grid-cols-12 gap-x-4 gap-y-2">
          {sortedFields.map((field: any) => (
            <div 
              key={field.fieldId}
              className={`col-span-${Math.min(12, field.colSpan || 4)}`}
              style={{ 
                gridColumnStart: (field.col || 0) + 1,
                gridColumnEnd: `span ${field.colSpan || 4}`,
                gridRowStart: (field.row || 0) + 1,
                gridRowEnd: `span ${field.rowSpan || 1}`
              }}
            >
              {renderField(field.fieldId, field.labelOverride, field.typeOverride)}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Check if BODY section has lineItems to avoid rendering twice
  const bodyHasLineItems = () => {
    const configDef = definition as any;
    if (!configDef.uiModeOverrides || !configDef.uiModeOverrides[mode]) return false;
    const bodySection = configDef.uiModeOverrides[mode]?.sections?.BODY;
    return bodySection?.fields?.some((f: any) => f.fieldId === 'lineItems');
  };

  // Render action buttons from config
  const renderActions = () => {
    const configDef = definition as any;
    // Try to get actions from ACTIONS section in uiModeOverrides (respects layout)
    let actionFields: any[] = [];
    if (configDef.uiModeOverrides && configDef.uiModeOverrides[mode]) {
      const actionsSection = configDef.uiModeOverrides[mode].sections?.ACTIONS;
      if (actionsSection?.fields && actionsSection.fields.length > 0) {
        // Sort by row and col
        actionFields = [...actionsSection.fields].sort((a: any, b: any) => {
          if (a.row !== b.row) return a.row - b.row;
          return a.col - b.col;
        });
      }
    }
    
    // Fallback to config.actions if no ACTIONS section
    if (actionFields.length === 0) {
      const actions = configDef.actions || [];
      const enabledActions = actions.filter((a: any) => a.enabled !== false);
      
      // If no custom actions defined, render default buttons
      if (!enabledActions.length) {
        return (
           <div className="bg-[var(--color-bg-primary)] border-t border-[var(--color-border)] p-3 grid grid-cols-2 gap-3 transition-colors">
             <button className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold shadow-md shadow-primary-500/10 transition-all bg-primary-600 text-white hover:bg-primary-700 active:scale-[0.98]">
               <Save size={16} />
               Save
             </button>
             <button className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold shadow-sm transition-all bg-[var(--color-bg-primary)] border border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] active:scale-[0.98]">
               <Printer size={16} />
               Print
             </button>
           </div>
        );
      }
      
      // Create action fields from config.actions
      actionFields = enabledActions.map((action: any, index: number) => ({
        fieldId: `action_${action.type}`,
        labelOverride: action.label,
        row: 0,
        col: index,
        colSpan: 4
      }));
    }
    
    // Render actions from ACTIONS section layout using CSS Grid
    const maxRow = actionFields.reduce((max, f) => Math.max(max, f.row || 0), 0) + 1;
    
    return (
       <div 
         className="bg-[var(--color-bg-secondary)] border-t border-[var(--color-border)] p-3 grid grid-cols-12 gap-3 transition-colors"
         style={{ gridTemplateRows: `repeat(${maxRow}, minmax(2.5rem, auto))` }}
       >
         {actionFields.map((field: any, index: number) => (
           <button 
             key={field.fieldId || index}
             className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold shadow-sm transition-all bg-[var(--color-bg-primary)] border border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] active:scale-[0.98]"
             style={{
               gridColumnStart: (field.col || 0) + 1,
               gridColumnEnd: `span ${field.colSpan || 4}`,
               gridRowStart: (field.row || 0) + 1
             }}
           >
             {field.labelOverride || field.fieldId}
           </button>
         ))}
       </div>
    );
  };

   return (
     <div className="flex flex-col h-full bg-[var(--color-bg-secondary)] font-sans text-[var(--color-text-primary)] overflow-y-auto custom-scroll transition-colors">
        {/* Header Fields from Canonical */}
        {renderHeaderFields()}
        
        {/* Body Section (if defined) - may include lineItems */}
        {renderSection('BODY')}
        
        {/* Line Items Table (if multi-line and not already in BODY) */}
        {!bodyHasLineItems() && renderLineItems()}
        
         {/* Extra Section (if defined) */}
        {renderSection('EXTRA', 'Additional Information')}

        {/* Action Buttons - from config or default */}
        {renderActions()}
    </div>
  );
}));

GenericVoucherRenderer.displayName = 'GenericVoucherRenderer';