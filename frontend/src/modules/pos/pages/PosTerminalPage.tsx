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
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { posApi, PosHeldCartDTO, PosRegisterDTO, PosShiftDTO, PosSettingsDTO } from '../../../api/posApi';
import { authApi } from '../../../api/auth';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { Modal } from '../../../components/ui/Modal';
import { ManagerOverrideCapture, ManagerOverrideValue } from '../components/ManagerOverrideCapture';
import { PartySelector } from '../../../components/shared/selectors/PartySelector';
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
  XCircle,
  Tag,
  Pencil,
} from 'lucide-react';

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
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [cashierRoleId, setCashierRoleId] = useState<string | undefined>(undefined);
  const [heldLoading, setHeldLoading] = useState(false);
  const [holdingCart, setHoldingCart] = useState(false);
  const [showHeldCarts, setShowHeldCarts] = useState(false);

  // Tender form (React state — no more getElementById)
  const [tenderMethod, setTenderMethod] = useState<PaymentMethod>('CASH');
  const [tenderAmount, setTenderAmount] = useState<string>('');
  const [tenderRef, setTenderRef] = useState<string>('');

  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [result, permissions] = await Promise.all([
          posApi.getBootstrap({ cashierUserId: userId }),
          authApi.getMyPermissions().catch(() => null),
        ]);
        const data = unwrap<any>(result);
        setBootstrap(data);
        setCashierRoleId(permissions?.roleId || undefined);
        if (data?.settings?.walkInCustomerId) setCustomerId(data.settings.walkInCustomerId);
      } catch (err) {
        console.error('Bootstrap failed', err);
        toast.error(t('pos.terminal.bootstrapError', { defaultValue: 'Failed to load POS data.' }));
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
  const editingTaxName = editingQuoteLine?.taxCodeName || t('pos.terminal.noTaxCode', { defaultValue: 'No tax' });
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

  const onAddToCart = (item: any) => {
    const unitPrice = Number(item.salePrice || 0);
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      toast.error(t('pos.terminal.priceRequired', { defaultValue: 'Set a sale price for this item before selling it in POS.' }));
      return;
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
  };

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
      toast.error(t('pos.terminal.voidReasonRequired', { defaultValue: 'Enter a reason before voiding the line.' }));
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
    toast.success(t('pos.terminal.lineVoided', { defaultValue: 'Line voided.' }));
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
      toast.error(t('pos.terminal.needOpenShift', { defaultValue: 'No open shift for this register.' }));
      return;
    }
    if (activeCart.length === 0) {
      toast.error(t('pos.terminal.noActiveLines', { defaultValue: 'Add at least one active line before holding the sale.' }));
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
      toast.success(t('pos.terminal.held', { defaultValue: 'Sale held.' }));
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
      toast.error(t('pos.terminal.recallNeedsEmptyCart', { defaultValue: 'Complete, hold, or void the current sale before recalling another one.' }));
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
      toast.success(t('pos.terminal.recalled', { defaultValue: 'Held sale recalled.' }));
      await loadHeldCarts();
      setShowHeldCarts(false);
    } catch (err: any) {
      errorHandler.showError(err?.response?.data?.error?.message || err?.message || 'Failed to recall held sale.');
    }
  };

  const onCancelHeldCart = async (held: PosHeldCartDTO) => {
    try {
      await posApi.cancelHeldCart(held.id, { reason: 'Cancelled from POS terminal' });
      toast.success(t('pos.terminal.heldCancelled', { defaultValue: 'Held sale cancelled.' }));
      await loadHeldCarts();
    } catch (err: any) {
      errorHandler.showError(err?.response?.data?.error?.message || err?.message || 'Failed to cancel held sale.');
    }
  };

  // Scan flow: pressing Enter adds the top match and clears the box for the next scan.
  const onSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchResults.length > 0) {
      e.preventDefault();
      onAddToCart(searchResults[0]);
      setSearchQuery('');
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
      toast.error(t('pos.terminal.tenderNeedAmount', { defaultValue: 'Pick a method and amount.' }));
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

  const onCompleteSale = async () => {
    const register = bootstrap?.register;
    const shift = bootstrap?.openShift;
    if (!register || !shift) {
      toast.error(t('pos.terminal.needOpenShift', { defaultValue: 'No open shift for this register.' }));
      return;
    }
    if (activeCart.length === 0) {
      toast.error(t('pos.terminal.noActiveLines', { defaultValue: 'Add at least one active line before taking payment.' }));
      return;
    }
    if (Math.abs(paid - grandTotal) > 0.005) {
      toast.error(t('pos.terminal.tenderMismatch', { defaultValue: 'Tendered total does not match grand total.' }));
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
      });
      const data = unwrap<any>(result);
      setLastReceipt(data);
      toast.success(t('pos.terminal.completed', { defaultValue: 'Sale completed.' }));
      setCart([]);
      setPayments([]);
      setSaleManagerOverride(null);
      setSearchQuery('');
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
            {t('pos.terminal.needOpenShift', { defaultValue: 'No open shift for this register.' })}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-[var(--color-text-secondary)]">
            {t('pos.terminal.needOpenShiftHelp', { defaultValue: 'Open a shift to start taking sales on this till.' })}
          </p>
          <button
            onClick={() => navigate('/pos/shift')}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 cursor-pointer"
          >
            {t('pos.terminal.openShiftCta', { defaultValue: 'Open a shift' })}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-slate-50 dark:bg-[var(--color-bg-primary)]">
      {/* Context bar */}
      <header className="flex flex-none flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-2.5 dark:border-[var(--color-border)] dark:bg-[var(--color-bg-secondary)]">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white">
            <ShoppingCart className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold text-slate-900 dark:text-[var(--color-text-primary)]">
              {register.name}
              <span className="ml-1.5 font-mono text-xs font-normal text-slate-400">{register.code}</span>
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500 dark:text-[var(--color-text-secondary)]">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                {t('pos.terminal.shiftOpen', { defaultValue: 'Shift open' })}
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
                {t('pos.terminal.change', { defaultValue: 'Change' })} {money(Number(lastReceipt.change || 0))}
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
              : t('pos.terminal.hold', { defaultValue: 'Hold' })}
          </button>
          <button
            onClick={openHeldCarts}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-[var(--color-border)] dark:text-[var(--color-text-secondary)] dark:hover:bg-[var(--color-bg-tertiary)] cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {t('pos.terminal.recall', { defaultValue: 'Recall' })}
            {heldCarts.length > 0 && (
              <span className="rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
                {heldCarts.length}
              </span>
            )}
          </button>
          <button
            onClick={() => navigate('/pos/shift')}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-[var(--color-border)] dark:text-[var(--color-text-secondary)] dark:hover:bg-[var(--color-bg-tertiary)] cursor-pointer"
          >
            {t('pos.terminal.manageShift', { defaultValue: 'Shift' })}
          </button>
        </div>
      </header>

      {/* Workspace */}
      <div className="grid flex-1 grid-cols-1 gap-3 overflow-hidden p-3 lg:grid-cols-12">
        {/* Products pane */}
        <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-[var(--color-border)] dark:bg-[var(--color-bg-secondary)] lg:col-span-7">
          <div className="flex-none border-b border-slate-100 p-3 dark:border-[var(--color-border)]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                ref={searchRef}
                autoFocus
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={onSearchKeyDown}
                placeholder={t('pos.terminal.searchPlaceholder', { defaultValue: 'Scan barcode / search SKU or name' })}
                className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-9 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-[var(--color-border)] dark:bg-[var(--color-bg-primary)] dark:text-[var(--color-text-primary)]"
              />
              <ScanLine className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300" />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {searching && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-[88px] animate-pulse rounded-xl bg-slate-100 dark:bg-[var(--color-bg-tertiary)]" />
                ))}
              </div>
            )}

            {!searching && searchResults.length > 0 && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
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
                      <div className="flex items-start gap-2">
                        <div className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-indigo-100 text-xs font-bold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
                          {initialsOf(it.name)}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-slate-900 dark:text-[var(--color-text-primary)]">{it.name}</div>
                          <div className="truncate font-mono text-[11px] text-slate-500 dark:text-[var(--color-text-secondary)]">{it.code}</div>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <span className={`font-mono text-sm font-bold ${canSell ? 'text-slate-900 dark:text-[var(--color-text-primary)]' : 'text-rose-600 dark:text-rose-400'}`}>
                          {canSell ? money(unitPrice) : t('pos.terminal.noSalePrice', { defaultValue: 'No price' })}
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

            {!searching && searchQuery && searchResults.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center py-16 text-center">
                <Search className="mb-3 h-10 w-10 text-slate-200 dark:text-[var(--color-border)]" />
                <p className="text-sm font-medium text-slate-500 dark:text-[var(--color-text-secondary)]">
                  {t('pos.terminal.noResultsFor', { defaultValue: 'No matches for' })} “{searchQuery}”
                </p>
              </div>
            )}

            {!searching && !searchQuery && (
              <div className="flex h-full flex-col items-center justify-center py-16 text-center">
                <ScanLine className="mb-3 h-12 w-12 text-slate-200 dark:text-[var(--color-border)]" />
                <p className="text-sm font-medium text-slate-600 dark:text-[var(--color-text-primary)]">
                  {t('pos.terminal.searchPrompt', { defaultValue: 'Scan or search to add products' })}
                </p>
                <p className="mt-1 text-xs text-slate-400 dark:text-[var(--color-text-secondary)]">
                  {t('pos.terminal.searchPromptHelp', { defaultValue: 'Tap a product to add it to the order. Press Enter to add the top match.' })}
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Order pane */}
        <aside className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-[var(--color-border)] dark:bg-[var(--color-bg-secondary)] lg:col-span-5">
          <div className="flex flex-none items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-[var(--color-border)]">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-[var(--color-text-primary)]">
              <Receipt className="h-4 w-4 text-indigo-600" />
              {t('pos.terminal.currentSale', { defaultValue: 'Current sale' })}
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
                  ? t('pos.terminal.voidAll', { defaultValue: 'Void all' })
                  : t('pos.terminal.clear', { defaultValue: 'Clear' })}
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
                  {t('pos.terminal.cartEmpty', { defaultValue: 'Cart is empty' })}
                </p>
                <p className="mt-1 text-xs text-slate-400 dark:text-[var(--color-text-secondary)]">
                  {t('pos.terminal.cartEmptyHelp', { defaultValue: 'Add items from the product list.' })}
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-[var(--color-border)]">
                {cart.map((l) => {
                  const isVoided = l.status === 'VOIDED';
                  const activeIndex = activeCart.findIndex((line) => line.lineId === l.lineId);
                  const quoteLine = activeIndex >= 0 ? quote?.lines?.[activeIndex] : undefined;
                  const taxName = quoteLine?.taxCodeName || t('pos.terminal.noTaxCode', { defaultValue: 'No tax' });
                  return (
                  <li key={l.lineId} className={`flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4 px-4 py-3 ${isVoided ? 'bg-slate-50 opacity-75 dark:bg-[var(--color-bg-primary)]/50' : 'hover:bg-slate-50/50 dark:hover:bg-[var(--color-bg-tertiary)]/50 transition-colors'}`}>
                    {/* Top/Left: Item Info */}
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className={`truncate text-sm font-semibold ${isVoided ? 'text-slate-500 line-through dark:text-[var(--color-text-secondary)]' : 'text-slate-900 dark:text-[var(--color-text-primary)]'}`}>
                          {l.itemName}
                        </span>
                        {isVoided && (
                          <span className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:border-[var(--color-border)] dark:bg-transparent">
                            {t('pos.terminal.voided', { defaultValue: 'Voided' })}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 mt-1.5">
                        <span className="font-mono text-xs font-medium text-slate-500 dark:text-[var(--color-text-secondary)]">{l.itemCode}</span>
                        
                        <div className="flex items-center gap-1.5 rounded bg-slate-50 px-1.5 py-1 dark:bg-[var(--color-bg-primary)]/50">
                          <label className="text-[10px] font-bold tracking-wider text-slate-400">PRICE</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={l.unitPrice}
                            onChange={(e) => onUpdateUnitPrice(l.lineId, Number(e.target.value) || 0)}
                            disabled={isVoided}
                            className="h-6 w-16 rounded border border-slate-200 bg-white px-1.5 text-right font-mono text-xs font-semibold text-slate-900 outline-none transition-colors focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 dark:border-[var(--color-border)] dark:bg-[var(--color-bg-primary)] dark:text-[var(--color-text-primary)] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                          />
                        </div>

                        <div className="flex items-center gap-1.5 rounded bg-slate-50 px-1.5 py-1 dark:bg-[var(--color-bg-primary)]/50">
                          <label className="text-[10px] font-bold tracking-wider text-slate-400">DIS</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={l.lineDiscount}
                            onChange={(e) => onUpdateLineDiscount(l.lineId, Number(e.target.value) || 0)}
                            disabled={isVoided}
                            className="h-6 w-16 rounded border border-slate-200 bg-white px-1.5 text-right font-mono text-xs font-semibold text-slate-900 outline-none transition-colors focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 dark:border-[var(--color-border)] dark:bg-[var(--color-bg-primary)] dark:text-[var(--color-text-primary)] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                          />
                        </div>

                        <div className="flex items-center gap-1.5 rounded bg-slate-50 px-1.5 py-1 dark:bg-[var(--color-bg-primary)]/50" title={`${taxName}${quoteLine?.taxRate !== undefined ? ` ${(quoteLine.taxRate * 100).toFixed(2)}%` : ''}`}>
                          <label className="text-[10px] font-bold tracking-wider text-slate-400">TAX</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={l.taxOverride ? (l.manualTaxAmount || 0) : (quoteLine?.taxAmount || 0)}
                            onChange={(e) => onUpdateManualTax(l.lineId, Number(e.target.value) || 0)}
                            disabled={isVoided}
                            className={`h-6 w-16 rounded border bg-white px-1.5 text-right font-mono text-xs font-semibold text-slate-900 outline-none transition-colors focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 dark:bg-[var(--color-bg-primary)] dark:text-[var(--color-text-primary)] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none ${l.taxOverride ? 'border-amber-300 bg-amber-50 dark:border-amber-500/50 dark:bg-amber-900/20' : 'border-slate-200 dark:border-[var(--color-border)]'}`}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Bottom/Right: Controls & Price */}
                    <div className="flex w-full shrink-0 items-center justify-between sm:w-auto sm:justify-end gap-3 mt-1 sm:mt-0">
                      {/* Quantity Controls */}
                      {!isVoided && (
                        <div className="flex h-9 sm:h-8 items-center rounded-md border border-slate-200 bg-white shadow-sm dark:border-[var(--color-border)] dark:bg-[var(--color-bg-primary)]">
                          <button
                            onClick={() => onUpdateQty(l.lineId, round2(l.qty - 1))}
                            aria-label={t('pos.terminal.decrease', { defaultValue: 'Decrease quantity' })}
                            className="flex h-full w-10 sm:w-8 items-center justify-center rounded-l-md text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900 active:bg-slate-100 dark:hover:bg-[var(--color-bg-tertiary)] dark:hover:text-[var(--color-text-primary)] cursor-pointer"
                          >
                            <Minus className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                          </button>
                          <input
                            type="number"
                            min="0"
                            step="0.001"
                            value={l.qty}
                            onChange={(e) => onUpdateQty(l.lineId, Number(e.target.value) || 0)}
                            aria-label={t('pos.terminal.qty', { defaultValue: 'Qty' })}
                            className="h-full w-12 sm:w-10 border-x border-slate-200 bg-transparent text-center text-sm font-medium text-slate-900 outline-none [appearance:textfield] focus:bg-indigo-50/50 dark:border-[var(--color-border)] dark:text-[var(--color-text-primary)] dark:focus:bg-[var(--color-bg-tertiary)] [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <button
                            onClick={() => onUpdateQty(l.lineId, round2(l.qty + 1))}
                            aria-label={t('pos.terminal.increase', { defaultValue: 'Increase quantity' })}
                            className="flex h-full w-10 sm:w-8 items-center justify-center rounded-r-md text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900 active:bg-slate-100 dark:hover:bg-[var(--color-bg-tertiary)] dark:hover:text-[var(--color-text-primary)] cursor-pointer"
                          >
                            <Plus className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                          </button>
                        </div>
                      )}

                      <div className="flex items-center gap-3 sm:gap-4">
                        {/* Total Price */}
                        <div className={`flex sm:w-20 flex-col items-end justify-center font-mono text-[15px] sm:text-sm font-semibold ${isVoided ? 'text-slate-400 line-through' : 'text-slate-900 dark:text-[var(--color-text-primary)]'}`}>
                          {money(l.lineTotal)}
                        </div>

                        {/* Actions */}
                        {!isVoided && (
                          <div className="flex items-center gap-1.5 sm:gap-1">
                            <button
                              onClick={() => setEditingLineId(l.lineId)}
                              aria-label={t('pos.terminal.editLine', { defaultValue: 'Edit line' })}
                              className="flex h-9 w-9 sm:h-8 sm:w-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600 active:bg-indigo-100 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-400 cursor-pointer"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => beginVoidLine(l.lineId)}
                              aria-label={t('pos.terminal.remove', { defaultValue: 'Remove line' })}
                              className="flex h-9 w-9 sm:h-8 sm:w-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 active:bg-rose-100 dark:hover:bg-rose-500/10 dark:hover:text-rose-400 cursor-pointer"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                );
                })}
              </ul>
            )}
          </div>

          {/* Totals + customer + pay */}
          <div className="flex-none space-y-3 border-t border-slate-100 bg-slate-50/60 p-4 dark:border-[var(--color-border)] dark:bg-[var(--color-bg-primary)]/40">
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-slate-600 dark:text-[var(--color-text-secondary)]">
                <span>{t('pos.terminal.subtotal', { defaultValue: 'Subtotal' })}</span>
                <span className="font-mono">{money(subtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-[var(--color-text-secondary)]">
                <span>{t('pos.terminal.discount', { defaultValue: 'Discount' })}</span>
                <span className="font-mono">{money(discountTotal)}</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-[var(--color-text-secondary)]">
                <span>{t('pos.terminal.tax', { defaultValue: 'Tax' })}</span>
                <span className="font-mono">{money(taxTotal)}</span>
              </div>
              <div className="mt-1 flex items-center justify-between border-t border-slate-200 pt-2 dark:border-[var(--color-border)]">
                <span className="text-base font-bold text-slate-900 dark:text-[var(--color-text-primary)]">
                  {t('pos.terminal.grandTotal', { defaultValue: 'Total' })}
                </span>
                <span className="font-mono text-xl font-extrabold text-slate-900 dark:text-[var(--color-text-primary)]">{money(grandTotal)}</span>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-[var(--color-text-secondary)]">
                {t('pos.terminal.customer', { defaultValue: 'Customer' })}
              </label>
              <PartySelector
                role="CUSTOMER"
                value={customerId}
                onChange={(p) => setCustomerId(p?.id || settings?.walkInCustomerId)}
              />
            </div>

            <button
              onClick={openPayDialog}
              disabled={activeCart.length === 0}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3.5 text-base font-bold text-white shadow-sm transition-colors hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 dark:disabled:bg-[var(--color-bg-tertiary)] cursor-pointer"
            >
              <CreditCard className="h-5 w-5" />
              {t('pos.terminal.pay', { defaultValue: 'Pay' })}
              <span className="font-mono">{money(grandTotal)}</span>
            </button>
          </div>
        </aside>
      </div>

      {/* Tender dialog */}
      <ConfirmDialog
        isOpen={showPayDialog}
        title={t('pos.terminal.tenderTitle', { defaultValue: 'Take payment' })}
        message={
          <div className="space-y-4">
            {/* Amount due banner */}
            <div className="flex items-center justify-between rounded-xl bg-slate-100 px-4 py-3 dark:bg-[var(--color-bg-tertiary)]">
              <span className="text-sm font-medium text-slate-600 dark:text-[var(--color-text-secondary)]">
                {t('pos.terminal.balanceDue', { defaultValue: 'Balance due' })}
              </span>
              <span className="font-mono text-lg font-bold text-slate-900 dark:text-[var(--color-text-primary)]">{money(balanceDue)}</span>
            </div>

            {/* Method buttons */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-[var(--color-text-secondary)]">
                {t('pos.terminal.method', { defaultValue: 'Method' })}
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
                  {t('pos.terminal.amount', { defaultValue: 'Amount' })}
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
                    {t('pos.terminal.exact', { defaultValue: 'Exact' })}
                  </button>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-[var(--color-text-secondary)]">
                  {t('pos.terminal.reference', { defaultValue: 'Reference' })}
                </label>
                <input
                  type="text"
                  value={tenderRef}
                  onChange={(e) => setTenderRef(e.target.value)}
                  placeholder={t('pos.terminal.referenceOptional', { defaultValue: 'Optional' })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-[var(--color-border)] dark:bg-[var(--color-bg-primary)] dark:text-[var(--color-text-primary)]"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={addTender}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 cursor-pointer"
            >
              <Plus className="h-4 w-4" /> {t('pos.terminal.addTender', { defaultValue: 'Add payment' })}
            </button>

            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-semibold text-amber-900">
                    {t('pos.managerOverride.title', { defaultValue: 'Manager approval' })}
                  </div>
                  <div className="mt-0.5 text-xs text-amber-800">
                    {saleManagerOverride
                      ? t('pos.managerOverride.attached', { defaultValue: 'Approval attached: {{id}}' }).replace('{{id}}', saleManagerOverride.managerOverrideId)
                      : t('pos.managerOverride.saleHelp', { defaultValue: 'Capture approval before completing a sale with restricted discounts, price, tax, or void overrides.' })}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSaleManagerOverride(true)}
                  className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-100 cursor-pointer"
                >
                  {saleManagerOverride
                    ? t('pos.managerOverride.replace', { defaultValue: 'Replace approval' })
                    : t('pos.managerOverride.capture', { defaultValue: 'Capture approval' })}
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
                        aria-label={t('pos.terminal.remove', { defaultValue: 'Remove' })}
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
                <span>{t('pos.terminal.tendered', { defaultValue: 'Tendered' })}</span>
                <span className="font-mono">{money(tenderedTotal)}</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-[var(--color-text-secondary)]">
                <span>{t('pos.terminal.change', { defaultValue: 'Change' })}</span>
                <span className="font-mono">{money(change)}</span>
              </div>
              <div className={`flex justify-between font-bold ${balanceDue > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                <span>
                  {balanceDue > 0
                    ? t('pos.terminal.balanceDue', { defaultValue: 'Balance due' })
                    : t('pos.terminal.fullyPaid', { defaultValue: 'Fully paid' })}
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
          : t('pos.terminal.completeSale', { defaultValue: 'Complete sale' })}
      />

      <ConfirmDialog
        isOpen={Boolean(voidTarget)}
        title={voidTarget?.all
          ? t('pos.terminal.voidAllTitle', { defaultValue: 'Void current sale lines' })
          : t('pos.terminal.voidLineTitle', { defaultValue: 'Void line' })}
        message={
          <div className="space-y-3">
            <p>
              {voidTarget?.all
                ? t('pos.terminal.voidAllMessage', { defaultValue: 'Active lines will remain on the receipt audit trail but will not be posted to stock or accounting.' })
                : t('pos.terminal.voidLineMessage', { defaultValue: 'The line will remain on the receipt audit trail but will not be posted to stock or accounting.' })}
            </p>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-[var(--color-text-secondary)]">
                {t('pos.terminal.voidReason', { defaultValue: 'Void reason' })}
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
                    ? t('pos.managerOverride.attached', { defaultValue: 'Approval attached: {{id}}' }).replace('{{id}}', voidManagerOverride.managerOverrideId)
                    : t('pos.managerOverride.voidHelp', { defaultValue: 'Capture manager approval if the cashier role requires approval for line voids.' })}
                </span>
                <button
                  type="button"
                  onClick={() => setShowVoidManagerOverride(true)}
                  className="rounded border border-amber-300 bg-white px-2.5 py-1 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-100 cursor-pointer"
                >
                  {voidManagerOverride
                    ? t('pos.managerOverride.replace', { defaultValue: 'Replace approval' })
                    : t('pos.managerOverride.capture', { defaultValue: 'Capture approval' })}
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
          ? t('pos.terminal.voidAll', { defaultValue: 'Void all' })
          : t('pos.terminal.voidLine', { defaultValue: 'Void line' })}
      />

      <ManagerOverrideCapture
        isOpen={showVoidManagerOverride}
        action="VOID_LINE"
        title={t('pos.managerOverride.voidTitle', { defaultValue: 'Approve line void' })}
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
        title={t('pos.managerOverride.saleTitle', { defaultValue: 'Approve sale override' })}
        context={{ registerId: register?.id, shiftId: shift?.id, lineCount: activeCart.length, total: grandTotal }}
        onCancel={() => setShowSaleManagerOverride(false)}
        onApproved={applySaleManagerOverride}
      />

      <Modal
        isOpen={Boolean(editingLine)}
        onClose={() => setEditingLineId(null)}
        title={t('pos.terminal.editLineTitle', { defaultValue: 'Edit sale line' })}
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
                  {t('pos.terminal.taxCodeLabel', { defaultValue: 'Tax' })}: {editingTaxName}
                  {editingQuoteLine?.taxRate !== undefined ? ` ${(editingQuoteLine.taxRate * 100).toFixed(2)}%` : ''}
                </span>
              </div>
            </div>

            <div className="border-t border-slate-200 dark:border-[var(--color-border)]" />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-[var(--color-text-secondary)]">
                  {t('pos.terminal.unitPrice', { defaultValue: 'Unit price' })}
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
                  {t('pos.terminal.discountPercent', { defaultValue: 'Discount percent' })}
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
                  {t('pos.terminal.lineDiscount', { defaultValue: 'Line discount' })}
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
                  {t('pos.terminal.taxAmount', { defaultValue: 'Tax amount' })}
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
            </div>

            <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-[var(--color-bg-tertiary)]">
              <span className="text-slate-500 dark:text-[var(--color-text-secondary)]">
                {t('pos.terminal.lineTotal', { defaultValue: 'Line total' })}
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
        title={t('pos.terminal.heldCartsTitle', { defaultValue: 'Held sales' })}
        message={
          <div className="max-h-[60vh] space-y-3 overflow-y-auto">
            {heldLoading ? (
              <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-[var(--color-text-secondary)]">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600" />
                {t('common.loading', { defaultValue: 'Loading…' })}
              </div>
            ) : heldCarts.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-[var(--color-text-secondary)]">
                {t('pos.terminal.noHeldCarts', { defaultValue: 'No held sales for this shift.' })}
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
                          {held.lines.length} {t('pos.terminal.lines', { defaultValue: 'lines' })}
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
                          {t('pos.terminal.recall', { defaultValue: 'Recall' })}
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
    </div>
  );
};

export default PosTerminalPage;
