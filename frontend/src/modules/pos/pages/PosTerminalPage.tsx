/**
 * PosTerminalPage.tsx — Phase 2 cashier screen.
 *
 * Layout: product search (left) | cart (center) | tender (right).
 * Uses shared ItemSelector-free product search (debounced) + shared PartySelector
 * for customer + a ConfirmDialog on Complete Sale.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { posApi, PosRegisterDTO, PosShiftDTO, PosSettingsDTO } from '../../../api/posApi';
import { Card } from '../../../components/ui/Card';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { OperationalListLayout } from '../../../components/shared/OperationalListLayout';
import { PartySelector } from '../../../components/shared/selectors/PartySelector';
import { Spinner } from '../../../components/ui/Spinner';
import { errorHandler } from '../../../services/errorHandler';
import { useAuth } from '../../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Calculator, Plus, Trash2, Receipt, AlertTriangle } from 'lucide-react';

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

interface Payment {
  method: 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'CUSTOM';
  amount: number;
  reference?: string;
}

interface Props { isWindow?: boolean }

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
  const grandTotal = useMemo(() => Math.max(0, subtotal - discountTotal), [subtotal, discountTotal]);
  const tenderedCash = useMemo(() => payments.filter((p) => p.method === 'CASH').reduce((s, p) => s + p.amount, 0), [payments]);
  const tenderedTotal = useMemo(() => payments.reduce((s, p) => s + p.amount, 0), [payments]);
  const change = Math.max(0, tenderedCash - grandTotal);
  const paid = tenderedTotal - change;

  const onAddToCart = (item: any) => {
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
          unitPrice: Number(item.salePrice || 0),
          lineDiscount: 0,
          lineTotal: round2(Number(item.salePrice || 0)),
        },
      ];
    });
  };

  const onUpdateQty = (itemId: string, qty: number) => {
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

  const onAddPayment = (p: Payment) => {
    setPayments((prev) => [...prev, p]);
  };

  const onRemovePayment = (idx: number) => {
    setPayments((prev) => prev.filter((_, i) => i !== idx));
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
        lines: cart.map((l) => ({
          itemId: l.itemId,
          qty: l.qty,
          unitPrice: l.unitPrice,
        })),
        payments,
      });
      const data = unwrap<any>(result);
      setLastReceipt(data);
      toast.success(t('pos.terminal.completed', { defaultValue: 'Sale completed.' }));
      // Reset cart
      setCart([]);
      setPayments([]);
    } catch (err: any) {
      errorHandler.showError(err?.response?.data?.error?.message || err?.message || 'Failed to complete sale.');
    } finally {
      setCompleting(false);
      setShowPayDialog(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-sm text-slate-500">{t('common.loading', { defaultValue: 'Loading…' })}</div>;
  }

  const register = bootstrap?.register;
  const shift = bootstrap?.openShift;
  const settings = bootstrap?.settings;

  if (!register || !shift) {
    return (
      <div className="p-6">
        <Card>
          <div className="p-6 text-center space-y-3">
            <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
            <p className="text-sm text-slate-700">
              {t('pos.terminal.needOpenShift', { defaultValue: 'No open shift for this register.' })}
            </p>
            <button
              onClick={() => navigate('/pos/shift')}
              className="px-3 py-1.5 rounded bg-indigo-600 text-white text-sm"
            >
              {t('pos.terminal.openShiftCta', { defaultValue: 'Open a shift' })}
            </button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-full p-3 grid grid-cols-12 gap-3 bg-slate-50">
      {/* Product search */}
      <div className="col-span-4">
        <Card>
          <div className="p-3 space-y-2">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Calculator className="w-4 h-4" /> {t('pos.terminal.searchTitle', { defaultValue: 'Search products' })}
            </h3>
            <input
              autoFocus
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('pos.terminal.searchPlaceholder', { defaultValue: 'Scan barcode / search SKU / name' })}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
            <div className="text-xs text-slate-500">
              {t('pos.terminal.cashierLabel', { defaultValue: 'Cashier' })}: {user?.email || userId}
            </div>
            <div className="max-h-[60vh] overflow-y-auto divide-y">
              {searching && (
                <div className="p-3 text-xs text-slate-500">{t('common.searching', { defaultValue: 'Searching…' })}</div>
              )}
              {!searching && searchResults.map((it) => (
                <button
                  key={it.id}
                  onClick={() => onAddToCart(it)}
                  className="w-full text-left p-2 hover:bg-slate-50"
                >
                  <div className="text-sm font-medium">{it.name}</div>
                  <div className="text-xs text-slate-500 flex justify-between">
                    <span>{it.code}</span>
                    <span className="font-mono">{Number(it.salePrice || 0).toFixed(2)}</span>
                  </div>
                </button>
              ))}
              {!searching && searchQuery && searchResults.length === 0 && (
                <div className="p-3 text-xs text-slate-500">{t('pos.terminal.noResults', { defaultValue: 'No matches.' })}</div>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Cart */}
      <div className="col-span-5">
        <Card>
          <div className="p-3 space-y-2">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Receipt className="w-4 h-4" /> {t('pos.terminal.cartTitle', { defaultValue: 'Cart' })}
            </h3>
            <div className="border rounded">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 border-b">
                    <th className="py-2 px-2">{t('pos.terminal.item', { defaultValue: 'Item' })}</th>
                    <th className="py-2 px-2 w-16">{t('pos.terminal.qty', { defaultValue: 'Qty' })}</th>
                    <th className="py-2 px-2 text-right">{t('pos.terminal.price', { defaultValue: 'Price' })}</th>
                    <th className="py-2 px-2 text-right">{t('pos.terminal.total', { defaultValue: 'Total' })}</th>
                    <th className="py-2 px-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map((l) => (
                    <tr key={l.itemId} className="border-b last:border-b-0">
                      <td className="py-1.5 px-2">
                        <div className="text-sm">{l.itemName}</div>
                        <div className="text-xs text-slate-500">{l.itemCode}</div>
                      </td>
                      <td className="py-1.5 px-2">
                        <input
                          type="number"
                          min="0"
                          step="0.001"
                          value={l.qty}
                          onChange={(e) => onUpdateQty(l.itemId, Number(e.target.value) || 0)}
                          className="w-14 rounded border border-slate-300 px-1.5 py-0.5 text-sm"
                        />
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono">{l.unitPrice.toFixed(2)}</td>
                      <td className="py-1.5 px-2 text-right font-mono">{l.lineTotal.toFixed(2)}</td>
                      <td className="py-1.5 px-2 text-right">
                        <button onClick={() => onRemoveLine(l.itemId)} className="p-1 text-rose-500 hover:bg-rose-50 rounded">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {cart.length === 0 && (
                    <tr><td colSpan={5} className="p-4 text-center text-xs text-slate-500">
                      {t('pos.terminal.cartEmpty', { defaultValue: 'Cart is empty. Add items from the left.' })}
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="space-y-1 text-sm pt-2">
              <div className="flex justify-between">
                <span>{t('pos.terminal.subtotal', { defaultValue: 'Subtotal' })}</span>
                <span className="font-mono">{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>{t('pos.terminal.discount', { defaultValue: 'Discount' })}</span>
                <span className="font-mono">{discountTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold">
                <span>{t('pos.terminal.grandTotal', { defaultValue: 'Grand total' })}</span>
                <span className="font-mono">{grandTotal.toFixed(2)}</span>
              </div>
            </div>
            <div className="pt-2">
              <label className="block text-xs font-medium mb-1">
                {t('pos.terminal.customer', { defaultValue: 'Customer' })}
              </label>
              <PartySelector
                role="CUSTOMER"
                value={customerId}
                onChange={(p) => setCustomerId(p?.id || settings?.walkInCustomerId)}
              />
            </div>
            <button
              onClick={() => setShowPayDialog(true)}
              disabled={cart.length === 0}
              className="w-full mt-2 px-3 py-2 rounded bg-indigo-600 text-white text-sm disabled:opacity-50"
            >
              {t('pos.terminal.pay', { defaultValue: 'Pay' })}
            </button>
          </div>
        </Card>
      </div>

      {/* Tender + last receipt */}
      <div className="col-span-3 space-y-3">
        {lastReceipt && (
          <Card>
            <div className="p-3 space-y-2">
              <h3 className="font-semibold text-sm">{t('pos.terminal.lastReceipt', { defaultValue: 'Last receipt' })}</h3>
              <div className="text-xs text-slate-500">
                {t('pos.terminal.receiptNumber', { defaultValue: 'Receipt' })}: <span className="font-mono">{lastReceipt.receipt?.receiptNumber}</span>
              </div>
              <div className="text-xs text-slate-500">
                {t('pos.terminal.siNumber', { defaultValue: 'Sales Invoice' })}: <span className="font-mono">{lastReceipt.salesInvoiceNumber}</span>
              </div>
              <div className="text-xs text-slate-500">
                {t('pos.terminal.change', { defaultValue: 'Change' })}: <span className="font-mono">{Number(lastReceipt.change || 0).toFixed(2)}</span>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Tender dialog */}
      <ConfirmDialog
        isOpen={showPayDialog}
        title={t('pos.terminal.tenderTitle', { defaultValue: 'Tender' })}
        message={
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div>
                <label className="block text-xs font-medium mb-1">{t('pos.terminal.method', { defaultValue: 'Method' })}</label>
                <select
                  id="tender-method"
                  className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                  defaultValue="CASH"
                >
                  <option value="CASH">CASH</option>
                  <option value="CARD">CARD</option>
                  <option value="BANK_TRANSFER">BANK_TRANSFER</option>
                  <option value="CUSTOM">CUSTOM</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">{t('pos.terminal.amount', { defaultValue: 'Amount' })}</label>
                <input
                  id="tender-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">{t('pos.terminal.reference', { defaultValue: 'Reference' })}</label>
                <input
                  id="tender-ref"
                  type="text"
                  className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                />
              </div>
            </div>
            <button
              onClick={() => {
                const method = (document.getElementById('tender-method') as HTMLSelectElement)?.value as any;
                const amount = Number((document.getElementById('tender-amount') as HTMLInputElement)?.value) || 0;
                const ref = (document.getElementById('tender-ref') as HTMLInputElement)?.value;
                if (!method || amount <= 0) {
                  toast.error(t('pos.terminal.tenderNeedAmount', { defaultValue: 'Pick a method and amount.' }));
                  return;
                }
                onAddPayment({ method, amount, reference: ref || undefined });
                (document.getElementById('tender-amount') as HTMLInputElement).value = '';
                (document.getElementById('tender-ref') as HTMLInputElement).value = '';
              }}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded border border-slate-300 text-sm"
            >
              <Plus className="w-3.5 h-3.5" /> {t('pos.terminal.addTender', { defaultValue: 'Add tender' })}
            </button>

            {payments.length > 0 && (
              <div className="border rounded">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-500 border-b">
                      <th className="py-1 px-2">{t('pos.terminal.method', { defaultValue: 'Method' })}</th>
                      <th className="py-1 px-2 text-right">{t('pos.terminal.amount', { defaultValue: 'Amount' })}</th>
                      <th className="py-1 px-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p, i) => (
                      <tr key={i} className="border-b last:border-b-0">
                        <td className="py-1 px-2">{p.method}{p.reference ? ` (${p.reference})` : ''}</td>
                        <td className="py-1 px-2 text-right font-mono">{p.amount.toFixed(2)}</td>
                        <td className="py-1 px-2 text-right">
                          <button onClick={() => onRemovePayment(i)} className="p-1 text-rose-500 hover:bg-rose-50 rounded">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="text-sm space-y-1 pt-2 border-t">
              <div className="flex justify-between">
                <span>{t('pos.terminal.tendered', { defaultValue: 'Tendered' })}:</span>
                <span className="font-mono">{tenderedTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>{t('pos.terminal.change', { defaultValue: 'Change' })}:</span>
                <span className="font-mono">{change.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>{t('pos.terminal.applied', { defaultValue: 'Applied to invoice' })}:</span>
                <span className="font-mono">{paid.toFixed(2)}</span>
              </div>
            </div>
          </div>
        }
        tone="info"
        onConfirm={onCompleteSale}
        onCancel={() => setShowPayDialog(false)}
        confirmLabel={completing ? '…' : t('pos.terminal.completeSale', { defaultValue: 'Complete sale' })}
      />
    </div>
  );
};

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

export default PosTerminalPage;
