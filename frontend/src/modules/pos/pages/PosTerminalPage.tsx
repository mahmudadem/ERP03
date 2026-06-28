/**
 * PosTerminalPage.tsx — Cashier checkout screen.
 *
 * Layout (modeled on Square / Loyverse / Shopify POS):
 *   ┌─ context bar: register · shift · cashier · last receipt ──────────────┐
 *   │  Products pane (search + scan + tile grid)  │  Order pane (cart,      │
 *   │                                              │  totals, customer, Pay) │
 *   └───────────────────────────────────────────────────────────────────────┘
 *
 * Backend stays authoritative: `previewSale` supplies the tax-inclusive quote,
 * `completeSale` posts the POS_DIRECT_SALE. The screen only collects intent.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import {
  posApi,
  PosCommandCode,
  PosControlButtonDTO,
  PosHeldCartDTO,
  PosProductShortcutNodeDTO,
  PosRegisterDTO,
  PosRuntimeLayoutDTO,
  PosShiftDTO,
  PosSettingsDTO,
} from '../../../api/posApi';
import { sharedApi, TaxCodeDTO } from '../../../api/sharedApi';
import { authApi } from '../../../api/auth';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { Modal } from '../../../components/ui/Modal';
import { ManagerOverrideCapture, ManagerOverrideValue } from '../components/ManagerOverrideCapture';
import { PartySelector } from '../../../components/shared/selectors/PartySelector';
import { UomSelector, UomSelectorHandle } from '../../../components/shared/selectors/UomSelector';
import { TaxCodeSelector } from '../../../components/shared/selectors/TaxCodeSelector';
import { errorHandler } from '../../../services/errorHandler';
import { useAuth } from '../../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Plus,
  Minus,
  Trash2,
  Receipt,
  AlertTriangle,
  ShoppingCart,
  CreditCard,
  Banknote,
  Landmark,
  Wallet,
  ScanLine,
  Archive,
  RotateCcw,
  RefreshCw,
  XCircle,
  Tag,
  Pencil,
  Maximize,
  Minimize,
  ChevronDown,
  ChevronUp,
  MonitorSmartphone,
  Keyboard,
} from 'lucide-react';

import { usePosKeyboardShortcuts } from '../hooks/usePosKeyboardShortcuts';
import { PosKeyboardShortcutsDialog } from '../components/PosKeyboardShortcutsDialog';
import { userPreferencesApi } from '../../../api/userPreferencesApi';

const unwrap = <T,>(p: any): T => (p?.data ?? p) as T;

interface CartLine {
  lineId: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  uom?: string;
  qty: number;
  unitPrice: number;
  originalUnitPrice?: number;
  discountType?: 'PERCENT' | 'AMOUNT';
  discountValue?: number;
  discountPercent?: number;
  lineDiscount: number;
  lineTotal: number;
  taxCodeId?: string;
  manualTaxAmount?: number;
  status: 'ACTIVE' | 'VOIDED';
  priceOverride?: boolean;
  taxOverride?: boolean;
  voidedBy?: string;
  voidedAt?: string;
  voidReason?: string;
  managerOverrideId?: string;
}

type PaymentMethod = 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'CUSTOM';

interface Payment {
  method: PaymentMethod;
  amount: number;
  reference?: string;
}

interface Props { isWindow?: boolean }

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;
const discountAmountFromPercent = (qty: number, unitPrice: number, percent?: number): number =>
  round2(Math.max(0, qty * unitPrice) * Math.max(0, Number(percent) || 0) / 100);
const discountPercentFromAmount = (qty: number, unitPrice: number, amount?: number): number => {
  const gross = Math.max(0, qty * unitPrice);
  return gross > 0 ? round2((Math.max(0, Number(amount) || 0) / gross) * 100) : 0;
};
const money = (n: number): string =>
  (Number.isFinite(n) ? n : 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const makeLineId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `line_${Date.now()}_${Math.random().toString(36).slice(2)}`;
const SCANNER_MIN_CHARS = 4;
const SCANNER_MAX_KEY_INTERVAL_MS = 45;
const SCANNER_IDLE_RESET_MS = 120;
const SCANNER_MAX_TOTAL_MS = 1200;

type AddFeedbackSource = 'manual' | 'barcode';

const recalculateLine = (line: CartLine): CartLine => {
  const gross = round2(line.qty * line.unitPrice);
  const lineDiscount = line.discountType === 'PERCENT'
    ? discountAmountFromPercent(line.qty, line.unitPrice, line.discountPercent ?? line.discountValue)
    : Math.min(Math.max(0, round2(line.lineDiscount || line.discountValue || 0)), gross);
  const discountPercent = discountPercentFromAmount(line.qty, line.unitPrice, lineDiscount);
  return {
    ...line,
    lineDiscount,
    discountPercent,
    discountValue: lineDiscount > 0
      ? line.discountType === 'PERCENT'
        ? discountPercent
        : lineDiscount
      : undefined,
    discountType: lineDiscount > 0 ? (line.discountType || 'AMOUNT') : undefined,
    lineTotal: round2(gross - lineDiscount),
  };
};

const METHOD_META: Record<PaymentMethod, { label: string; Icon: typeof Banknote }> = {
  CASH: { label: 'Cash', Icon: Banknote },
  CARD: { label: 'Card', Icon: CreditCard },
  BANK_TRANSFER: { label: 'Bank', Icon: Landmark },
  CUSTOM: { label: 'Other', Icon: Wallet },
};

const initialsOf = (name: string): string =>
  (name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('') || '?';

const PosTerminalPage: React.FC<Props> = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user?.uid || '';

  const [bootstrap, setBootstrap] = useState<{ register: PosRegisterDTO | null; openShift: PosShiftDTO | null; settings: PosSettingsDTO | null } | null>(null);
  const [userPreferences, setUserPreferences] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [customerId, setCustomerId] = useState<string | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [showPayDialog, setShowPayDialog] = useState(false);
  const [lastReceipt, setLastReceipt] = useState<any | null>(null);
  const [voidTarget, setVoidTarget] = useState<{ lineId?: string; all?: boolean } | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [voidManagerOverride, setVoidManagerOverride] = useState<ManagerOverrideValue | null>(null);
  const [showVoidManagerOverride, setShowVoidManagerOverride] = useState(false);
  const [saleManagerOverride, setSaleManagerOverride] = useState<ManagerOverrideValue | null>(null);
  const [showSaleManagerOverride, setShowSaleManagerOverride] = useState(false);
  const [heldCarts, setHeldCarts] = useState<PosHeldCartDTO[]>([]);
  const [isTotalsExpanded, setIsTotalsExpanded] = useState(false);
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [cashierRoleId, setCashierRoleId] = useState<string | undefined>(undefined);
  const [heldLoading, setHeldLoading] = useState(false);
  const [holdingCart, setHoldingCart] = useState(false);
  const [showHeldCarts, setShowHeldCarts] = useState(false);
  const [runtimeLayout, setRuntimeLayout] = useState<PosRuntimeLayoutDTO | null>(null);
  const [shortcutPath, setShortcutPath] = useState<PosProductShortcutNodeDTO[]>([]);
  const [showShortcutsDialog, setShowShortcutsDialog] = useState(false);
  const [saleNotes, setSaleNotes] = useState('');

  const uomRefs = useRef<Record<string, UomSelectorHandle>>({});

  const [numberEditModal, setNumberEditModal] = useState<{
    lineId: string;
    field: 'qty' | 'unitPrice' | 'manualTaxAmount' | 'discountPercent' | 'lineDiscount';
    value: string;
    title: string;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        if (containerRef.current?.requestFullscreen) {
          await containerRef.current.requestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        }
      }
    } catch (err) {
      console.error('Failed to toggle fullscreen', err);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);


  // Tender form (React state — no more getElementById)
  const [tenderMethod, setTenderMethod] = useState<PaymentMethod>('CASH');
  const [tenderAmount, setTenderAmount] = useState<string>('');
  const [tenderRef, setTenderRef] = useState<string>('');

  const searchRef = useRef<HTMLInputElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const focusSearchInput = useCallback(() => {
    window.setTimeout(() => searchRef.current?.focus(), 0);
  }, []);

  const playAddFeedback = useCallback((source: AddFeedbackSource) => {
    try {
      const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextCtor) return;
      const ctx = audioContextRef.current || new AudioContextCtor();
      audioContextRef.current = ctx;
      if (ctx.state === 'suspended') void ctx.resume();

      const now = ctx.currentTime;
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = source === 'barcode' ? 'square' : 'sine';
      oscillator.frequency.setValueAtTime(source === 'barcode' ? 1120 : 760, now);
      if (source === 'barcode') {
        oscillator.frequency.setValueAtTime(880, now + 0.055);
      }
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(source === 'barcode' ? 0.055 : 0.035, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + (source === 'barcode' ? 0.11 : 0.08));
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(now);
      oscillator.stop(now + (source === 'barcode' ? 0.12 : 0.09));
    } catch {
      // Audio feedback is best-effort; the cart update remains authoritative.
    }
  }, []);

  const { activeShortcuts } = usePosKeyboardShortcuts({
    register: bootstrap?.register || null,
    userPreferences,
    onAction: (action) => {
      switch (action) {
        case 'SEARCH_ITEMS':
          searchRef.current?.focus();
          break;
        case 'CHECKOUT':
          if (cart.length > 0) setShowPayDialog(true);
          break;
        case 'VOID_SALE':
          if (cart.length > 0) setVoidTarget({ all: true });
          break;
        case 'HOLD_CART':
          // Hold Cart uses a form submit or API call, we can trigger the button
          const holdBtn = document.getElementById('btn-hold-cart');
          if (holdBtn) holdBtn.click();
          break;
        case 'ADD_CUSTOM_ITEM':
          toast(t('pos:shortcuts.customItemNotImplemented', { defaultValue: 'Custom item shortcut not yet implemented' }), { icon: 'ℹ️' });
          break;
        case 'APPLY_DISCOUNT':
          if (cart.length > 0) {
            setNumberEditModal({ lineId: cart[0].lineId, field: 'lineDiscount', value: String(cart[0].lineDiscount), title: t('pos:terminal.editDiscountAmount') });
          }
          break;
        case 'CASH_PAYMENT':
          if (cart.length > 0) {
            setTenderMethod('CASH');
            setShowPayDialog(true);
          }
          break;
        case 'CARD_PAYMENT':
          if (cart.length > 0) {
            setTenderMethod('CARD');
            setShowPayDialog(true);
          }
          break;
      }
    },
    disabled: showPayDialog || Boolean(numberEditModal) || showVoidManagerOverride || showSaleManagerOverride || showShortcutsDialog || showHeldCarts,
  });

  // Sales-scoped tax codes for the line-edit tax selector (same source the Sales Invoice uses).
  const [taxCodes, setTaxCodes] = useState<TaxCodeDTO[]>([]);
  const salesTaxCodeOptions = useMemo(
    () =>
      taxCodes
        .filter((tc) => tc.scope === 'SALES' || tc.scope === 'BOTH')
        .map((tc) => ({ id: tc.id, code: tc.code, name: tc.name, rate: tc.rate })),
    [taxCodes]
  );
  useEffect(() => {
    sharedApi
      .listTaxCodes({ active: true })
      .then((list) => setTaxCodes(Array.isArray(list) ? list : []))
      .catch(() => setTaxCodes([]));
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [result, permissions, prefsResult] = await Promise.all([
          posApi.getBootstrap({ cashierUserId: userId }),
          authApi.getMyPermissions().catch(() => null),
          import('../../../api/userPreferencesApi').then(m => m.userPreferencesApi.get()).catch(() => null)
        ]);
        const data = unwrap<any>(result);
        setBootstrap(data);
        setUserPreferences(prefsResult);
        setCashierRoleId(permissions?.roleId || undefined);
        if (data?.settings?.walkInCustomerId) setCustomerId(data.settings.walkInCustomerId);
      } catch (err) {
        console.error('Bootstrap failed', err);
        toast.error(t('pos:terminal.bootstrapError', { defaultValue: 'Failed to load POS data.' }));
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [userId]);

  useEffect(() => {
    if (!bootstrap?.register || !bootstrap.openShift) return;
    void loadHeldCarts();
  }, [bootstrap?.register?.id, bootstrap?.openShift?.id]);

  useEffect(() => {
    if (!bootstrap?.register) {
      setRuntimeLayout(null);
      setShortcutPath([]);
      return;
    }
    let cancelled = false;
    const loadRuntimeLayout = async () => {
      try {
        const data = await posApi.getRuntimeLayout({
          branchId: bootstrap.register?.branchId,
          registerId: bootstrap.register?.id,
        });
        if (!cancelled) {
          setRuntimeLayout(data);
          setShortcutPath([]);
        }
      } catch (err) {
        console.error('Failed to load POS runtime layout', err);
        if (!cancelled) setRuntimeLayout(null);
      }
    };
    void loadRuntimeLayout();
    return () => {
      cancelled = true;
    };
  }, [bootstrap?.register?.branchId, bootstrap?.register?.id]);

  const onAddToCart = useCallback((item: any, source: AddFeedbackSource = 'manual'): boolean => {
    const unitPrice = Number(item.salePrice || 0);
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      toast.error(t('pos:terminal.priceRequired', { defaultValue: 'Set a sale price for this item before selling it in POS.' }));
      focusSearchInput();
      return false;
    }
    setCart((prev) => {
      const existing = prev.find((l) => l.itemId === item.id && l.status !== 'VOIDED');
      if (existing) {
        return prev.map((l) =>
          l.lineId === existing.lineId
            ? recalculateLine({ ...l, qty: l.qty + 1 })
            : l
        );
      }
      return [
        ...prev,
        {
          lineId: makeLineId(),
          itemId: item.id,
          itemCode: item.code || '',
          itemName: item.name || '',
          uom: item.uom || item.unitOfMeasure || '',
          qty: 1,
          unitPrice,
          originalUnitPrice: unitPrice,
          discountPercent: 0,
          lineDiscount: 0,
          lineTotal: round2(unitPrice),
          taxCodeId: item.defaultSalesTaxCodeId,
          status: 'ACTIVE',
        },
      ];
    });
    playAddFeedback(source);
    setSearchQuery('');
    focusSearchInput();
    return true;
  }, [focusSearchInput, playAddFeedback, t]);

  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults([]);
      return;
    }
    const handle = setTimeout(async () => {
      try {
        setSearching(true);
        const result = await posApi.searchProducts(q, 25);
        setSearchResults(unwrap<{ items: any[] }>(result)?.items || []);
      } catch (err) {
        console.error('Search failed', err);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [searchQuery]);

  const handleBarcodeScan = useCallback(async (rawCode: string) => {
    const code = rawCode.trim();
    if (!code) return;
    try {
      const result = await posApi.searchProducts(code, 10);
      const items = unwrap<{ items: any[] }>(result)?.items || [];
      const normalized = code.toLowerCase();
      const exactMatches = items.filter((item) =>
        String(item.barcode || '').toLowerCase() === normalized ||
        String(item.code || '').toLowerCase() === normalized
      );
      const matches = exactMatches.length > 0 ? exactMatches : items.length === 1 ? items : [];

      if (matches.length === 1) {
        onAddToCart(matches[0], 'barcode');
        return;
      }
      if (matches.length > 1) {
        toast.error(t('pos:terminal.barcodeMultipleMatches', { defaultValue: 'Barcode matches more than one product. Use product search.' }));
        setSearchQuery(code);
      } else {
        toast.error(t('pos:terminal.barcodeNotFound', { defaultValue: 'Barcode not found.' }));
        setSearchQuery('');
      }
      focusSearchInput();
    } catch (err: any) {
      errorHandler.showError(err?.response?.data?.error?.message || err?.message || t('pos:terminal.barcodeLookupFailed', { defaultValue: 'Failed to read barcode.' }));
      focusSearchInput();
    }
  }, [focusSearchInput, onAddToCart, t]);

  useEffect(() => {
    const scanBlocked =
      showPayDialog ||
      Boolean(numberEditModal) ||
      Boolean(voidTarget) ||
      Boolean(editingLineId) ||
      showVoidManagerOverride ||
      showSaleManagerOverride ||
      showShortcutsDialog ||
      showHeldCarts;
    if (scanBlocked) return;

    let buffer = '';
    let startedAt = 0;
    let lastKeyAt = 0;
    let maxInterval = 0;
    let idleTimer: number | undefined;

    const reset = () => {
      buffer = '';
      startedAt = 0;
      lastKeyAt = 0;
      maxInterval = 0;
      if (idleTimer) {
        window.clearTimeout(idleTimer);
        idleTimer = undefined;
      }
    };

    const scheduleIdleReset = () => {
      if (idleTimer) window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(reset, SCANNER_IDLE_RESET_MS);
    };

    const isScannerCandidate = (now: number) =>
      buffer.length >= SCANNER_MIN_CHARS &&
      startedAt > 0 &&
      now - startedAt <= SCANNER_MAX_TOTAL_MS &&
      maxInterval <= SCANNER_MAX_KEY_INTERVAL_MS;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.altKey || event.metaKey) {
        reset();
        return;
      }

      if (event.key === 'Enter' || event.key === 'Tab') {
        const now = performance.now();
        if (isScannerCandidate(now)) {
          event.preventDefault();
          event.stopPropagation();
          const scanned = buffer;
          reset();
          void handleBarcodeScan(scanned);
          return;
        }
        reset();
        return;
      }

      if (event.key.length !== 1) {
        reset();
        return;
      }

      const now = performance.now();
      if (!startedAt || now - lastKeyAt > SCANNER_IDLE_RESET_MS) {
        buffer = event.key;
        startedAt = now;
        maxInterval = 0;
      } else {
        const interval = now - lastKeyAt;
        maxInterval = Math.max(maxInterval, interval);
        buffer += event.key;
      }
      lastKeyAt = now;
      scheduleIdleReset();
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      reset();
    };
  }, [
    editingLineId,
    handleBarcodeScan,
    numberEditModal,
    showHeldCarts,
    showPayDialog,
    showSaleManagerOverride,
    showShortcutsDialog,
    showVoidManagerOverride,
    voidTarget,
  ]);

  const activeCart = useMemo(() => cart.filter((l) => l.status !== 'VOIDED'), [cart]);
  const subtotal = useMemo(() => activeCart.reduce((s, l) => s + l.qty * l.unitPrice, 0), [activeCart]);
  const discountTotal = useMemo(() => activeCart.reduce((s, l) => s + l.lineDiscount, 0), [activeCart]);
  const itemCount = useMemo(() => activeCart.reduce((s, l) => s + l.qty, 0), [activeCart]);

  // Tax-inclusive total comes from the backend quote (same calc the SI uses). While the
  // quote loads we fall back to a tax-exclusive estimate; the backend stays authoritative.
  const [quote, setQuote] = useState<{ subtotal: number; taxTotal: number; grandTotal: number; lines: Array<{ itemId: string; taxAmount: number; taxCodeId?: string; taxCodeName?: string; taxRate?: number }> } | null>(null);
  useEffect(() => {
    if (activeCart.length === 0) { setQuote(null); return; }
    const handle = setTimeout(async () => {
      try {
        const q = await posApi.previewSale(activeCart.map((l) => ({
          itemId: l.itemId,
          qty: l.qty,
          unitPrice: l.unitPrice,
          discountType: l.discountType,
          discountValue: l.discountValue,
          taxCodeId: l.taxCodeId,
          manualTaxAmount: l.manualTaxAmount,
        })));
        setQuote(q);
      } catch (err) {
        console.error('Preview failed', err);
        setQuote(null);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [activeCart]);

  const taxTotal = quote?.taxTotal ?? 0;
  const grandTotal = quote?.grandTotal ?? Math.max(0, subtotal - discountTotal);
  const stagedPayment = useMemo<Payment | null>(() => {
    if (!showPayDialog) return null;
    const amount = round2(Number(tenderAmount) || 0);
    if (amount <= 0) return null;
    return { method: tenderMethod, amount, reference: tenderRef || undefined };
  }, [showPayDialog, tenderAmount, tenderMethod, tenderRef]);
  const salePayments = useMemo<Payment[]>(
    () => (stagedPayment ? [...payments, stagedPayment] : payments),
    [payments, stagedPayment]
  );
  const tenderedCash = useMemo(() => salePayments.filter((p) => p.method === 'CASH').reduce((s, p) => s + p.amount, 0), [salePayments]);
  const tenderedTotal = useMemo(() => salePayments.reduce((s, p) => s + p.amount, 0), [salePayments]);
  const change = Math.max(0, tenderedCash - grandTotal);
  const paid = tenderedTotal - change;
  const balanceDue = round2(Math.max(0, grandTotal - paid));
  const editingLine = useMemo(() => cart.find((line) => line.lineId === editingLineId && line.status !== 'VOIDED') || null, [cart, editingLineId]);
  const editingLineActiveIndex = editingLine ? activeCart.findIndex((line) => line.lineId === editingLine.lineId) : -1;
  const editingQuoteLine = editingLineActiveIndex >= 0 ? quote?.lines?.[editingLineActiveIndex] : undefined;
  const editingTaxName = editingQuoteLine?.taxCodeName || t('pos:terminal.noTaxCode', { defaultValue: 'No tax' });
  const editingTaxAmount = editingLine
    ? editingLine.taxOverride
      ? (editingLine.manualTaxAmount ?? editingQuoteLine?.taxAmount ?? 0)
      : (editingQuoteLine?.taxAmount ?? 0)
    : 0;

  const enabledMethods = useMemo<PaymentMethod[]>(() => {
    const enabled = (bootstrap?.settings?.paymentMethods || [])
      .filter((m) => m.isEnabled)
      .map((m) => m.code as PaymentMethod);
    return enabled.length ? enabled : ['CASH'];
  }, [bootstrap?.settings]);

  const currentShortcutNodes = useMemo(() => {
    let nodes = runtimeLayout?.productShortcutTree || [];
    for (const group of shortcutPath) {
      const next = nodes.find((node) => node.id === group.id);
      nodes = next?.children || [];
    }
    return nodes;
  }, [runtimeLayout?.productShortcutTree, shortcutPath]);

  const topControlButtons = useMemo(
    () => (runtimeLayout?.controlButtonsByZone?.TOP_BAR || []).slice(0, 5),
    [runtimeLayout?.controlButtonsByZone]
  );
  const bottomControlButtons = useMemo(
    () => runtimeLayout?.controlButtonsByZone?.BOTTOM_BAR || [],
    [runtimeLayout?.controlButtonsByZone]
  );

  const onShortcutClick = (node: PosProductShortcutNodeDTO) => {
    if (node.nodeType === 'GROUP') {
      setShortcutPath((prev) => [...prev, node]);
      return;
    }
    if (!node.item) {
      toast.error(t('pos:terminal.shortcutItemMissing', { defaultValue: 'Shortcut item is unavailable.' }));
      return;
    }
    const added = onAddToCart({
      ...node.item,
      uom: node.unitId || node.item.uom || node.item.unitOfMeasure,
    }, 'manual');
    if (added && node.predefinedQty && node.predefinedQty > 1) {
      setCart((prev) =>
        prev.map((line) =>
          line.itemId === node.item?.id && line.status !== 'VOIDED'
            ? recalculateLine({ ...line, qty: Math.max(line.qty, Number(node.predefinedQty) || line.qty) })
            : line
        )
      );
    }
  };

  const executeControlButton = async (button: PosControlButtonDTO) => {
    const commandCode = button.commandCode as PosCommandCode;
    try {
      const result = await posApi.executeCommand({
        commandCode,
        context: {
          registerId: bootstrap?.register?.id,
          branchId: bootstrap?.register?.branchId,
          shiftId: bootstrap?.openShift?.id,
          receiptId: lastReceipt?.receipt?.id,
          hasActiveCart: activeCart.length > 0,
          customerId,
        },
      });
      if (result?.status === 'REJECTED') {
        toast.error(result.message || button.label);
        return;
      }
    } catch (err: any) {
      errorHandler.showError(err?.response?.data?.error?.message || err?.message || 'POS command failed.');
      return;
    }

    switch (commandCode) {
      case 'HOLD_SALE':
        await onHoldCart();
        break;
      case 'RECALL_SALE':
        await openHeldCarts();
        break;
      case 'CLEAR_CART':
      case 'VOID_TICKET':
        onClearSale();
        break;
      case 'CASH_PAYMENT':
        setTenderMethod('CASH');
        openPayDialog();
        break;
      case 'CARD_PAYMENT':
        setTenderMethod('CARD');
        openPayDialog();
        break;
      case 'SPLIT_PAYMENT':
        openPayDialog();
        break;
      case 'RETURN_REFUND':
        navigate('/pos/returns');
        break;
      case 'END_SHIFT':
        navigate('/pos/shift');
        break;
      default:
        toast(t('pos:terminal.commandReady', { defaultValue: 'Command is ready.' }));
        break;
    }
  };

  const onUpdateQty = (lineId: string, qty: number) => {
    if (qty <= 0) { beginVoidLine(lineId); return; }
    setCart((prev) =>
      prev.map((l) =>
        l.lineId === lineId && l.status !== 'VOIDED'
          ? recalculateLine({ ...l, qty })
          : l
      )
    );
  };

  const onUpdateUnitPrice = (lineId: string, unitPrice: number) => {
    const nextPrice = Math.max(0.01, round2(unitPrice || 0));
    setCart((prev) =>
      prev.map((l) => {
        if (l.lineId !== lineId || l.status === 'VOIDED') return l;
        return recalculateLine({
          ...l,
          unitPrice: nextPrice,
          priceOverride: Math.abs(nextPrice - (l.originalUnitPrice ?? nextPrice)) > 0.005,
        });
      })
    );
  };

  const onUpdateLineDiscount = (lineId: string, discountAmount: number) => {
    setCart((prev) =>
      prev.map((l) => {
        if (l.lineId !== lineId || l.status === 'VOIDED') return l;
        const maxDiscount = round2(l.qty * l.unitPrice);
        const lineDiscount = Math.min(Math.max(0, round2(discountAmount || 0)), maxDiscount);
        return recalculateLine({
          ...l,
          discountType: lineDiscount > 0 ? 'AMOUNT' : undefined,
          lineDiscount,
          discountValue: lineDiscount,
        });
      })
    );
  };

  const onUpdateDiscountPercent = (lineId: string, percent: number) => {
    setCart((prev) =>
      prev.map((l) =>
        l.lineId === lineId && l.status !== 'VOIDED'
          ? recalculateLine({ ...l, discountType: percent > 0 ? 'PERCENT' : undefined, discountPercent: Math.max(0, round2(percent || 0)), discountValue: Math.max(0, round2(percent || 0)) })
          : l
      )
    );
  };

  const onUpdateManualTax = (lineId: string, taxAmount: number) => {
    setCart((prev) =>
      prev.map((l) =>
        l.lineId === lineId && l.status !== 'VOIDED'
          ? { ...l, manualTaxAmount: Math.max(0, round2(taxAmount || 0)), taxOverride: true }
          : l
      )
    );
  };

  const onUpdateUom = (lineId: string, uom: string) => {
    setCart((prev) =>
      prev.map((l) =>
        l.lineId === lineId && l.status !== 'VOIDED'
          ? { ...l, uom }
          : l
      )
    );
  };

  const onUpdateTaxCode = (lineId: string, taxCodeId: string) => {
    setCart((prev) =>
      prev.map((l) =>
        l.lineId === lineId && l.status !== 'VOIDED'
          ? { ...l, taxCodeId }
          : l
      )
    );
  };

  const beginVoidLine = (lineId: string) => {
    setVoidTarget({ lineId });
    setVoidReason('');
    setVoidManagerOverride(null);
  };

  const onClearSale = () => {
    if (activeCart.length === 0) {
      setCart([]);
      setPayments([]);
      setSearchQuery('');
      searchRef.current?.focus();
      return;
    }
    setVoidTarget({ all: true });
    setVoidReason('');
    setVoidManagerOverride(null);
  };

  const confirmVoid = () => {
    const reason = voidReason.trim();
    if (!voidTarget || !reason) {
      toast.error(t('pos:terminal.voidReasonRequired', { defaultValue: 'Enter a reason before voiding the line.' }));
      return;
    }
    const voidedAt = new Date().toISOString();
    setCart((prev) =>
      prev.map((l) => {
        const shouldVoid = voidTarget.all ? l.status !== 'VOIDED' : l.lineId === voidTarget.lineId;
        return shouldVoid
          ? { ...l, status: 'VOIDED', voidedBy: userId, voidedAt, voidReason: reason, managerOverrideId: voidManagerOverride?.managerOverrideId || l.managerOverrideId }
          : l;
      })
    );
    setPayments([]);
    setVoidTarget(null);
    setVoidReason('');
    setVoidManagerOverride(null);
    toast.success(t('pos:terminal.lineVoided', { defaultValue: 'Line voided.' }));
    searchRef.current?.focus();
  };

  const onAddPayment = (p: Payment) => setPayments((prev) => [...prev, p]);
  const onRemovePayment = (idx: number) => setPayments((prev) => prev.filter((_, i) => i !== idx));

  const loadHeldCarts = async () => {
    const register = bootstrap?.register;
    const shift = bootstrap?.openShift;
    if (!register || !shift) return;
    try {
      setHeldLoading(true);
      const list = await posApi.listHeldCarts({
        registerId: register.id,
        shiftId: shift.id,
        status: 'HELD',
        limit: 25,
      });
      setHeldCarts(list);
    } catch (err: any) {
      errorHandler.showError(err?.response?.data?.error?.message || err?.message || 'Failed to load held carts.');
    } finally {
      setHeldLoading(false);
    }
  };

  const openHeldCarts = async () => {
    setShowHeldCarts(true);
    await loadHeldCarts();
  };

  const onHoldCart = async () => {
    const register = bootstrap?.register;
    const shift = bootstrap?.openShift;
    if (!register || !shift) {
      toast.error(t('pos:terminal.needOpenShift', { defaultValue: 'No open shift for this register.' }));
      return;
    }
    if (activeCart.length === 0) {
      toast.error(t('pos:terminal.noActiveLines', { defaultValue: 'Add at least one active line before holding the sale.' }));
      return;
    }
    try {
      setHoldingCart(true);
      await posApi.holdCart({
        registerId: register.id,
        shiftId: shift.id,
        cashierUserId: userId,
        customerId,
        lines: activeCart.map((l) => ({
          lineId: l.lineId,
          itemId: l.itemId,
          itemCode: l.itemCode,
          itemName: l.itemName,
          uom: l.uom,
          qty: l.qty,
          unitPrice: l.unitPrice,
          lineDiscount: l.lineDiscount,
          discountType: l.discountType,
          discountValue: l.discountValue,
          taxCodeId: l.taxCodeId,
          manualTaxAmount: l.manualTaxAmount,
          lineTotal: l.lineTotal,
          priceOverride: l.priceOverride,
          taxOverride: l.taxOverride,
          managerOverrideId: l.managerOverrideId,
        })),
        subtotal,
        discountTotal,
        taxTotal,
        grandTotal,
      });
      setCart([]);
      setPayments([]);
      setSearchQuery('');
      toast.success(t('pos:terminal.held', { defaultValue: 'Sale held.' }));
      await loadHeldCarts();
      searchRef.current?.focus();
    } catch (err: any) {
      errorHandler.showError(err?.response?.data?.error?.message || err?.message || 'Failed to hold sale.');
    } finally {
      setHoldingCart(false);
    }
  };

  const onRecallHeldCart = async (held: PosHeldCartDTO) => {
    if (activeCart.length > 0) {
      toast.error(t('pos:terminal.recallNeedsEmptyCart', { defaultValue: 'Complete, hold, or void the current sale before recalling another one.' }));
      return;
    }
    try {
      const recalled = await posApi.recallHeldCart(held.id);
      setCart(recalled.lines.map((line) => ({
        lineId: line.lineId || makeLineId(),
        itemId: line.itemId,
        itemCode: line.itemCode || '',
        itemName: line.itemName || '',
        uom: line.uom || '',
        qty: Number(line.qty) || 0,
        unitPrice: Number(line.unitPrice) || 0,
        lineDiscount: Number(line.lineDiscount) || 0,
        lineTotal: Number(line.lineTotal) || round2((Number(line.qty) || 0) * (Number(line.unitPrice) || 0) - (Number(line.lineDiscount) || 0)),
        status: 'ACTIVE',
        managerOverrideId: line.managerOverrideId,
        priceOverride: line.priceOverride,
        taxOverride: line.taxOverride,
        taxCodeId: line.taxCodeId,
        manualTaxAmount: Number((line as any).manualTaxAmount) || undefined,
        discountType: line.discountType === 'PERCENT' ? 'AMOUNT' : line.discountType,
        discountValue: Number(line.discountValue) || Number(line.lineDiscount) || undefined,
      })));
      setCustomerId(recalled.customerId || settings?.walkInCustomerId);
      setPayments([]);
      toast.success(t('pos:terminal.recalled', { defaultValue: 'Held sale recalled.' }));
      await loadHeldCarts();
      setShowHeldCarts(false);
    } catch (err: any) {
      errorHandler.showError(err?.response?.data?.error?.message || err?.message || 'Failed to recall held sale.');
    }
  };

  const onCancelHeldCart = async (held: PosHeldCartDTO) => {
    try {
      await posApi.cancelHeldCart(held.id, { reason: 'Cancelled from POS terminal' });
      toast.success(t('pos:terminal.heldCancelled', { defaultValue: 'Held sale cancelled.' }));
      await loadHeldCarts();
    } catch (err: any) {
      errorHandler.showError(err?.response?.data?.error?.message || err?.message || 'Failed to cancel held sale.');
    }
  };

  // Scan flow: pressing Enter adds the top match and clears the box for the next scan.
  const onSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchResults.length > 0) {
      e.preventDefault();
      onAddToCart(searchResults[0], 'manual');
      setSearchQuery('');
      focusSearchInput();
    }
  };

  const openPayDialog = () => {
    if (activeCart.length === 0) return;
    setTenderMethod(enabledMethods[0]);
    setTenderAmount(balanceDue ? String(balanceDue) : String(round2(grandTotal)));
    setTenderRef('');
    setShowPayDialog(true);
  };

  const addTender = () => {
    const amt = round2(Number(tenderAmount) || 0);
    if (amt <= 0) {
      toast.error(t('pos:terminal.tenderNeedAmount', { defaultValue: 'Pick a method and amount.' }));
      return;
    }
    onAddPayment({ method: tenderMethod, amount: amt, reference: tenderRef || undefined });
    setTenderAmount('');
    setTenderRef('');
  };

  const applySaleManagerOverride = (override: ManagerOverrideValue) => {
    setSaleManagerOverride(override);
    setCart((prev) =>
      prev.map((line) =>
        line.status !== 'VOIDED' && !line.managerOverrideId
          ? { ...line, managerOverrideId: override.managerOverrideId }
          : line
      )
    );
    setShowSaleManagerOverride(false);
  };

  const onCompleteSale = async (creditSaleFlag: boolean = false) => {
    const register = bootstrap?.register;
    const shift = bootstrap?.openShift;
    if (!register || !shift) {
      toast.error(t('pos:terminal.needOpenShift', { defaultValue: 'No open shift for this register.' }));
      return;
    }
    if (activeCart.length === 0) {
      toast.error(t('pos:terminal.noActiveLines', { defaultValue: 'Add at least one active line before taking payment.' }));
      return;
    }
    if (!creditSaleFlag && Math.abs(paid - grandTotal) > 0.005) {
      toast.error(t('pos:terminal.tenderMismatch', { defaultValue: 'Tendered total does not match grand total.' }));
      return;
    }
    if (creditSaleFlag && !customerId) {
      toast.error(t('pos:terminal.needCustomerForCredit', { defaultValue: 'Credit sale requires a selected customer.' }));
      return;
    }
    if (creditSaleFlag && settings?.creditSaleManagerOverride && !saleManagerOverride) {
      toast.error(t('pos:terminal.creditSaleNeedsApproval', { defaultValue: 'Manager approval is required for deferred payment.' }));
      setShowSaleManagerOverride(true);
      return;
    }
    try {
      setCompleting(true);
      const result = await posApi.completeSale({
        registerId: register.id,
        shiftId: shift.id,
        customerId,
        cashierRoleId,
        lines: cart.map((l) => ({
          itemId: l.itemId,
          itemCode: l.itemCode,
          itemName: l.itemName,
          uom: l.uom,
          qty: l.qty,
          unitPrice: l.unitPrice,
          discountType: l.discountType,
          discountValue: l.discountValue,
          lineDiscount: l.lineDiscount,
          taxCodeId: l.taxCodeId,
          manualTaxAmount: l.manualTaxAmount,
          priceOverride: l.priceOverride,
          taxOverride: l.taxOverride,
          status: l.status,
          voidedBy: l.voidedBy,
          voidedAt: l.voidedAt,
          voidReason: l.voidReason,
          managerOverrideId: l.managerOverrideId,
        })),
        payments: salePayments,
        notes: saleNotes,
        isCreditSale: creditSaleFlag,
        managerOverrideId: creditSaleFlag ? saleManagerOverride?.managerOverrideId : undefined,
      });
      const data = unwrap<any>(result);
      setLastReceipt(data);
      toast.success(t('pos:terminal.completed', { defaultValue: 'Sale completed.' }));
      setCart([]);
      setPayments([]);
      setSaleManagerOverride(null);
      setSearchQuery('');
      setSaleNotes('');
      searchRef.current?.focus();
    } catch (err: any) {
      errorHandler.showError(err?.response?.data?.error?.message || err?.message || 'Failed to complete sale.');
    } finally {
      setCompleting(false);
      setShowPayDialog(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50 dark:bg-[var(--color-bg-primary)]">
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-[var(--color-text-secondary)]">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600" />
          {t('common.loading', { defaultValue: 'Loading…' })}
        </div>
      </div>
    );
  }

  const register = bootstrap?.register;
  const shift = bootstrap?.openShift;
  const settings = bootstrap?.settings;

  if (!register || !shift) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50 p-6 dark:bg-[var(--color-bg-primary)]">
        <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-[var(--color-border)] dark:bg-[var(--color-bg-secondary)]">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-500/15">
            <AlertTriangle className="h-6 w-6 text-amber-500" />
          </div>
          <p className="text-sm font-medium text-slate-700 dark:text-[var(--color-text-primary)]">
            {t('pos:terminal.needOpenShift', { defaultValue: 'No open shift for this register.' })}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-[var(--color-text-secondary)]">
            {t('pos:terminal.needOpenShiftHelp', { defaultValue: 'Open a shift to start taking sales on this till.' })}
          </p>
          <button
            onClick={() => navigate('/pos/shift')}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 cursor-pointer"
          >
            {t('pos:terminal.openShiftCta', { defaultValue: 'Open a shift' })}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex h-[calc(100vh-64px)] min-h-0 flex-col overflow-hidden bg-slate-50 dark:bg-[var(--color-bg-primary)]">
      {/* Context bar */}
      <header className="flex flex-none shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-2.5 dark:border-[var(--color-border)] dark:bg-[var(--color-bg-secondary)]">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white">
            <MonitorSmartphone className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold text-slate-900 dark:text-[var(--color-text-primary)]">
              {register.name}
              <span className="ml-1.5 font-mono text-xs font-normal text-slate-400">{register.code}</span>
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500 dark:text-[var(--color-text-secondary)]">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                {t('pos:terminal.shiftOpen', { defaultValue: 'Shift open' })}
              </span>
              <span className="text-slate-300 dark:text-[var(--color-border)]">·</span>
              <span className="truncate">{user?.email || userId}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {lastReceipt && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs dark:border-emerald-500/30 dark:bg-emerald-500/10">
              <Receipt className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              <span className="font-medium text-emerald-700 dark:text-emerald-300">
                {lastReceipt.receipt?.receiptNumber || lastReceipt.salesInvoiceNumber}
              </span>
              <span className="text-emerald-600/80 dark:text-emerald-400/80">
                {t('pos:terminal.change', { defaultValue: 'Change' })} {money(Number(lastReceipt.change || 0))}
              </span>
            </div>
          )}
          <button
            onClick={onHoldCart}
            disabled={activeCart.length === 0 || holdingCart}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-[var(--color-border)] dark:text-[var(--color-text-secondary)] dark:hover:bg-[var(--color-bg-tertiary)] cursor-pointer"
          >
            <Archive className="h-3.5 w-3.5" />
            {holdingCart
              ? t('common.processing', { defaultValue: 'Processing…' })
              : t('pos:terminal.hold', { defaultValue: 'Hold' })}
          </button>
          <button
            onClick={openHeldCarts}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-[var(--color-border)] dark:text-[var(--color-text-secondary)] dark:hover:bg-[var(--color-bg-tertiary)] cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {t('pos:terminal.recall', { defaultValue: 'Recall' })}
            {heldCarts.length > 0 && (
              <span className="rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
                {heldCarts.length}
              </span>
            )}
          </button>
          {topControlButtons.map((button) => (
            <button
              key={button.id}
              onClick={() => executeControlButton(button)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 transition-colors hover:bg-indigo-100 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300"
            >
              {button.label}
            </button>
          ))}
          <button
            onClick={() => setShowShortcutsDialog(true)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-50 dark:border-[var(--color-border)] dark:bg-[var(--color-bg-tertiary)] dark:text-[var(--color-text-secondary)] dark:hover:bg-[var(--color-bg-primary)] sm:text-xs xl:px-3 xl:py-2"
            title={t('pos:terminal.keyboardShortcuts', { defaultValue: 'Keyboard Shortcuts' })}
          >
            <Keyboard className="h-3.5 w-3.5 xl:h-4 xl:w-4" />
            <span className="hidden xl:inline">{t('pos:terminal.shortcuts', { defaultValue: 'Shortcuts' })}</span>
          </button>
          <button
            onClick={toggleFullscreen}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-50 dark:border-[var(--color-border)] dark:bg-[var(--color-bg-tertiary)] dark:text-[var(--color-text-secondary)] dark:hover:bg-[var(--color-bg-primary)] sm:text-xs xl:px-3 xl:py-2"
          >
            {isFullscreen ? <Minimize className="h-3.5 w-3.5" /> : <Maximize className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={() => navigate('/pos/shift')}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-[var(--color-border)] dark:text-[var(--color-text-secondary)] dark:hover:bg-[var(--color-bg-tertiary)] cursor-pointer"
          >
            {t('pos:terminal.manageShift', { defaultValue: 'Shift' })}
          </button>
        </div>
      </header>

      {/* Workspace */}
      <div className="grid flex-1 min-h-0 grid-cols-1 gap-3 overflow-hidden p-3 lg:grid-cols-12">
        {/* Products pane */}
        <section className="flex flex-1 min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-[var(--color-border)] dark:bg-[var(--color-bg-secondary)] lg:col-span-7">
          <div className="flex-none shrink-0 border-b border-slate-100 p-3 dark:border-[var(--color-border)]">
            <div className="relative">
              <input
                ref={searchRef}
                autoFocus
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={onSearchKeyDown}
                placeholder={t('pos:terminal.searchPlaceholder', { defaultValue: 'Scan barcode / search SKU or name' })}
                className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-4 pr-9 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-[var(--color-border)] dark:bg-[var(--color-bg-primary)] dark:text-[var(--color-text-primary)]"
              />
              <ScanLine className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300" />
            </div>
            
            {!searching && !searchQuery && currentShortcutNodes.length > 0 && (
              <div className="mt-3 flex overflow-x-auto items-center gap-2 text-xs pb-1 shrink-0 no-scrollbar">
                <button
                  type="button"
                  onClick={() => setShortcutPath([])}
                  disabled={shortcutPath.length === 0}
                  className="shrink-0 rounded-lg border border-slate-200 px-2.5 py-1 font-medium text-slate-600 disabled:opacity-50 dark:border-[var(--color-border)] dark:text-[var(--color-text-secondary)]"
                >
                  {t('pos:terminal.shortcutsRoot', { defaultValue: 'Root' })}
                </button>
                {shortcutPath.map((node, index) => (
                  <button
                    key={node.id}
                    type="button"
                    onClick={() => setShortcutPath((prev) => prev.slice(0, index + 1))}
                    className="shrink-0 rounded-lg bg-slate-100 px-2.5 py-1 font-medium text-slate-700 dark:bg-[var(--color-bg-tertiary)] dark:text-[var(--color-text-primary)]"
                  >
                    {node.label}
                  </button>
                ))}
                {shortcutPath.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShortcutPath((prev) => prev.slice(0, -1))}
                    className="shrink-0 rounded-lg border border-slate-200 px-2.5 py-1 font-medium text-slate-600 dark:border-[var(--color-border)] dark:text-[var(--color-text-secondary)]"
                  >
                    {t('common.back', { defaultValue: 'Back' })}
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {searching && (
              <div className="grid grid-cols-1 gap-2 lg:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-[88px] animate-pulse rounded-xl bg-slate-100 dark:bg-[var(--color-bg-tertiary)]" />
                ))}
              </div>
            )}

            {!searching && searchResults.length > 0 && (
              <div className="grid grid-cols-1 gap-2 lg:grid-cols-3 xl:grid-cols-4">
                {searchResults.map((it) => {
                  const unitPrice = Number(it.salePrice || 0);
                  const canSell = Number.isFinite(unitPrice) && unitPrice > 0;
                  return (
                    <button
                      key={it.id}
                      onClick={() => onAddToCart(it)}
                      title={`${it.name} — ${it.code}`}
                      className={`group flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-[var(--color-border)] dark:bg-[var(--color-bg-primary)] ${
                        canSell
                          ? 'hover:border-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-[var(--color-bg-tertiary)] cursor-pointer'
                          : 'opacity-75 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3 w-full">
                        <div className="flex h-8 w-8 sm:h-9 sm:w-9 flex-none items-center justify-center rounded-lg bg-indigo-100 text-[10px] sm:text-xs font-bold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
                          {initialsOf(it.name)}
                        </div>
                        <div className="min-w-0 flex-1 w-full">
                          <div className="text-sm font-semibold leading-snug text-slate-900 line-clamp-2 dark:text-[var(--color-text-primary)]" title={it.name}>
                            {it.name}
                          </div>
                          <div className="truncate font-mono text-[10px] sm:text-[11px] text-slate-500 mt-0.5 dark:text-[var(--color-text-secondary)]" title={it.code}>
                            {it.code}
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <span className={`font-mono text-sm font-bold ${canSell ? 'text-slate-900 dark:text-[var(--color-text-primary)]' : 'text-rose-600 dark:text-rose-400'}`}>
                          {canSell ? money(unitPrice) : t('pos:terminal.noSalePrice', { defaultValue: 'No price' })}
                        </span>
                        <span className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors dark:bg-[var(--color-bg-tertiary)] dark:text-[var(--color-text-secondary)] ${
                          canSell
                            ? 'bg-slate-100 text-slate-600 group-hover:bg-indigo-600 group-hover:text-white'
                            : 'bg-rose-50 text-rose-500'
                        }`}>
                          <Plus className="h-4 w-4" />
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {!searching && !searchQuery && currentShortcutNodes.length > 0 && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                  {currentShortcutNodes.map((node) => (
                    <button
                      key={node.id}
                      type="button"
                      onClick={() => onShortcutClick(node)}
                      className="group flex min-h-[88px] flex-col justify-between rounded-xl border border-slate-200 bg-white p-3 text-left transition-colors hover:border-indigo-400 hover:bg-indigo-50/50 dark:border-[var(--color-border)] dark:bg-[var(--color-bg-primary)] dark:hover:bg-[var(--color-bg-tertiary)]"
                    >
                      <div className="flex items-start gap-2">
                        <div className={`flex h-9 w-9 flex-none items-center justify-center rounded-lg text-xs font-bold ${
                          node.nodeType === 'GROUP'
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
                            : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300'
                        }`}>
                          {node.nodeType === 'GROUP' ? 'GRP' : initialsOf(node.label)}
                        </div>
                        <div className="min-w-0">
                          <div className="line-clamp-2 text-sm font-semibold text-slate-900 dark:text-[var(--color-text-primary)]">{node.label}</div>
                          <div className="truncate font-mono text-[11px] text-slate-500 dark:text-[var(--color-text-secondary)]">
                            {node.nodeType === 'GROUP'
                              ? t('pos:terminal.shortcutGroup', { defaultValue: 'Group' })
                              : node.item?.code || node.itemId}
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <span className="font-mono text-sm font-bold text-slate-900 dark:text-[var(--color-text-primary)]">
                          {node.nodeType === 'ITEM' && node.item?.salePrice !== undefined ? money(Number(node.item.salePrice || 0)) : ''}
                        </span>
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition-colors group-hover:bg-indigo-600 group-hover:text-white dark:bg-[var(--color-bg-tertiary)] dark:text-[var(--color-text-secondary)]">
                          {node.nodeType === 'GROUP' ? <Search className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!searching && searchQuery && searchResults.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center py-16 text-center">
                <Search className="mb-3 h-10 w-10 text-slate-200 dark:text-[var(--color-border)]" />
                <p className="text-sm font-medium text-slate-500 dark:text-[var(--color-text-secondary)]">
                  {t('pos:terminal.noResultsFor', { defaultValue: 'No matches for' })} “{searchQuery}”
                </p>
              </div>
            )}

            {!searching && !searchQuery && currentShortcutNodes.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center py-16 text-center">
                <ScanLine className="mb-3 h-12 w-12 text-slate-200 dark:text-[var(--color-border)]" />
                <p className="text-sm font-medium text-slate-600 dark:text-[var(--color-text-primary)]">
                  {t('pos:terminal.searchPrompt', { defaultValue: 'Scan or search to add products' })}
                </p>
                <p className="mt-1 text-xs text-slate-400 dark:text-[var(--color-text-secondary)]">
                  {t('pos:terminal.searchPromptHelp', { defaultValue: 'Tap a product to add it to the order. Press Enter to add the top match.' })}
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Order pane */}
        <aside className="flex flex-1 min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-[var(--color-border)] dark:bg-[var(--color-bg-secondary)] lg:col-span-5">
          <div className="flex flex-none shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-[var(--color-border)]">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-[var(--color-text-primary)]">
              <Receipt className="h-4 w-4 text-indigo-600" />
              {t('pos:terminal.currentSale', { defaultValue: 'Current sale' })}
              {itemCount > 0 && (
                <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-bold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
                  {itemCount}
                </span>
              )}
            </h2>
            {cart.length > 0 && (
              <button
                onClick={onClearSale}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:text-[var(--color-text-secondary)] dark:hover:bg-rose-500/10 cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {activeCart.length > 0
                  ? t('pos:terminal.voidAll', { defaultValue: 'Void all' })
                  : t('pos:terminal.clear', { defaultValue: 'Clear' })}
              </button>
            )}
          </div>

          {/* Cart lines */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {cart.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center py-16 text-center">
                <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 dark:bg-[var(--color-bg-tertiary)]">
                  <ShoppingCart className="h-7 w-7 text-slate-300 dark:text-[var(--color-text-secondary)]" />
                </div>
                <p className="text-sm font-medium text-slate-500 dark:text-[var(--color-text-secondary)]">
                  {t('pos:terminal.cartEmpty', { defaultValue: 'Cart is empty' })}
                </p>
                <p className="mt-1 text-xs text-slate-400 dark:text-[var(--color-text-secondary)]">
                  {t('pos:terminal.cartEmptyHelp', { defaultValue: 'Add items from the product list.' })}
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-[var(--color-border)]">
                {cart.map((l, index) => {
                  const isVoided = l.status === 'VOIDED';
                  const activeIndex = activeCart.findIndex((line) => line.lineId === l.lineId);
                  const quoteLine = activeIndex >= 0 ? quote?.lines?.[activeIndex] : undefined;
                  const taxName = quoteLine?.taxCodeName || t('pos:terminal.noTaxCode', { defaultValue: 'No tax' });
                  return (
                  <li key={l.lineId} className={`flex flex-col gap-3 px-2 sm:px-4 py-2 sm:py-3 ${isVoided ? 'bg-slate-50 opacity-75 dark:bg-[var(--color-bg-primary)]/50' : 'hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors'}`}>
                    {/* ROW 1: Single Row for all screens */}
                    <div className="flex items-center justify-between w-full gap-2 sm:gap-4">
                      {/* Left Side: Name, Edit (Desktop), Code, DefPrice, DefTax */}
                      <div className="flex items-center gap-1.5 sm:gap-3 min-w-0 flex-1">
                        <span className={`block truncate rounded bg-indigo-50/60 px-2 py-1 text-sm sm:text-[16px] font-semibold border border-indigo-100/60 dark:border-indigo-500/20 dark:bg-indigo-500/10 ${isVoided ? 'text-slate-500 line-through dark:text-[var(--color-text-secondary)]' : 'text-indigo-950 dark:text-indigo-50'}`} title={l.itemName}>
                          <span className="mr-1 sm:mr-1.5 text-[12px] sm:text-[14px] font-mono font-medium text-slate-400 dark:text-slate-500">{index + 1}.</span>
                          {l.itemName}
                        </span>
                        {isVoided && (
                          <span className="hidden sm:inline-block rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:border-[var(--color-border)] dark:bg-transparent">
                            {t('pos:terminal.voided', { defaultValue: 'Voided' })}
                          </span>
                        )}
                        {!isVoided && (
                          <button
                            onClick={() => setEditingLineId(l.lineId)}
                            aria-label={t('pos:terminal.editLine', { defaultValue: 'Edit line' })}
                            className="hidden xl:flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600 active:bg-indigo-100 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-400 cursor-pointer"
                          >
                            <Pencil className="h-5 w-5" />
                          </button>
                        )}

                        <div className="hidden xl:flex ml-2 items-center gap-2 text-slate-400 dark:text-[var(--color-text-secondary)] shrink-0">
                          <span className="font-mono text-xs font-medium">{l.itemCode}</span>
                          <span className="text-[10px] opacity-30">|</span>
                          <span className="font-mono text-xs font-medium">{money(l.unitPrice)}</span>
                          <span className="text-[10px] opacity-30">|</span>
                          <span className="font-mono text-xs font-medium">{taxName}</span>
                        </div>
                      </div>

                      {/* Right Side: Qty Control, Mobile Edit, Mobile Line Total, Delete */}
                      <div className="flex items-center justify-end gap-1.5 sm:gap-3 shrink-0">
                        {/* Action Buttons */}
                        <div className="flex items-center gap-1 sm:gap-3">
                          {!isVoided && (
                            <div className="flex h-8 sm:h-9 xl:h-10 items-center rounded-md border border-slate-200 bg-white shadow-sm dark:border-[var(--color-border)] dark:bg-[var(--color-bg-primary)]">
                              <button
                                onClick={() => onUpdateQty(l.lineId, round2(l.qty - 1))}
                                className="flex h-full w-8 sm:w-9 xl:w-10 items-center justify-center rounded-l-md text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900 active:bg-slate-100 dark:hover:bg-[var(--color-bg-tertiary)] dark:hover:text-[var(--color-text-primary)] cursor-pointer"
                              >
                                <Minus className="h-3.5 w-3.5" />
                              </button>
                              <input
                                type="number"
                                min="0"
                                step="0.001"
                                value={l.qty}
                                onChange={(e) => onUpdateQty(l.lineId, Number(e.target.value) || 0)}
                                onFocus={(e) => e.target.select()}
                                className="h-full w-10 sm:w-12 lg:w-16 xl:w-24 px-1 border-x border-slate-200 bg-transparent text-center text-[13px] sm:text-sm font-medium text-slate-900 outline-none [appearance:textfield] focus:bg-indigo-50/50 dark:border-[var(--color-border)] dark:text-[var(--color-text-primary)] dark:focus:bg-[var(--color-bg-tertiary)] [&::-webkit-inner-spin-button]:appearance-none"
                              />
                              <button
                                onClick={() => onUpdateQty(l.lineId, round2(l.qty + 1))}
                                className="flex h-full w-8 sm:w-9 xl:w-10 items-center justify-center rounded-r-md text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900 active:bg-slate-100 dark:hover:bg-[var(--color-bg-tertiary)] dark:hover:text-[var(--color-text-primary)] cursor-pointer"
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}

                          {/* MOBILE Edit Button */}
                          {!isVoided && (
                            <button
                              onClick={() => setEditingLineId(l.lineId)}
                              aria-label={t('pos:terminal.editLine', { defaultValue: 'Edit line' })}
                              className="flex xl:hidden h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:bg-indigo-50 hover:text-indigo-600 active:bg-indigo-100 dark:border-[var(--color-border)] dark:bg-[var(--color-bg-primary)] dark:hover:bg-indigo-500/10 dark:hover:text-indigo-400 cursor-pointer"
                            >
                              <Pencil className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            </button>
                          )}

                          {isVoided ? (
                            <button
                              onClick={() => beginVoidLine(l.lineId)}
                              className="flex h-8 w-8 sm:h-9 sm:w-9 xl:h-10 xl:w-10 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600 active:bg-indigo-100 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-400 cursor-pointer xl:border xl:border-slate-200 xl:bg-white xl:shadow-sm dark:xl:border-[var(--color-border)] dark:xl:bg-[var(--color-bg-primary)]"
                            >
                              <RefreshCw className="h-3.5 w-3.5 sm:h-4 sm:w-4 xl:h-4 xl:w-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => beginVoidLine(l.lineId)}
                              className="flex h-8 w-8 sm:h-9 sm:w-9 xl:h-10 xl:w-10 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 active:bg-rose-100 dark:hover:bg-rose-500/10 dark:hover:text-rose-400 cursor-pointer xl:border xl:border-slate-200 xl:bg-white xl:shadow-sm xl:hover:border-rose-200 dark:xl:border-[var(--color-border)] dark:xl:bg-[var(--color-bg-primary)]"
                            >
                              <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 xl:h-4 xl:w-4" />
                            </button>
                          )}
                        </div>

                        {/* MOBILE Line Total */}
                        <div className={`xl:hidden font-mono text-[13px] sm:text-[17.5px] font-bold ${isVoided ? 'text-slate-400 line-through' : 'text-indigo-700 dark:text-indigo-400'}`}>
                          {money(l.lineTotal)}
                        </div>
                      </div>
                    </div>

                    {/* ROW 2: Unit, PRICE, TAX, DIS %, DIS $, Line Total (Desktop Only) */}
                    <div className="hidden xl:flex items-center gap-3">
                      <div
                        onClick={(e) => {
                          if ((e.target as HTMLElement).tagName !== 'INPUT' && !isVoided) {
                            uomRefs.current[l.lineId]?.openPicker();
                          }
                        }}
                        className={`flex items-center gap-1.5 rounded border border-slate-100 bg-slate-50 px-1.5 py-1 dark:border-[var(--color-border)] dark:bg-[var(--color-bg-primary)]/50 ${!isVoided ? 'cursor-pointer hover:bg-slate-100 dark:hover:bg-[var(--color-bg-primary)]' : ''}`}
                      >
                        <label className="cursor-pointer whitespace-nowrap text-[10px] font-bold tracking-wider text-slate-400">{t('pos:terminal.unitShort')}</label>
                        <div className="w-16">
                          <UomSelector
                            ref={(el) => { if (el) uomRefs.current[l.lineId] = el; }}
                            itemId={l.itemId}
                            valueCode={l.uom || ''}
                            usage="sales"
                            hideIcon={true}
                            noBorder={true}
                            onChange={(uom) => onUpdateUom(l.lineId, uom?.code || '')}
                            disabled={isVoided}
                            className="h-6 w-full rounded border border-slate-200 bg-white px-1.5 text-center font-mono text-xs font-semibold text-slate-900 outline-none transition-colors focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 disabled:opacity-50 dark:border-[var(--color-border)] dark:bg-[var(--color-bg-primary)] dark:text-[var(--color-text-primary)] [&>input]:!h-full [&>input]:!min-h-0 [&>input]:!px-0 [&>input]:!text-xs [&>input]:!font-mono [&>input]:!font-semibold [&>input]:!bg-transparent [&>input]:!text-center"
                          />
                        </div>
                      </div>

                      <div
                        onClick={(e) => {
                          if ((e.target as HTMLElement).tagName !== 'INPUT' && !isVoided) {
                            setNumberEditModal({ lineId: l.lineId, field: 'unitPrice', value: String(l.unitPrice), title: t('pos:terminal.editPrice') });
                          }
                        }}
                        className={`flex items-center gap-1.5 rounded border border-slate-100 bg-slate-50 px-1.5 py-1 dark:border-[var(--color-border)] dark:bg-[var(--color-bg-primary)]/50 ${!isVoided ? 'cursor-pointer hover:bg-slate-100 dark:hover:bg-[var(--color-bg-primary)]' : ''}`}
                      >
                        <label className="cursor-pointer whitespace-nowrap text-[10px] font-bold tracking-wider text-slate-400">{t('pos:terminal.priceShort')}</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={l.unitPrice}
                          onChange={(e) => onUpdateUnitPrice(l.lineId, Number(e.target.value) || 0)}
                          onFocus={(e) => e.target.select()}
                          disabled={isVoided}
                          className="h-6 w-16 rounded border border-slate-200 bg-white px-1.5 text-right font-mono text-xs font-semibold text-slate-900 outline-none transition-colors focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 dark:border-[var(--color-border)] dark:bg-[var(--color-bg-primary)] dark:text-[var(--color-text-primary)] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </div>

                      <div
                        onClick={(e) => {
                          if ((e.target as HTMLElement).tagName !== 'INPUT' && !isVoided) {
                            setNumberEditModal({ lineId: l.lineId, field: 'manualTaxAmount', value: String(l.taxOverride ? (l.manualTaxAmount || 0) : (quoteLine?.taxAmount || 0)), title: t('pos:terminal.editTaxAmount') });
                          }
                        }}
                        className={`flex items-center gap-1.5 rounded border border-slate-100 bg-slate-50 px-1.5 py-1 dark:border-[var(--color-border)] dark:bg-[var(--color-bg-primary)]/50 ${!isVoided ? 'cursor-pointer hover:bg-slate-100 dark:hover:bg-[var(--color-bg-primary)]' : ''}`}
                        title={`${taxName}${quoteLine?.taxRate !== undefined ? ` ${(quoteLine.taxRate * 100).toFixed(2)}%` : ''}`}
                      >
                        <label className="cursor-pointer whitespace-nowrap text-[10px] font-bold tracking-wider text-slate-400">{t('pos:terminal.taxShort')}</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={l.taxOverride ? (l.manualTaxAmount || 0) : (quoteLine?.taxAmount || 0)}
                          onChange={(e) => onUpdateManualTax(l.lineId, Number(e.target.value) || 0)}
                          onFocus={(e) => e.target.select()}
                          disabled={isVoided}
                          className={`h-6 w-16 rounded border bg-white px-1.5 text-right font-mono text-xs font-semibold text-slate-900 outline-none transition-colors focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 dark:bg-[var(--color-bg-primary)] dark:text-[var(--color-text-primary)] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none ${l.taxOverride ? 'border-amber-300 bg-amber-50 dark:border-amber-500/50 dark:bg-amber-900/20' : 'border-slate-200 dark:border-[var(--color-border)]'}`}
                        />
                      </div>

                      <div
                        onClick={(e) => {
                          if ((e.target as HTMLElement).tagName !== 'INPUT' && !isVoided) {
                            setNumberEditModal({ lineId: l.lineId, field: 'discountPercent', value: String(l.discountType === 'PERCENT' ? l.discountValue : 0), title: t('pos:terminal.editDiscountPercent') });
                          }
                        }}
                        className={`flex items-center gap-1.5 rounded border border-slate-100 bg-slate-50 px-1.5 py-1 dark:border-[var(--color-border)] dark:bg-[var(--color-bg-primary)]/50 ${!isVoided ? 'cursor-pointer hover:bg-slate-100 dark:hover:bg-[var(--color-bg-primary)]' : ''}`}
                      >
                        <label className="cursor-pointer whitespace-nowrap text-[10px] font-bold tracking-wider text-slate-400">{t('pos:terminal.discountPercentShort')}</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={l.discountType === 'PERCENT' ? l.discountValue : ''}
                          onChange={(e) => onUpdateDiscountPercent(l.lineId, Number(e.target.value) || 0)}
                          onFocus={(e) => e.target.select()}
                          disabled={isVoided}
                          className="h-6 w-12 rounded border border-slate-200 bg-white px-1.5 text-right font-mono text-xs font-semibold text-slate-900 outline-none transition-colors focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 dark:border-[var(--color-border)] dark:bg-[var(--color-bg-primary)] dark:text-[var(--color-text-primary)] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </div>

                      <div
                        onClick={(e) => {
                          if ((e.target as HTMLElement).tagName !== 'INPUT' && !isVoided) {
                            setNumberEditModal({ lineId: l.lineId, field: 'lineDiscount', value: String(l.lineDiscount), title: t('pos:terminal.editDiscountAmount') });
                          }
                        }}
                        className={`flex items-center gap-1.5 rounded border border-slate-100 bg-slate-50 px-1.5 py-1 dark:border-[var(--color-border)] dark:bg-[var(--color-bg-primary)]/50 ${!isVoided ? 'cursor-pointer hover:bg-slate-100 dark:hover:bg-[var(--color-bg-primary)]' : ''}`}
                      >
                        <label className="cursor-pointer whitespace-nowrap text-[10px] font-bold tracking-wider text-slate-400">{t('pos:terminal.discountAmountShort')}</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={l.lineDiscount}
                          onChange={(e) => onUpdateLineDiscount(l.lineId, Number(e.target.value) || 0)}
                          onFocus={(e) => e.target.select()}
                          disabled={isVoided}
                          className="h-6 w-16 rounded border border-slate-200 bg-white px-1.5 text-right font-mono text-xs font-semibold text-slate-900 outline-none transition-colors focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 dark:border-[var(--color-border)] dark:bg-[var(--color-bg-primary)] dark:text-[var(--color-text-primary)] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </div>

                      <div className={`ml-auto flex items-center justify-center rounded-md px-2 py-1 xl:w-[228px] font-mono text-[17.5px] font-bold ${isVoided ? 'text-slate-400 line-through bg-slate-50 dark:bg-[var(--color-bg-primary)]/50' : 'text-indigo-700 bg-indigo-50 dark:bg-indigo-500/10 dark:text-indigo-400'}`}>
                        <span className="block w-full truncate text-center">{money(l.lineTotal)}</span>
                      </div>
                    </div>
                  </li>
                );
                })}
              </ul>
            )}
          </div>

          {/* Totals + customer + pay */}
          <div className="flex-none shrink-0 space-y-2 border-t border-slate-200 bg-slate-100 p-2 sm:p-3 lg:space-y-3 lg:p-4 dark:border-[var(--color-border)] dark:bg-[var(--color-bg-tertiary)]">
            {/* Mobile Expand Toggle */}
            <button
              onClick={() => setIsTotalsExpanded(!isTotalsExpanded)}
              className="flex w-full items-center justify-center py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 transition-colors hover:text-slate-600 xl:hidden dark:text-slate-500 cursor-pointer"
            >
              {isTotalsExpanded ? (
                <>
                  {t('pos:terminal.hideDetails', { defaultValue: 'Hide Details' })}
                  <ChevronUp className="ml-1 h-3 w-3" />
                </>
              ) : (
                <>
                  {t('pos:terminal.showDetails', { defaultValue: 'Show Details' })}
                  <ChevronDown className="ml-1 h-3 w-3" />
                </>
              )}
            </button>

            <div className={`space-y-2 lg:space-y-3 ${isTotalsExpanded ? 'block' : 'hidden xl:block'}`}>
              <div className="space-y-1 text-xs sm:space-y-1.5 lg:text-sm">
                <div className="flex justify-between text-slate-600 dark:text-[var(--color-text-secondary)]">
                  <span>{t('pos:terminal.subtotal', { defaultValue: 'Subtotal' })}</span>
                  <span className="font-mono">{money(subtotal)}</span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-[var(--color-text-secondary)]">
                  <span>{t('pos:terminal.discount', { defaultValue: 'Discount' })}</span>
                  <span className="font-mono">{money(discountTotal)}</span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-[var(--color-text-secondary)]">
                  <span>{t('pos:terminal.tax', { defaultValue: 'Tax' })}</span>
                  <span className="font-mono">{money(taxTotal)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between border-t border-slate-200 pt-1 lg:pt-2 dark:border-[var(--color-border)]">
                  <span className="text-sm font-bold text-slate-900 lg:text-base dark:text-[var(--color-text-primary)]">
                    {t('pos:terminal.grandTotal', { defaultValue: 'Total' })}
                  </span>
                  <span className="font-mono text-lg font-extrabold text-slate-900 lg:text-xl dark:text-[var(--color-text-primary)]">{money(grandTotal)}</span>
                </div>
              </div>

              <div>
                <label className="mb-0.5 block text-[10px] font-medium text-slate-500 lg:mb-1 lg:text-xs dark:text-[var(--color-text-secondary)]">
                  {t('pos:terminal.customer', { defaultValue: 'Customer' })}
                </label>
                <PartySelector
                  role="CUSTOMER"
                  value={customerId}
                  onChange={(p) => setCustomerId(p?.id || settings?.walkInCustomerId)}
                />
              </div>

              <div>
                <label className="mb-0.5 block text-[10px] font-medium text-slate-500 lg:mb-1 lg:text-xs dark:text-[var(--color-text-secondary)]">
                  {t('pos:terminal.saleNotes', { defaultValue: 'Notes' })}
                </label>
                <textarea
                  value={saleNotes}
                  onChange={(e) => setSaleNotes(e.target.value)}
                  className="w-full rounded-md border border-slate-300 p-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white dark:focus:border-indigo-400 dark:focus:ring-indigo-400"
                  rows={2}
                  placeholder={t('pos:terminal.saleNotesPlaceholder', { defaultValue: 'Optional sale notes...' })}
                />
              </div>
            </div>

            {bottomControlButtons.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {bottomControlButtons.map((button) => (
                  <button
                    key={button.id}
                    type="button"
                    onClick={() => executeControlButton(button)}
                    className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 transition-colors hover:bg-indigo-100 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300"
                  >
                    {button.label}
                  </button>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onCompleteSale(true)}
                disabled={activeCart.length === 0}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 px-3 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-orange-700 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 lg:px-4 lg:py-3.5 lg:text-base cursor-pointer dark:disabled:bg-[var(--color-bg-tertiary)]"
              >
                <CreditCard className="h-4 w-4 lg:h-5 lg:w-5" />
                {t('pos:terminal.creditSale', { defaultValue: 'Deferred Payment to Customer Account' })}
              </button>

              <button
                onClick={openPayDialog}
                disabled={activeCart.length === 0}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 lg:px-4 lg:py-3.5 lg:text-base cursor-pointer dark:disabled:bg-[var(--color-bg-tertiary)]"
              >
                <Banknote className="h-4 w-4 lg:h-5 lg:w-5" />
                {t('pos:terminal.pay', { defaultValue: 'Pay' })}
              </button>
            </div>
          </div>
        </aside>
      </div>

      <Modal
        isOpen={Boolean(numberEditModal)}
        onClose={() => setNumberEditModal(null)}
        title={numberEditModal?.title || t('pos:terminal.edit')}
      >
        {numberEditModal && (
          <div className="space-y-4">
            <input
              type="text"
              autoFocus
              value={numberEditModal.value}
              onChange={(e) => setNumberEditModal(prev => prev ? { ...prev, value: e.target.value } : null)}
              onFocus={(e) => e.target.select()}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const val = Number(numberEditModal.value) || 0;
                  if (numberEditModal.field === 'qty') onUpdateQty(numberEditModal.lineId, val);
                  else if (numberEditModal.field === 'unitPrice') onUpdateUnitPrice(numberEditModal.lineId, val);
                  else if (numberEditModal.field === 'manualTaxAmount') onUpdateManualTax(numberEditModal.lineId, val);
                  else if (numberEditModal.field === 'discountPercent') onUpdateDiscountPercent(numberEditModal.lineId, val);
                  else if (numberEditModal.field === 'lineDiscount') onUpdateLineDiscount(numberEditModal.lineId, val);
                  setNumberEditModal(null);
                }
              }}
              className="w-full text-right text-4xl font-mono p-4 rounded-xl border border-slate-300 dark:border-[var(--color-border)] dark:bg-[var(--color-bg-primary)] dark:text-[var(--color-text-primary)] outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            />
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'C', 0, '.'].map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    if (key === 'C') {
                      setNumberEditModal(prev => prev ? { ...prev, value: '' } : null);
                    } else {
                      setNumberEditModal(prev => prev ? { ...prev, value: prev.value + key } : null);
                    }
                  }}
                  className="h-16 text-2xl font-bold bg-slate-100 hover:bg-slate-200 active:bg-slate-300 rounded-xl dark:bg-[var(--color-bg-tertiary)] dark:hover:bg-[var(--color-bg-primary)] dark:text-[var(--color-text-primary)] transition-colors cursor-pointer"
                >
                  {key}
                </button>
              ))}
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setNumberEditModal(null)}
                className="flex-1 rounded-xl bg-slate-100 py-4 text-lg font-bold text-slate-700 hover:bg-slate-200 dark:bg-[var(--color-bg-tertiary)] dark:text-[var(--color-text-primary)] dark:hover:bg-[var(--color-bg-primary)] cursor-pointer"
              >
                {t('common.cancel', { defaultValue: 'Cancel' })}
              </button>
              <button
                type="button"
                onClick={() => {
                  const val = Number(numberEditModal.value) || 0;
                  if (numberEditModal.field === 'qty') onUpdateQty(numberEditModal.lineId, val);
                  else if (numberEditModal.field === 'unitPrice') onUpdateUnitPrice(numberEditModal.lineId, val);
                  else if (numberEditModal.field === 'manualTaxAmount') onUpdateManualTax(numberEditModal.lineId, val);
                  else if (numberEditModal.field === 'discountPercent') onUpdateDiscountPercent(numberEditModal.lineId, val);
                  else if (numberEditModal.field === 'lineDiscount') onUpdateLineDiscount(numberEditModal.lineId, val);
                  setNumberEditModal(null);
                }}
                className="flex-1 rounded-xl bg-indigo-600 py-4 text-lg font-bold text-white hover:bg-indigo-700 cursor-pointer"
              >
                {t('common.save', { defaultValue: 'Save' })}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Tender dialog */}
      <ConfirmDialog
        isOpen={showPayDialog}
        title={t('pos:terminal.tenderTitle', { defaultValue: 'Take payment' })}
        message={
          <div className="space-y-4">
            {/* Amount due banner */}
            <div className="flex items-center justify-between rounded-xl bg-slate-100 px-4 py-3 dark:bg-[var(--color-bg-tertiary)]">
              <span className="text-sm font-medium text-slate-600 dark:text-[var(--color-text-secondary)]">
                {t('pos:terminal.balanceDue', { defaultValue: 'Balance due' })}
              </span>
              <span className="font-mono text-lg font-bold text-slate-900 dark:text-[var(--color-text-primary)]">{money(balanceDue)}</span>
            </div>

            {/* Method buttons */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-[var(--color-text-secondary)]">
                {t('pos:terminal.method', { defaultValue: 'Method' })}
              </label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {enabledMethods.map((m) => {
                  const meta = METHOD_META[m];
                  const Icon = meta.Icon;
                  const active = tenderMethod === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setTenderMethod(m)}
                      className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-xs font-semibold transition-colors cursor-pointer ${
                        active
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-500/15 dark:text-indigo-300'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-[var(--color-border)] dark:text-[var(--color-text-secondary)] dark:hover:bg-[var(--color-bg-tertiary)]'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {meta.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Amount + reference */}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-[var(--color-text-secondary)]">
                  {t('pos:terminal.amount', { defaultValue: 'Amount' })}
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={tenderAmount}
                    onChange={(e) => setTenderAmount(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTender(); } }}
                    placeholder="0.00"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-[var(--color-border)] dark:bg-[var(--color-bg-primary)] dark:text-[var(--color-text-primary)]"
                  />
                  <button
                    type="button"
                    onClick={() => setTenderAmount(String(balanceDue))}
                    className="flex-none rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 dark:border-[var(--color-border)] dark:text-[var(--color-text-secondary)] dark:hover:bg-[var(--color-bg-tertiary)] cursor-pointer"
                  >
                    {t('pos:terminal.exact', { defaultValue: 'Exact' })}
                  </button>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-[var(--color-text-secondary)]">
                  {t('pos:terminal.reference', { defaultValue: 'Reference' })}
                </label>
                <input
                  type="text"
                  value={tenderRef}
                  onChange={(e) => setTenderRef(e.target.value)}
                  placeholder={t('pos:terminal.referenceOptional', { defaultValue: 'Optional' })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-[var(--color-border)] dark:bg-[var(--color-bg-primary)] dark:text-[var(--color-text-primary)]"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={addTender}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 cursor-pointer"
            >
              <Plus className="h-4 w-4" /> {t('pos:terminal.addTender', { defaultValue: 'Add payment' })}
            </button>

            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-semibold text-amber-900">
                    {t('pos:managerOverride.title', { defaultValue: 'Manager approval' })}
                  </div>
                  <div className="mt-0.5 text-xs text-amber-800">
                    {saleManagerOverride
                      ? t('pos:managerOverride.attached', { defaultValue: 'Approval attached: {{id}}' }).replace('{{id}}', saleManagerOverride.managerOverrideId)
                      : t('pos:managerOverride.saleHelp', { defaultValue: 'Capture approval before completing a sale with restricted discounts, price, tax, or void overrides.' })}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSaleManagerOverride(true)}
                  className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-100 cursor-pointer"
                >
                  {saleManagerOverride
                    ? t('pos:managerOverride.replace', { defaultValue: 'Replace approval' })
                    : t('pos:managerOverride.capture', { defaultValue: 'Capture approval' })}
                </button>
              </div>
            </div>

            {/* Tender list */}
            {payments.length > 0 && (
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-[var(--color-border)] dark:border-[var(--color-border)]">
                {payments.map((p, i) => {
                  const Icon = METHOD_META[p.method].Icon;
                  return (
                    <li key={i} className="flex items-center gap-2 px-3 py-2 text-sm">
                      <Icon className="h-4 w-4 text-slate-400" />
                      <span className="flex-1 text-slate-700 dark:text-[var(--color-text-primary)]">
                        {METHOD_META[p.method].label}
                        {p.reference ? <span className="ml-1 text-xs text-slate-400">({p.reference})</span> : null}
                      </span>
                      <span className="font-mono font-semibold text-slate-900 dark:text-[var(--color-text-primary)]">{money(p.amount)}</span>
                      <button
                        onClick={() => onRemovePayment(i)}
                        aria-label={t('pos:terminal.remove', { defaultValue: 'Remove' })}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {/* Tender summary */}
            <div className="space-y-1 border-t border-slate-200 pt-3 text-sm dark:border-[var(--color-border)]">
              <div className="flex justify-between text-slate-600 dark:text-[var(--color-text-secondary)]">
                <span>{t('pos:terminal.tendered', { defaultValue: 'Tendered' })}</span>
                <span className="font-mono">{money(tenderedTotal)}</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-[var(--color-text-secondary)]">
                <span>{t('pos:terminal.change', { defaultValue: 'Change' })}</span>
                <span className="font-mono">{money(change)}</span>
              </div>
              <div className={`flex justify-between font-bold ${balanceDue > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                <span>
                  {balanceDue > 0
                    ? t('pos:terminal.balanceDue', { defaultValue: 'Balance due' })
                    : t('pos:terminal.fullyPaid', { defaultValue: 'Fully paid' })}
                </span>
                <span className="font-mono">{money(balanceDue)}</span>
              </div>
            </div>
          </div>
        }
        tone="info"
        onConfirm={onCompleteSale}
        onCancel={() => setShowPayDialog(false)}
        confirmLabel={completing
          ? t('common.processing', { defaultValue: 'Processing…' })
          : t('pos:terminal.completeSale', { defaultValue: 'Complete sale' })}
      />

      <ConfirmDialog
        isOpen={Boolean(voidTarget)}
        title={voidTarget?.all
          ? t('pos:terminal.voidAllTitle', { defaultValue: 'Void current sale lines' })
          : t('pos:terminal.voidLineTitle', { defaultValue: 'Void line' })}
        message={
          <div className="space-y-3">
            <p>
              {voidTarget?.all
                ? t('pos:terminal.voidAllMessage', { defaultValue: 'Active lines will remain on the receipt audit trail but will not be posted to stock or accounting.' })
                : t('pos:terminal.voidLineMessage', { defaultValue: 'The line will remain on the receipt audit trail but will not be posted to stock or accounting.' })}
            </p>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-[var(--color-text-secondary)]">
                {t('pos:terminal.voidReason', { defaultValue: 'Void reason' })}
              </label>
              <textarea
                value={voidReason}
                onChange={(event) => setVoidReason(event.target.value)}
                rows={3}
                className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 dark:border-[var(--color-border)] dark:bg-[var(--color-bg-primary)] dark:text-[var(--color-text-primary)]"
              />
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-amber-900">
                  {voidManagerOverride
                    ? t('pos:managerOverride.attached', { defaultValue: 'Approval attached: {{id}}' }).replace('{{id}}', voidManagerOverride.managerOverrideId)
                    : t('pos:managerOverride.voidHelp', { defaultValue: 'Capture manager approval if the cashier role requires approval for line voids.' })}
                </span>
                <button
                  type="button"
                  onClick={() => setShowVoidManagerOverride(true)}
                  className="rounded border border-amber-300 bg-white px-2.5 py-1 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-100 cursor-pointer"
                >
                  {voidManagerOverride
                    ? t('pos:managerOverride.replace', { defaultValue: 'Replace approval' })
                    : t('pos:managerOverride.capture', { defaultValue: 'Capture approval' })}
                </button>
              </div>
            </div>
          </div>
        }
        tone="warning"
        onConfirm={confirmVoid}
        onCancel={() => {
          setVoidTarget(null);
          setVoidReason('');
        }}
        confirmLabel={voidTarget?.all
          ? t('pos:terminal.voidAll', { defaultValue: 'Void all' })
          : t('pos:terminal.voidLine', { defaultValue: 'Void line' })}
      />

      <ManagerOverrideCapture
        isOpen={showVoidManagerOverride}
        action="VOID_LINE"
        title={t('pos:managerOverride.voidTitle', { defaultValue: 'Approve line void' })}
        context={{ registerId: register?.id, shiftId: shift?.id, lineId: voidTarget?.lineId, all: voidTarget?.all === true }}
        onCancel={() => setShowVoidManagerOverride(false)}
        onApproved={(override) => {
          setVoidManagerOverride(override);
          setShowVoidManagerOverride(false);
        }}
      />

      <ManagerOverrideCapture
        isOpen={showSaleManagerOverride}
        action="DISCOUNT_OVERRIDE"
        title={t('pos:managerOverride.saleTitle', { defaultValue: 'Approve sale override' })}
        context={{ registerId: register?.id, shiftId: shift?.id, lineCount: activeCart.length, total: grandTotal }}
        onCancel={() => setShowSaleManagerOverride(false)}
        onApproved={applySaleManagerOverride}
      />

      <Modal
        isOpen={Boolean(editingLine)}
        onClose={() => setEditingLineId(null)}
        title={t('pos:terminal.editLineTitle', { defaultValue: 'Edit sale line' })}
      >
        {editingLine && (
          <div className="space-y-4">
            <div className="min-w-0">
              <div className="truncate text-base font-semibold text-slate-900 dark:text-[var(--color-text-primary)]">
                {editingLine.itemName}
              </div>
              <div className="mt-1 flex min-w-0 items-center gap-2 overflow-hidden text-xs text-slate-500 dark:text-[var(--color-text-secondary)]">
                <span className="flex-none font-mono">{editingLine.itemCode}</span>
                <span className="h-4 w-px flex-none bg-slate-200 dark:bg-[var(--color-border)]" />
                <span className="min-w-0 truncate">
                  {t('pos:terminal.taxCodeLabel', { defaultValue: 'Tax' })}: {editingTaxName}
                  {editingQuoteLine?.taxRate !== undefined ? ` ${(editingQuoteLine.taxRate * 100).toFixed(2)}%` : ''}
                </span>
              </div>
            </div>

            <div className="border-t border-slate-200 dark:border-[var(--color-border)]" />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-[var(--color-text-secondary)]">
                  {t('pos:terminal.unitPrice', { defaultValue: 'Unit price' })}
                </span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={editingLine.unitPrice}
                  onChange={(e) => onUpdateUnitPrice(editingLine.lineId, Number(e.target.value) || 0)}
                  className="h-12 w-full rounded-lg border border-slate-300 px-3 text-right font-mono text-base text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-[var(--color-border)] dark:bg-[var(--color-bg-primary)] dark:text-[var(--color-text-primary)]"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-[var(--color-text-secondary)]">
                  {t('pos:terminal.discountPercent', { defaultValue: 'Discount percent' })}
                </span>
                <div className="flex h-12 rounded-lg border border-slate-300 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 dark:border-[var(--color-border)] dark:bg-[var(--color-bg-primary)]">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editingLine.discountPercent ?? 0}
                    onChange={(e) => onUpdateDiscountPercent(editingLine.lineId, Number(e.target.value) || 0)}
                    className="min-w-0 flex-1 bg-transparent px-3 text-right font-mono text-base text-slate-900 outline-none dark:text-[var(--color-text-primary)]"
                  />
                  <span className="flex w-10 items-center justify-center border-l border-slate-200 text-sm font-semibold text-slate-500 dark:border-[var(--color-border)]">%</span>
                </div>
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-[var(--color-text-secondary)]">
                  {t('pos:terminal.lineDiscount', { defaultValue: 'Line discount' })}
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editingLine.lineDiscount}
                  onChange={(e) => onUpdateLineDiscount(editingLine.lineId, Number(e.target.value) || 0)}
                  className="h-12 w-full rounded-lg border border-slate-300 px-3 text-right font-mono text-base text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-[var(--color-border)] dark:bg-[var(--color-bg-primary)] dark:text-[var(--color-text-primary)]"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-[var(--color-text-secondary)]">
                  {t('pos:terminal.taxAmount', { defaultValue: 'Tax amount' })}
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editingTaxAmount}
                  onChange={(e) => onUpdateManualTax(editingLine.lineId, Number(e.target.value) || 0)}
                  className="h-12 w-full rounded-lg border border-slate-300 px-3 text-right font-mono text-base text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-[var(--color-border)] dark:bg-[var(--color-bg-primary)] dark:text-[var(--color-text-primary)]"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-[var(--color-text-secondary)]">
                  {t('pos:terminal.qty', { defaultValue: 'Quantity' })}
                </span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={editingLine.qty}
                  onChange={(e) => onUpdateQty(editingLine.lineId, Number(e.target.value) || 0)}
                  className="h-12 w-full rounded-lg border border-slate-300 px-3 text-right font-mono text-base text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-[var(--color-border)] dark:bg-[var(--color-bg-primary)] dark:text-[var(--color-text-primary)]"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-[var(--color-text-secondary)]">
                  {t('pos:terminal.uom', { defaultValue: 'Unit' })}
                </span>
                <UomSelector
                  itemId={editingLine.itemId}
                  valueCode={editingLine.uom || ''}
                  usage="sales"
                  noBorder={true}
                  hideIcon={true}
                  onChange={(uom) => onUpdateUom(editingLine.lineId, uom?.code || '')}
                  className="h-12 w-full rounded-lg border border-slate-300 bg-white font-mono text-base text-slate-900 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 dark:border-[var(--color-border)] dark:bg-[var(--color-bg-primary)] dark:text-[var(--color-text-primary)] [&>input]:!h-12 [&>input]:!text-base [&>input]:!text-right [&>input]:!px-3"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-[var(--color-text-secondary)]">
                  {t('pos:terminal.taxCode', { defaultValue: 'Tax code' })}
                </span>
                <TaxCodeSelector
                  options={taxCodes.map((tc) => ({ id: tc.id, code: tc.code, name: tc.name, rate: tc.rate }))}
                  valueId={editingLine.taxCodeId || ''}
                  onChange={(tc) => onUpdateTaxCode(editingLine.lineId, tc?.id || '')}
                  noBorder={true}
                  className="h-12 w-full rounded-lg border border-slate-300 bg-white font-mono text-base text-slate-900 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 dark:border-[var(--color-border)] dark:bg-[var(--color-bg-primary)] dark:text-[var(--color-text-primary)] [&>input]:!h-12 [&>input]:!text-base [&>input]:!text-right [&>input]:!px-3"
                />
              </label>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-[var(--color-bg-tertiary)]">
              <span className="text-slate-500 dark:text-[var(--color-text-secondary)]">
                {t('pos:terminal.lineTotal', { defaultValue: 'Line total' })}
              </span>
              <span className="font-mono text-base font-bold text-slate-900 dark:text-[var(--color-text-primary)]">
                {money(editingLine.lineTotal)}
              </span>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={showHeldCarts}
        title={t('pos:terminal.heldCartsTitle', { defaultValue: 'Held sales' })}
        message={
          <div className="max-h-[60vh] space-y-3 overflow-y-auto">
            {heldLoading ? (
              <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-[var(--color-text-secondary)]">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600" />
                {t('common.loading', { defaultValue: 'Loading…' })}
              </div>
            ) : heldCarts.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-[var(--color-text-secondary)]">
                {t('pos:terminal.noHeldCarts', { defaultValue: 'No held sales for this shift.' })}
              </p>
            ) : (
              <ul className="space-y-2">
                {heldCarts.map((held) => (
                  <li
                    key={held.id}
                    className="rounded-xl border border-slate-200 p-3 dark:border-[var(--color-border)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-900 dark:text-[var(--color-text-primary)]">
                          {held.lines.length} {t('pos:terminal.lines', { defaultValue: 'lines' })}
                        </div>
                        <div className="mt-0.5 font-mono text-xs text-slate-500 dark:text-[var(--color-text-secondary)]">
                          {new Date(held.createdAt).toLocaleString()} · {money(held.grandTotal)}
                        </div>
                      </div>
                      <div className="flex flex-none items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onRecallHeldCart(held)}
                          className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-700 cursor-pointer"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          {t('pos:terminal.recall', { defaultValue: 'Recall' })}
                        </button>
                        <button
                          type="button"
                          onClick={() => onCancelHeldCart(held)}
                          className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-50 dark:border-rose-500/30 dark:hover:bg-rose-500/10 cursor-pointer"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          {t('common.cancel', { defaultValue: 'Cancel' })}
                        </button>
                      </div>
                    </div>
                    <div className="mt-2 line-clamp-2 text-xs text-slate-500 dark:text-[var(--color-text-secondary)]">
                      {held.lines.map((line) => line.itemName || line.itemCode || line.itemId).join(', ')}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        }
        tone="info"
        onConfirm={() => setShowHeldCarts(false)}
        onCancel={() => setShowHeldCarts(false)}
        confirmLabel={t('common.close', { defaultValue: 'Close' })}
      />

      <PosKeyboardShortcutsDialog
        isOpen={showShortcutsDialog}
        onClose={() => setShowShortcutsDialog(false)}
        initialShortcuts={userPreferences?.posShortcuts || {}}
        onSave={async (shortcuts) => {
          try {
            const updated = await userPreferencesApi.upsert({ posShortcuts: shortcuts });
            setUserPreferences(updated);
            toast.success(t('pos:shortcuts.saved', { defaultValue: 'Keyboard shortcuts saved.' }));
          } catch (err: any) {
            errorHandler.showError(err?.message || 'Failed to save shortcuts');
          }
        }}
      />
    </div>
  );
};

export default PosTerminalPage;
