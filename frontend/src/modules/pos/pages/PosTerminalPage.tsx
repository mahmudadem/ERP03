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
 * `completeSale` posts the Sales Invoice. The screen only collects intent.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { posApi, PosRegisterDTO, PosShiftDTO, PosSettingsDTO } from '../../../api/posApi';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
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
} from 'lucide-react';

const unwrap = <T,>(p: any): T => (p?.data ?? p) as T;

interface CartLine {
  itemId: string;
  itemCode: string;
  itemName: string;
  qty: number;
  unitPrice: number;
  lineDiscount: number;
  lineTotal: number;
}

type PaymentMethod = 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'CUSTOM';

interface Payment {
  method: PaymentMethod;
  amount: number;
  reference?: string;
}

interface Props { isWindow?: boolean }

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;
const money = (n: number): string =>
  (Number.isFinite(n) ? n : 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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

  // Tender form (React state — no more getElementById)
  const [tenderMethod, setTenderMethod] = useState<PaymentMethod>('CASH');
  const [tenderAmount, setTenderAmount] = useState<string>('');
  const [tenderRef, setTenderRef] = useState<string>('');

  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const result = await posApi.getBootstrap({ cashierUserId: userId });
        const data = unwrap<any>(result);
        setBootstrap(data);
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

  const subtotal = useMemo(() => cart.reduce((s, l) => s + l.qty * l.unitPrice, 0), [cart]);
  const discountTotal = useMemo(() => cart.reduce((s, l) => s + l.lineDiscount, 0), [cart]);
  const itemCount = useMemo(() => cart.reduce((s, l) => s + l.qty, 0), [cart]);

  // Tax-inclusive total comes from the backend quote (same calc the SI uses). While the
  // quote loads we fall back to a tax-exclusive estimate; the backend stays authoritative.
  const [quote, setQuote] = useState<{ subtotal: number; taxTotal: number; grandTotal: number } | null>(null);
  useEffect(() => {
    if (cart.length === 0) { setQuote(null); return; }
    const handle = setTimeout(async () => {
      try {
        const q = await posApi.previewSale(cart.map((l) => ({ itemId: l.itemId, qty: l.qty, unitPrice: l.unitPrice })));
        setQuote(q);
      } catch (err) {
        console.error('Preview failed', err);
        setQuote(null);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [cart]);

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
      const existing = prev.find((l) => l.itemId === item.id);
      if (existing) {
        return prev.map((l) =>
          l.itemId === item.id
            ? { ...l, qty: l.qty + 1, lineTotal: round2((l.qty + 1) * l.unitPrice - l.lineDiscount) }
            : l
        );
      }
      return [
        ...prev,
        {
          itemId: item.id,
          itemCode: item.code || '',
          itemName: item.name || '',
          qty: 1,
          unitPrice,
          lineDiscount: 0,
          lineTotal: round2(unitPrice),
        },
      ];
    });
  };

  const onUpdateQty = (itemId: string, qty: number) => {
    if (qty <= 0) { onRemoveLine(itemId); return; }
    setCart((prev) =>
      prev.map((l) =>
        l.itemId === itemId
          ? { ...l, qty, lineTotal: round2(qty * l.unitPrice - l.lineDiscount) }
          : l
      )
    );
  };

  const onRemoveLine = (itemId: string) => {
    setCart((prev) => prev.filter((l) => l.itemId !== itemId));
  };

  const onClearSale = () => {
    setCart([]);
    setPayments([]);
    setSearchQuery('');
    searchRef.current?.focus();
  };

  const onAddPayment = (p: Payment) => setPayments((prev) => [...prev, p]);
  const onRemovePayment = (idx: number) => setPayments((prev) => prev.filter((_, i) => i !== idx));

  // Scan flow: pressing Enter adds the top match and clears the box for the next scan.
  const onSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchResults.length > 0) {
      e.preventDefault();
      onAddToCart(searchResults[0]);
      setSearchQuery('');
    }
  };

  const openPayDialog = () => {
    if (cart.length === 0) return;
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

  const onCompleteSale = async () => {
    const register = bootstrap?.register;
    const shift = bootstrap?.openShift;
    if (!register || !shift) {
      toast.error(t('pos.terminal.needOpenShift', { defaultValue: 'No open shift for this register.' }));
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
        lines: cart.map((l) => ({ itemId: l.itemId, qty: l.qty, unitPrice: l.unitPrice })),
        payments: salePayments,
      });
      const data = unwrap<any>(result);
      setLastReceipt(data);
      toast.success(t('pos.terminal.completed', { defaultValue: 'Sale completed.' }));
      setCart([]);
      setPayments([]);
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
                {t('pos.terminal.clear', { defaultValue: 'Clear' })}
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
                {cart.map((l) => (
                  <li key={l.itemId} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-slate-900 dark:text-[var(--color-text-primary)]">{l.itemName}</div>
                      <div className="truncate font-mono text-[11px] text-slate-500 dark:text-[var(--color-text-secondary)]">
                        {l.itemCode} · {money(l.unitPrice)}
                      </div>
                    </div>

                    {/* Qty stepper */}
                    <div className="flex flex-none items-center rounded-lg border border-slate-200 dark:border-[var(--color-border)]">
                      <button
                        onClick={() => onUpdateQty(l.itemId, round2(l.qty - 1))}
                        aria-label={t('pos.terminal.decrease', { defaultValue: 'Decrease quantity' })}
                        className="flex h-8 w-8 items-center justify-center rounded-l-lg text-slate-500 transition-colors hover:bg-slate-100 dark:hover:bg-[var(--color-bg-tertiary)] cursor-pointer"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <input
                        type="number"
                        min="0"
                        step="0.001"
                        value={l.qty}
                        onChange={(e) => onUpdateQty(l.itemId, Number(e.target.value) || 0)}
                        aria-label={t('pos.terminal.qty', { defaultValue: 'Qty' })}
                        className="h-8 w-12 border-x border-slate-200 bg-transparent text-center text-sm text-slate-900 outline-none [appearance:textfield] focus:bg-indigo-50/50 dark:border-[var(--color-border)] dark:text-[var(--color-text-primary)] dark:focus:bg-[var(--color-bg-tertiary)] [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <button
                        onClick={() => onUpdateQty(l.itemId, round2(l.qty + 1))}
                        aria-label={t('pos.terminal.increase', { defaultValue: 'Increase quantity' })}
                        className="flex h-8 w-8 items-center justify-center rounded-r-lg text-slate-500 transition-colors hover:bg-slate-100 dark:hover:bg-[var(--color-bg-tertiary)] cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="w-20 flex-none text-right font-mono text-sm font-semibold text-slate-900 dark:text-[var(--color-text-primary)]">
                      {money(l.lineTotal)}
                    </div>
                    <button
                      onClick={() => onRemoveLine(l.itemId)}
                      aria-label={t('pos.terminal.remove', { defaultValue: 'Remove line' })}
                      className="flex h-8 w-8 flex-none items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10 cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
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
              disabled={cart.length === 0}
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
    </div>
  );
};

export default PosTerminalPage;
