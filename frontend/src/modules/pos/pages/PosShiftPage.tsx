/**
 * PosShiftPage.tsx — Open/close shift, X report, cash movements.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { posApi, PosRegisterDTO, PosShiftDTO } from '../../../api/posApi';
import { Card } from '../../../components/ui/Card';
import { OperationalListLayout } from '../../../components/shared/OperationalListLayout';
import { ColumnDefinition } from '../../../components/ui/DataTable';
import { Modal } from '../../../components/ui/Modal';
import { Spinner } from '../../../components/ui/Spinner';
import { errorHandler } from '../../../services/errorHandler';
import { useCompanyAccess } from '../../../context/CompanyAccessContext';
import { useAuth } from '../../../context/AuthContext';
import { Clock, DollarSign, PowerOff, Plus } from 'lucide-react';

const unwrap = <T,>(p: any): T => (p?.data ?? p) as T;
const PAYMENT_METHODS = ['CASH', 'CARD', 'BANK_TRANSFER', 'CUSTOM'] as const;

interface Props { isWindow?: boolean }

const PosShiftPage: React.FC<Props> = () => {
  const { t } = useTranslation();
  const { companyId } = useCompanyAccess();
  const { user } = useAuth();
  const userId = user?.uid;
  const [registers, setRegisters] = useState<PosRegisterDTO[]>([]);
  const [shifts, setShifts] = useState<PosShiftDTO[]>([]);
  const [openShift, setOpenShift] = useState<PosShiftDTO | null>(null);
  const [xReport, setXReport] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [showOpenForm, setShowOpenForm] = useState(false);
  const [showCloseForm, setShowCloseForm] = useState(false);
  const [closeSummaryReviewed, setCloseSummaryReviewed] = useState(false);
  const [showMovementForm, setShowMovementForm] = useState(false);
  const [opening, setOpening] = useState(false);
  const [closing, setClosing] = useState(false);
  const [registerId, setRegisterId] = useState('');
  const [openingFloat, setOpeningFloat] = useState<string>('0');
  const [countedCash, setCountedCash] = useState<string>('0');
  const [countedPaymentTotals, setCountedPaymentTotals] = useState<Record<string, string>>({
    CASH: '0',
    CARD: '0',
    BANK_TRANSFER: '0',
    CUSTOM: '0',
  });
  const [movementType, setMovementType] = useState<'PAYIN' | 'PAYOUT' | 'DROP'>('PAYIN');
  const [movementAmount, setMovementAmount] = useState<string>('0');
  const [movementReason, setMovementReason] = useState<string>('');

  const load = async () => {
    try {
      setLoading(true);
      const [r, s, open, report] = await Promise.all([
        posApi.listRegisters().catch(() => []),
        posApi.listShifts({ limit: 50 }).catch(() => []),
        // We do not know the open shift id; fetch via list and pick first OPEN
        posApi.listShifts({ status: 'OPEN', limit: 1 }).catch(() => []),
        Promise.resolve(null),
      ]);
      setRegisters(unwrap<PosRegisterDTO[]>(r) || []);
      const shiftList = unwrap<PosShiftDTO[]>(s) || [];
      setShifts(shiftList);
      const myOpen = shiftList.find((x) => x.status === 'OPEN' && (userId ? x.cashierUserId === userId : true)) || null;
      setOpenShift(myOpen);
      if (myOpen) {
        try {
          const xr = await posApi.getXReport(myOpen.id);
          setXReport(unwrap<any>(xr));
        } catch {
          setXReport(null);
        }
      } else {
        setXReport(null);
      }
    } catch (err) {
      console.error('Failed to load shift data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, companyId]);

  const onOpen = async () => {
    if (!registerId) {
      toast.error(t('pos:shift.openNeedRegister', { defaultValue: 'Pick a register.' }));
      return;
    }
    try {
      setOpening(true);
      const float = Number(openingFloat) || 0;
      const shift = await posApi.openShift({ registerId, cashierUserId: userId, openingFloat: float });
      toast.success(t('pos:shift.opened', { defaultValue: 'Shift opened.' }));
      setShowOpenForm(false);
      setRegisterId('');
      setOpeningFloat('0');
      void (shift as PosShiftDTO);
      await load();
    } catch (err: any) {
      errorHandler.showError(err?.response?.data?.error?.message || err?.message || 'Failed to open shift.');
    } finally {
      setOpening(false);
    }
  };

  const onClose = async (force = false) => {
    if (!openShift) return;
    try {
      setClosing(true);
      const counted = Number(countedCash) || 0;
      const countedByMethod = {
        CASH: counted,
        CARD: Number(countedPaymentTotals.CARD) || 0,
        BANK_TRANSFER: Number(countedPaymentTotals.BANK_TRANSFER) || 0,
        CUSTOM: Number(countedPaymentTotals.CUSTOM) || 0,
      };
      const result = force
        ? await posApi.forceCloseShift(openShift.id, { countedCash: counted, countedPaymentTotals: countedByMethod })
        : await posApi.closeShift(openShift.id, { countedCash: counted, countedPaymentTotals: countedByMethod });
      const data = unwrap<any>(result);
      const variance = data?.overShortAmount ?? 0;
      const voucherId = data?.overShortVoucherId;
      if (variance && voucherId) {
        toast.success(t('pos:shift.closedWithVoucher', {
          defaultValue: `Shift closed. ${variance > 0 ? 'Over' : 'Short'} ${Math.abs(variance)} → voucher ${voucherId}.`,
        }));
      } else {
        toast.success(t('pos:shift.closed', { defaultValue: 'Shift closed.' }));
      }
      setShowCloseForm(false);
      setCountedCash('0');
      setCountedPaymentTotals({ CASH: '0', CARD: '0', BANK_TRANSFER: '0', CUSTOM: '0' });
      await load();
    } catch (err: any) {
      errorHandler.showError(err?.response?.data?.error?.message || err?.message || 'Failed to close shift.');
    } finally {
      setClosing(false);
    }
  };

  const onAddMovement = async () => {
    if (!openShift) return;
    try {
      const amount = Number(movementAmount) || 0;
      if (amount <= 0) {
        toast.error(t('pos:shift.amountPositive', { defaultValue: 'Amount must be positive.' }));
        return;
      }
      await posApi.createCashMovement(openShift.id, {
        type: movementType,
        amount,
        reason: movementReason || undefined,
      });
      toast.success(t('pos:shift.movementAdded', { defaultValue: 'Cash movement recorded.' }));
      setShowMovementForm(false);
      setMovementAmount('0');
      setMovementReason('');
      await load();
    } catch (err: any) {
      errorHandler.showError(err?.response?.data?.error?.message || err?.message || 'Failed to record movement.');
    }
  };

  const shiftColumns: ColumnDefinition<PosShiftDTO>[] = [
    { key: 'id', label: t('pos:shift.col.id', { defaultValue: 'Shift' }), width: '180px', priority: 1, accessor: (r) => r.id.slice(-8) },
    { key: 'registerId', label: t('pos:shift.col.register', { defaultValue: 'Register' }), width: '120px', priority: 1, accessor: (r) => {
      const reg = registers.find(reg => reg.id === r.registerId);
      return reg ? `${reg.code} - ${reg.name}` : r.registerId;
    } },
    { key: 'status', label: t('pos:shift.col.status', { defaultValue: 'Status' }), width: '100px', priority: 1,
      render: (_v, r) => (
        <span className={`px-2 py-0.5 rounded text-xs ${r.status === 'OPEN' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
          {r.status}
        </span>
      ),
    },
    { key: 'openedAt', label: t('pos:shift.col.opened', { defaultValue: 'Opened' }), width: '160px', priority: 2, accessor: (r) => new Date(r.openedAt).toLocaleString() },
    { key: 'closedAt', label: t('pos:shift.col.closed', { defaultValue: 'Closed' }), width: '160px', priority: 2, accessor: (r) => r.closedAt ? new Date(r.closedAt).toLocaleString() : '—' },
    { key: 'openingFloat', label: t('pos:shift.col.opening', { defaultValue: 'Opening' }), width: '120px', priority: 2, accessor: (r) => r.openingFloat },
    { key: 'overShort', label: t('pos:shift.col.variance', { defaultValue: 'Cash variance' }), width: '120px', priority: 1, accessor: (r) => r.overShortAmount ?? 0 },
  ];

  const totals = xReport?.totals;
  const countedCashNumber = Number(countedCash) || 0;
  const expectedCashNumber = Number(totals?.expectedCash) || 0;
  const closeVariance = countedCashNumber - expectedCashNumber;
  const formatAmount = (amount: number) => amount.toFixed(2);

  return (
    <div className="p-6 space-y-4">
      {openShift ? (
        <Card>
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-indigo-600" />
              <h2 className="text-lg font-semibold">
                {t('pos:shift.openTitle', { defaultValue: 'Open shift' })} — {(() => {
                  const reg = registers.find(r => r.id === openShift.registerId);
                  return reg ? `${reg.code} - ${reg.name}` : openShift.registerId;
                })()}
              </h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <div className="text-slate-500">{t('pos:shift.openingFloat', { defaultValue: 'Opening float' })}</div>
                <div className="font-mono">{openShift.openingFloat.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-slate-500">{t('pos:shift.expected', { defaultValue: 'Expected cash' })}</div>
                <div className="font-mono">{totals?.expectedCash?.toFixed(2) ?? '0.00'}</div>
              </div>
              <div>
                <div className="text-slate-500">{t('pos:shift.cashSales', { defaultValue: 'Cash sales' })}</div>
                <div className="font-mono">{totals?.SALE_CASH?.toFixed(2) ?? '0.00'}</div>
              </div>
              <div>
                <div className="text-slate-500">{t('pos:shift.refunds', { defaultValue: 'Refunds' })}</div>
                <div className="font-mono">{totals?.REFUND_CASH?.toFixed(2) ?? '0.00'}</div>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowMovementForm(true)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded border border-slate-300 text-sm"
              >
                <Plus className="w-4 h-4" /> {t('pos:shift.addMovement', { defaultValue: 'Add cash movement' })}
              </button>
              <button
                onClick={() => {
                  setCloseSummaryReviewed(false);
                  setShowCloseForm(true);
                }}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-indigo-600 text-white text-sm"
              >
                <DollarSign className="w-4 h-4" /> {t('pos:shift.closeShift', { defaultValue: 'Close shift' })}
              </button>
            </div>
          </div>
        </Card>
      ) : (
        <Card>
          <div className="p-6 text-center space-y-3">
            <p className="text-sm text-slate-500">
              {t('pos:shift.noOpen', { defaultValue: 'No open shift. Open one to start selling.' })}
            </p>
            <button
              onClick={() => setShowOpenForm(true)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-indigo-600 text-white text-sm"
            >
              <Plus className="w-4 h-4" /> {t('pos:shift.open', { defaultValue: 'Open shift' })}
            </button>
          </div>
        </Card>
      )}

      <OperationalListLayout<PosShiftDTO>
        title={t('pos:shift.historyTitle', { defaultValue: 'Shift history' })}
        subtitle={t('pos:shift.historySubtitle', { defaultValue: 'Recent shifts for this company.' })}
        onRefresh={load}
        data={shifts}
        columns={shiftColumns}
        loading={loading}
        idKey="id"
        emptyMessage={t('pos:shift.empty', { defaultValue: 'No shifts yet.' })}
      />

      {/* Open shift modal */}
      <Modal isOpen={showOpenForm} onClose={() => setShowOpenForm(false)} title={t('pos:shift.openTitle', { defaultValue: 'Open shift' })}>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">{t('pos:shift.register', { defaultValue: 'Register' })}</label>
            <select
              value={registerId}
              onChange={(e) => setRegisterId(e.target.value)}
              className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
            >
              <option value="">--</option>
              {registers.filter((r) => r.status === 'ACTIVE').map((r) => (
                <option key={r.id} value={r.id}>{r.code} — {r.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('pos:shift.openingFloat', { defaultValue: 'Opening float' })}</label>
            <input
              type="number"
              value={openingFloat}
              onChange={(e) => setOpeningFloat(e.target.value)}
              min="0"
              step="0.01"
              className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setShowOpenForm(false)} className="px-3 py-1.5 rounded border border-slate-300 text-sm">{t('common.cancel', { defaultValue: 'Cancel' })}</button>
            <button onClick={onOpen} disabled={opening} className="px-3 py-1.5 rounded bg-indigo-600 text-white text-sm disabled:opacity-50">
              {opening ? <Spinner size="sm" variant="white" /> : t('pos:shift.open', { defaultValue: 'Open shift' })}
            </button>
          </div>
        </div>
      </Modal>

      {/* Close shift modal */}
      <Modal
        isOpen={showCloseForm}
        onClose={() => setShowCloseForm(false)}
        title={t('pos:shift.closeTitle', { defaultValue: 'Close shift' })}
        hideFooter
      >
        <div className="space-y-3">
          <div className="text-sm bg-slate-50 p-3 rounded">
            <div className="flex justify-between">
              <span>{t('pos:shift.expected', { defaultValue: 'Expected cash' })}:</span>
              <span className="font-mono">{formatAmount(expectedCashNumber)}</span>
            </div>
          </div>

          {!closeSummaryReviewed ? (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">{t('pos:shift.counted', { defaultValue: 'Counted cash' })}</label>
                <input
                  type="number"
                  value={countedCash}
                  onChange={(e) => {
                    setCountedCash(e.target.value);
                    setCountedPaymentTotals((prev) => ({ ...prev, CASH: e.target.value }));
                  }}
                  min="0"
                  step="0.01"
                  className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                />
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {PAYMENT_METHODS.filter((method) => method !== 'CASH').map((method) => (
                  <div key={method}>
                    <label className="block text-sm font-medium mb-1">
                      {t(`pos:shift.countedPayment.${method}`, { defaultValue: `Counted ${method}` })}
                    </label>
                    <input
                      type="number"
                      value={countedPaymentTotals[method]}
                      onChange={(e) => setCountedPaymentTotals((prev) => ({ ...prev, [method]: e.target.value }))}
                      min="0"
                      step="0.01"
                      className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                    />
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
              <div className="font-semibold">{t('pos:shift.closeSummaryTitle', { defaultValue: 'Shift close summary' })}</div>
              <div className="grid gap-2 sm:grid-cols-3">
                <div>
                  <div className="text-xs text-amber-700">{t('pos:shift.expected', { defaultValue: 'Expected cash' })}</div>
                  <div className="font-mono font-semibold">{formatAmount(expectedCashNumber)}</div>
                </div>
                <div>
                  <div className="text-xs text-amber-700">{t('pos:shift.counted', { defaultValue: 'Counted cash' })}</div>
                  <div className="font-mono font-semibold">{formatAmount(countedCashNumber)}</div>
                </div>
                <div>
                  <div className="text-xs text-amber-700">{t('pos:shift.cashVariance', { defaultValue: 'Cash variance' })}</div>
                  <div className="font-mono font-semibold">{formatAmount(closeVariance)}</div>
                </div>
              </div>
              <p className="text-xs leading-5">
                {t('pos:shift.closeSummaryHelp', {
                  defaultValue: 'Review the shift totals before ending the session. If there is a cash over/short amount, ERP03 will post the configured accounting effect during close.',
                })}
              </p>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setShowCloseForm(false)} className="px-3 py-1.5 rounded border border-slate-300 text-sm">{t('common.cancel', { defaultValue: 'Cancel' })}</button>
            {closeSummaryReviewed && (
              <button onClick={() => setCloseSummaryReviewed(false)} className="px-3 py-1.5 rounded border border-slate-300 text-sm">
                {t('pos:shift.editCount', { defaultValue: 'Edit count' })}
              </button>
            )}
            <button
              onClick={() => closeSummaryReviewed ? onClose(false) : setCloseSummaryReviewed(true)}
              disabled={closing}
              className="px-3 py-1.5 rounded bg-indigo-600 text-white text-sm disabled:opacity-50"
            >
              {closing
                ? <Spinner size="sm" variant="white" />
                : closeSummaryReviewed
                  ? t('pos:shift.confirmEndSession', { defaultValue: 'Confirm end session' })
                  : t('pos:shift.viewCloseSummary', { defaultValue: 'View shift summary' })}
            </button>
          </div>
        </div>
      </Modal>

      {/* Cash movement modal */}
      <Modal isOpen={showMovementForm} onClose={() => setShowMovementForm(false)} title={t('pos:shift.addMovement', { defaultValue: 'Add cash movement' })}>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">{t('pos:shift.movementType', { defaultValue: 'Type' })}</label>
            <select
              value={movementType}
              onChange={(e) => setMovementType(e.target.value as any)}
              className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
            >
              <option value="PAYIN">{t('pos:shift.payin', { defaultValue: 'Pay-in (cash added)' })}</option>
              <option value="PAYOUT">{t('pos:shift.payout', { defaultValue: 'Pay-out (cash removed)' })}</option>
              <option value="DROP">{t('pos:shift.drop', { defaultValue: 'Drop (to safe)' })}</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('pos:shift.amount', { defaultValue: 'Amount' })}</label>
            <input
              type="number"
              value={movementAmount}
              onChange={(e) => setMovementAmount(e.target.value)}
              min="0"
              step="0.01"
              className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('pos:shift.reason', { defaultValue: 'Reason' })}</label>
            <input
              type="text"
              value={movementReason}
              onChange={(e) => setMovementReason(e.target.value)}
              className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setShowMovementForm(false)} className="px-3 py-1.5 rounded border border-slate-300 text-sm">{t('common.cancel', { defaultValue: 'Cancel' })}</button>
            <button onClick={onAddMovement} className="px-3 py-1.5 rounded bg-indigo-600 text-white text-sm">{t('common.save', { defaultValue: 'Save' })}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default PosShiftPage;
